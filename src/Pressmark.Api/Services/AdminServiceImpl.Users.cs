using System.Security.Claims;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

/// <summary>
/// User administration: listing, role changes, bans, deletion and the per-user
/// detail view. See AdminServiceImpl.cs for the primary constructor.
/// </summary>
public partial class AdminServiceImpl
{
    private const string UserIdField = "user_id";
    private const string UserNotFoundMessage = "User not found";

    public override async Task<UserList> ListUsers(ListUsersRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var (page, pageSize) = AdminPaging.Normalize(request.Page, request.PageSize);

        var query = db.Users.OrderBy(u => u.CreatedAt);
        var total = await query.CountAsync(ct);
        var users = await query
            .ToPage(page, pageSize)
            .AsNoTracking()
            .Select(AdminMapper.UserInfoProjection)
            .ToListAsync(ct);

        var result = new UserList { TotalCount = total };
        result.Users.AddRange(users);
        return result;
    }

    public override async Task<Empty> BanUserFromCommenting(
        BanUserFromCommentingRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var userId = RpcGuards.ParseId(request.UserId, UserIdField);

        var user = await db.Users.FindOrThrowAsync(userId, UserNotFoundMessage, ct);

        user.IsCommentingBanned = request.Banned;
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<Empty> SitebanUser(SitebanUserRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var userId = RpcGuards.ParseId(request.UserId, UserIdField);

        var user = await db.Users.FindOrThrowAsync(userId, UserNotFoundMessage, ct);

        user.IsSiteBanned = request.Banned;
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<Empty> DeleteUser(DeleteUserRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var userId = RpcGuards.ParseId(request.UserId, UserIdField);

        var callerIdStr = context.GetHttpContext().User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (callerIdStr != null && Guid.TryParse(callerIdStr, out var callerId) && callerId == userId)
            throw new RpcException(new Status(StatusCode.FailedPrecondition, "Cannot delete your own account"));

        var user = await db.Users.FindOrThrowAsync(userId, UserNotFoundMessage, ct);

        if (user.Role == UserRoles.Admin)
            await EnsureNotLastAdminAsync("Cannot delete the last admin", ct);

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // Manually delete entities with NoAction FK constraints
        await db.ReadItems.Where(r => r.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Likes.Where(l => l.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Bookmarks.Where(b => b.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Comments.Where(c => c.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Reports.Where(r => r.ReporterUserId == userId).ExecuteDeleteAsync(ct);

        db.Users.Remove(user);
        await db.SaveChangesAsync(ct);

        await tx.CommitAsync(ct);

        return new Empty();
    }

    public override async Task<Empty> ChangeUserRole(ChangeUserRoleRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var userId = RpcGuards.ParseId(request.UserId, UserIdField);

        if (request.Role != UserRoles.User && request.Role != UserRoles.Admin)
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Role must be 'User' or 'Admin'"));

        var user = await db.Users.FindOrThrowAsync(userId, UserNotFoundMessage, ct);

        if (user.Role == UserRoles.Admin && request.Role == UserRoles.User)
            await EnsureNotLastAdminAsync("Cannot demote the last admin", ct);

        user.Role = request.Role;
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<UserDetails> GetUserDetails(GetUserDetailsRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var userId = RpcGuards.ParseId(request.UserId, UserIdField);

        var user = await db.Users.FindOrThrowAsync(userId, UserNotFoundMessage, ct);

        var subscriptions = await db.Subscriptions
            .Where(s => s.UserId == userId)
            .OrderBy(s => s.Title)
            .AsNoTracking()
            .ToListAsync(ct);

        var comments = await db.Comments
            .Include(c => c.FeedItem)
            .Where(c => c.UserId == userId)
            .OrderByDescending(c => c.CreatedAt)
            .Take(50)
            .AsNoTracking()
            .ToListAsync(ct);

        var details = new UserDetails { User = AdminMapper.ToUserInfo(user) };
        details.Subscriptions.AddRange(subscriptions.Select(AdminMapper.ToUserSubscriptionInfo));
        details.Comments.AddRange(comments.Select(AdminMapper.ToUserCommentInfo));

        return details;
    }

    /// <summary>
    /// Blocks the last remaining admin from being demoted or deleted, which would
    /// leave the instance with no way to reach the admin surface.
    /// </summary>
    private async Task EnsureNotLastAdminAsync(string message, CancellationToken ct)
    {
        var adminCount = await db.Users.CountAsync(u => u.Role == UserRoles.Admin, ct);
        if (adminCount <= 1)
            throw new RpcException(new Status(StatusCode.FailedPrecondition, message));
    }
}
