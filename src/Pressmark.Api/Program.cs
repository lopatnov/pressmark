using System.Text;
using Grpc.AspNetCore.Web;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Pressmark.Api.Data;
using Pressmark.Api.Services;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// EF Core
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(config.GetConnectionString("Default")));

// gRPC
builder.Services.AddGrpc();

// JWT authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(config["Jwt:Secret"]!)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

// CORS — AllowCredentials required for httpOnly refresh cookie on cross-origin Refresh calls
builder.Services.AddCors(o => o.AddPolicy("GrpcWeb", policy => policy
    .WithOrigins(config["Cors:AllowedOrigins"]!)
    .AllowAnyMethod()
    .AllowAnyHeader()
    .AllowCredentials()));

var app = builder.Build();

app.UseCors("GrpcWeb");
app.UseAuthentication();
app.UseAuthorization();
app.UseGrpcWeb(new GrpcWebOptions { DefaultEnabled = true });

app.MapGrpcService<AuthServiceImpl>();
app.MapGrpcService<SubscriptionServiceImpl>();
app.MapGrpcService<FeedServiceImpl>();
app.MapGrpcService<AdminServiceImpl>();

app.Run();
