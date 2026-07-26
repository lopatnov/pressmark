using Grpc.Core;
using Microsoft.EntityFrameworkCore;

namespace Pressmark.Api.Services;

/// <summary>
/// Request-validation helpers that turn malformed input and missing rows into the
/// gRPC status codes the API contract promises. Centralised so every endpoint
/// reports the same status and message shape.
/// </summary>
internal static class RpcGuards
{
    /// <summary>
    /// Parses an identifier supplied as a string, raising
    /// <see cref="StatusCode.InvalidArgument"/> as "Invalid {fieldName}" when it is malformed.
    /// </summary>
    /// <param name="fieldName">The proto field name, e.g. <c>user_id</c>.</param>
    internal static Guid ParseId(string value, string fieldName)
    {
        if (!Guid.TryParse(value, out var id))
            throw new RpcException(new Status(StatusCode.InvalidArgument, $"Invalid {fieldName}"));

        return id;
    }

    /// <summary>
    /// Loads an entity by primary key, raising <see cref="StatusCode.NotFound"/>
    /// with the supplied message when it does not exist.
    /// </summary>
    internal static async Task<T> FindOrThrowAsync<T>(
        this DbSet<T> set, Guid id, string notFoundMessage, CancellationToken ct)
        where T : class
        => await set.FindAsync([id], ct)
           ?? throw new RpcException(new Status(StatusCode.NotFound, notFoundMessage));
}
