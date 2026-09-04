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
using Pressmark.Api.Endpoints;
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

// Auth collaborators (scoped — wrap the request's AppDbContext)
builder.Services.AddScoped<AuthTokenIssuer>();
builder.Services.AddScoped<InviteRedemptionService>();

// Real-time feed streaming
builder.Services.AddSingleton<FeedUpdateBroadcaster>();

// Feed response assembly (scoped — wraps the request's AppDbContext)
builder.Services.AddScoped<FeedPageAssembler>();

// Comment notification fan-out (runs detached from the request; creates its own scope)
builder.Services.AddSingleton<CommentNotificationService>();

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
    // Favicon proxy: unauthenticated and does an outbound fetch per request, so it's
    // an easy DoS/amplification target without its own limit. A single page can
    // legitimately request a few dozen distinct favicons (one per feed-item source),
    // so the window is looser than "auth" but still capped per IP.
    options.AddPolicy(FaviconProxyEndpoint.RateLimitPolicyName, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "anon",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 5,
            }));
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// HTTP client (pooled — used by FeedFetcherService for RSS/OPML fetches, which
// legitimately need to follow redirects; kept separate from the favicon proxy's
// client so that client's stricter SSRF/redirect rules can't affect this one).
builder.Services.AddHttpClient("Pressmark", c =>
{
    c.DefaultRequestHeaders.UserAgent.ParseAdd("Pressmark/1.0");
});

// HTTP client + SSRF defenses dedicated to the favicon proxy (see Endpoints/FaviconProxyEndpoint.cs).
builder.Services.AddFaviconProxyHttpClient();

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
var allowedOrigins = config["Cors:AllowedOrigins"];
if (string.IsNullOrWhiteSpace(allowedOrigins))
    throw new InvalidOperationException("Cors:AllowedOrigins is required. Set it via env var or appsettings.");
builder.Services.AddCors(o => o.AddPolicy("GrpcWeb", policy => policy
    .WithOrigins(allowedOrigins)
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

await app.MigrateDatabaseAsync();

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.MapSeoEndpoints();

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

app.MapFaviconProxy();

await app.RunAsync();
