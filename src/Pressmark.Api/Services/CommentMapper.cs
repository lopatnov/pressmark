namespace Pressmark.Api.Services;

/// <summary>
/// Maps article comments onto their protobuf representation.
/// Pure projection — no data access and no business rules.
/// </summary>
internal static class CommentMapper
{
    /// <summary>
    /// Projects a comment for an article's public thread. A comment removed by an admin
    /// keeps its place in the thread but discloses neither its author nor its text.
    /// </summary>
    /// <remarks>Expects <see cref="Entities.Comment.User"/> to be loaded.</remarks>
    internal static Protos.Comment ToProto(Entities.Comment comment) => new()
    {
        Id = comment.Id.ToString(),
        UserEmail = comment.RemovedByAdmin ? "" : comment.User.Email,
        Body = comment.RemovedByAdmin ? "" : comment.Body,
        CreatedAt = comment.CreatedAt.ToIsoUtc(),
        RemovedByAdmin = comment.RemovedByAdmin,
        IsCommentingBanned = !comment.RemovedByAdmin && comment.User.IsCommentingBanned,
    };
}
