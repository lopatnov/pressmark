using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Grpc.AspNetCore.Web;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Pressmark.Api.BackgroundServices;
using Pressmark.Api.Data;
using Pressmark.Api.Services;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// EF Core
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(config.GetConnectionString("Default")));

// gRPC
builder.Services.AddGrpc();

// JWT
builder.Services.AddSingleton<JwtService>();

// Real-time feed streaming
builder.Services.AddSingleton<FeedUpdateBroadcaster>();

// Email
builder.Services.AddScoped<IEmailService, SmtpEmailService>();

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

var app = builder.Build();

// Auto-apply pending migrations on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.UseCors("GrpcWeb");
app.UseAuthentication();
app.UseAuthorization();
app.UseGrpcWeb(new GrpcWebOptions { DefaultEnabled = true });

app.MapGrpcService<AuthServiceImpl>();
app.MapGrpcService<SubscriptionServiceImpl>();
app.MapGrpcService<FeedServiceImpl>();
app.MapGrpcService<AdminServiceImpl>();

app.Run();
