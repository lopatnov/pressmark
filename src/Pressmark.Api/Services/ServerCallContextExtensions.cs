using System.Security.Claims;
using Grpc.Core;

namespace Pressmark.Api.Services;

/// <summary>
/// Resolves the calling user from the gRPC call context. Shared by every service
/// implementation so the claim name and the unauthenticated status stay consistent.
/// </summary>
internal static class ServerCallContextExtensions
{
    /// <summary>
    /// Returns the authenticated caller's id, throwing <see cref="RpcException"/>
    /// with <see cref="StatusCode.Unauthenticated"/> when no identity is present.
    /// </summary>
    internal static Guid GetUserId(this ServerCallContext context)
    {
        var claim = context.GetHttpContext()
            .User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (claim is null)
            throw new RpcException(new Status(StatusCode.Unauthenticated, "Not authenticated"));

        return Guid.Parse(claim);
    }

    /// <summary>
    /// Returns the caller's id when the call carries a valid identity, or <c>null</c>
    /// for anonymous callers. Used by <c>[AllowAnonymous]</c> endpoints that still
    /// personalise their response when a user happens to be signed in.
    /// </summary>
    internal static Guid? TryGetUserId(this ServerCallContext context)
    {
        var claim = context.GetHttpContext()
            .User.FindFirstValue(ClaimTypes.NameIdentifier);

        return claim != null && Guid.TryParse(claim, out var userId) ? userId : null;
    }
}
