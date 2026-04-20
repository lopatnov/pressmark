using System.IdentityModel.Tokens.Jwt;
using System.Text;
using System.Threading.RateLimiting;
using Grpc.AspNetCore.Web;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Pressmark.Api.BackgroundServices;
using Pressmark.Api.Data;
using Pressmark.Api.Services;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// EF Core — AddDbContextFactory registers both IDbContextFactory<T> (singleton)
// and AppDbContext (scoped), so AddDbContext is not needed separately.
var connectionString = config.GetConnectionString("Default");
builder.Services.AddDbContextFactory<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

// gRPC
builder.Services.AddGrpc();

// JWT
builder.Services.AddSingleton<JwtService>();

// Real-time feed streaming
builder.Services.AddSingleton<FeedUpdateBroadcaster>();

// Email
builder.Services.AddDataProtection();
builder.Services.AddScoped<ISmtpPasswordProtector, SmtpPasswordProtector>();
builder.Services.AddScoped<IEmailService, SmtpEmailService>();

// Rate limiting — auth endpoints: 10 requests per minute per IP
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "anon",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
            }));
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// HTTP client (pooled — used by SubscriptionServiceImpl and RssFetcherService)
builder.Services.AddHttpClient("Pressmark", c =>
{
    c.DefaultRequestHeaders.UserAgent.ParseAdd("Pressmark/1.0");
});

var jwtSecret = config["Jwt:Secret"]
    ?? throw new InvalidOperationException("Jwt:Secret is required. Set it via env var or appsettings.");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ClockSkew = TimeSpan.Zero,
        };
        options.Events = new JwtBearerEvents
        {
            // Workaround: JwtBearerHandler in .NET 10 does not correctly strip the
            // "Bearer " prefix from the Authorization header on gRPC-web requests,
            // causing IDX14102. Validate manually and short-circuit via ctx.Success().
            OnMessageReceived = ctx =>
            {
                var auth = ctx.Request.Headers.Authorization.FirstOrDefault() ?? "";
                if (!auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                    return Task.CompletedTask;

                var token = auth["Bearer ".Length..].Trim();
                try
                {
                    var principal = new JwtSecurityTokenHandler()
                        .ValidateToken(token, ctx.Options.TokenValidationParameters, out _);
                    ctx.Principal = principal;
                    ctx.Success();
                }
                catch (Exception ex) { ctx.Fail(ex); }
                return Task.CompletedTask;
            },
        };
    });

builder.Services.AddAuthorization();

// CORS — AllowCredentials required for httpOnly refresh cookie on cross-origin Refresh calls
builder.Services.AddCors(o => o.AddPolicy("GrpcWeb", policy => policy
    .WithOrigins(config["Cors:AllowedOrigins"]!)
    .AllowAnyMethod()
    .AllowAnyHeader()
    .AllowCredentials()));

// RSS feed fetcher (shared between background scheduler and on-demand TriggerFetch)
builder.Services.AddSingleton<FeedFetcherService>();

// Background services
builder.Services.AddHostedService<RssFetcherService>();
builder.Services.AddHostedService<CleanupService>();
builder.Services.AddHostedService<DailyDigestService>();

var app = builder.Build();

// Auto-apply pending migrations on startup, retrying until the DB container is ready
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<AppDbContext>>();
    for (var attempt = 1; ; attempt++)
    {
        try
        {
            db.Database.Migrate();
            break;
        }
        catch (Exception ex) when (attempt < 10)
        {
            logger.LogWarning("DB not ready (attempt {Attempt}/10): {Message}. Retrying in 3s…", attempt, ex.Message);
            await Task.Delay(TimeSpan.FromSeconds(3));
        }
    }
}

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.MapGet("/api/meta", async (AppDbContext db, CancellationToken ct) =>
{
    var siteName = await db.SiteSettings
        .Where(s => s.Key == "site_name")
        .Select(s => s.Value)
        .FirstOrDefaultAsync(ct) ?? "Pressmark";
    return Results.Ok(new { siteName });
}).AllowAnonymous();

app.MapGet("/sitemap.xml", async (AppDbContext db, IConfiguration config, CancellationToken ct) =>
{
    var baseUrl = (config["App:BaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
    var settings = await db.SiteSettings
        .Where(s => s.Key == "registration_mode" || s.Key == "community_page_enabled")
        .ToDictionaryAsync(s => s.Key, s => s.Value, ct);

    var communityEnabled = settings.GetValueOrDefault("community_page_enabled", "true") == "true";
    var registrationOpen = settings.GetValueOrDefault("registration_mode", "open") == "open";

    var sb = new StringBuilder();
    sb.AppendLine("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    sb.AppendLine("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">");
    if (communityEnabled) sb.AppendLine($"  <url><loc>{baseUrl}/</loc></url>");
    sb.AppendLine($"  <url><loc>{baseUrl}/login</loc></url>");
    if (registrationOpen) sb.AppendLine($"  <url><loc>{baseUrl}/register</loc></url>");
    sb.AppendLine("</urlset>");

    return Results.Content(sb.ToString(), "application/xml");
}).AllowAnonymous();

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedFor,
});

app.UseCors("GrpcWeb");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.UseGrpcWeb(new GrpcWebOptions { DefaultEnabled = true });

app.MapGrpcService<AuthServiceImpl>().RequireRateLimiting("auth");
app.MapGrpcService<SubscriptionServiceImpl>();
app.MapGrpcService<FeedServiceImpl>();
app.MapGrpcService<AdminServiceImpl>();

app.MapGet("/proxy/favicon", async (string? url, IHttpClientFactory httpClientFactory, HttpContext ctx) =>
{
    if (string.IsNullOrWhiteSpace(url))
        return Results.NoContent();

    if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
        (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        return Results.NoContent();

    // Block loopback and private IP ranges to prevent SSRF
    var host = uri.Host.ToLowerInvariant();
    if (host is "localhost" or "127.0.0.1" or "::1" ||
        host.StartsWith("192.168.") || host.StartsWith("10.") || host.StartsWith("172."))
        return Results.NoContent();

    var faviconUrl = uri.GetLeftPart(UriPartial.Authority) + "/favicon.ico";

    try
    {
        var client = httpClientFactory.CreateClient("Pressmark");
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        using var response = await client.GetAsync(faviconUrl, cts.Token);

        if (!response.IsSuccessStatusCode)
            return Results.NoContent();

        var contentType = response.Content.Headers.ContentType?.MediaType ?? "";
        if (!contentType.StartsWith("image/"))
            return Results.NoContent();

        ctx.Response.Headers.CacheControl = "public, max-age=86400";
        var bytes = await response.Content.ReadAsByteArrayAsync(cts.Token);
        return Results.Bytes(bytes, contentType);
    }
    catch
    {
        return Results.NoContent();
    }
});

app.Run();
