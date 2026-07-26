using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Entities;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

/// <summary>
/// Account creation and sign-in.
/// </summary>
/// <remarks>
/// Split across partial files by sub-domain:
/// <list type="bullet">
/// <item>AuthServiceImpl.cs — registration, login and registration status (this file)</item>
/// <item>AuthServiceImpl.Session.cs — refresh-token rotation and logout</item>
/// <item>AuthServiceImpl.PasswordReset.cs — forgot/reset password</item>
/// </list>
/// Session establishment is delegated to <see cref="AuthTokenIssuer"/> and invite
/// handling to <see cref="InviteRedemptionService"/>.
/// </remarks>
public partial class AuthServiceImpl(
    AppDbContext db, JwtService jwt,
    IEmailService emailService, IConfiguration config,
    AuthTokenIssuer tokenIssuer, InviteRedemptionService invites) : AuthService.AuthServiceBase
{
    public override async Task<AuthResponse> Register(
        RegisterRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        if (!System.Net.Mail.MailAddress.TryCreate(request.Email, out _))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid email address"));
        if (request.Password.Length < 8)
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Password must be at least 8 characters"));

        var settings = await SiteSettingsSnapshot.LoadAsync(
            db, [SiteSettingKeys.RegistrationMode], ct);
        var mode = settings.RegistrationMode;
        var inviteOnly = mode == "invite_only";

        if (inviteOnly)
        {
            if (string.IsNullOrWhiteSpace(request.InviteToken))
                throw new RpcException(new Status(StatusCode.PermissionDenied,
                    "An invite token is required"));
        }
        else if (mode != "open")
            throw new RpcException(new Status(StatusCode.FailedPrecondition,
                "Registration is closed"));

        if (await db.Users.AnyAsync(u => u.Email == request.Email, ct))
            throw new RpcException(new Status(StatusCode.AlreadyExists,
                "Email already registered"));

        // Use a serializable transaction to prevent two concurrent registrations
        // from consuming the same invite token simultaneously.
        await using var tx = await db.Database.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, ct);

        if (inviteOnly)
            await invites.EnsureRedeemableAsync(request.InviteToken, ct);

        var isFirst = !await db.Users.AnyAsync(ct);

        var user = new User
        {
            Email = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = isFirst ? "Admin" : "User",
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        if (inviteOnly)
            await invites.RedeemAsync(request.InviteToken, user, ct);

        await tx.CommitAsync(ct);

        return await tokenIssuer.IssueAsync(user, context.GetHttpContext(), ct);
    }

    public override async Task<AuthResponse> Login(
        LoginRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email, ct);

        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new RpcException(new Status(StatusCode.Unauthenticated,
                "Invalid credentials"));

        if (user.IsSiteBanned)
            throw new RpcException(new Status(StatusCode.PermissionDenied, "account_banned"));

        return await tokenIssuer.IssueAsync(user, context.GetHttpContext(), ct);
    }

    [AllowAnonymous]
    [DisableRateLimiting]
    public override async Task<RegistrationStatus> GetRegistrationStatus(
        Empty request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var hasAdmin = await db.Users.AnyAsync(ct);
        var settings = await SiteSettingsSnapshot.LoadAsync(db, [
            SiteSettingKeys.RegistrationMode,
            SiteSettingKeys.CommunityWindowDays,
            SiteSettingKeys.CommentsEnabled,
            SiteSettingKeys.CommunityPageEnabled,
        ], ct);

        return new RegistrationStatus
        {
            HasAdmin = hasAdmin,
            RegistrationMode = settings.RegistrationMode,
            CommunityWindowDays = settings.CommunityWindowDays,
            CommentsEnabled = settings.CommentsEnabled,
            CommunityPageEnabled = settings.CommunityPageEnabled,
        };
    }
}
