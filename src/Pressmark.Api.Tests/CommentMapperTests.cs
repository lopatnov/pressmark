using Pressmark.Api.Entities;
using Pressmark.Api.Services;

namespace Pressmark.Api.Tests;

/// <summary>
/// A comment removed by an admin stays in the public thread as a placeholder, so the
/// projection is the only thing standing between the removed text (and its author)
/// and every anonymous reader of the article.
/// </summary>
public class CommentMapperTests
{
    private static Comment MakeComment(bool removed = false, bool authorBanned = false) => new()
    {
        Body = "Hello",
        RemovedByAdmin = removed,
        User = new User
        {
            Email = "author@example.com",
            PasswordHash = "x",
            IsCommentingBanned = authorBanned,
        },
    };

    [Fact]
    public void ToProto_VisibleComment_CarriesAuthorAndBody()
    {
        var proto = CommentMapper.ToProto(MakeComment());

        Assert.Equal("author@example.com", proto.UserEmail);
        Assert.Equal("Hello", proto.Body);
        Assert.False(proto.RemovedByAdmin);
    }

    [Fact]
    public void ToProto_RemovedComment_DisclosesNeitherAuthorNorBody()
    {
        var proto = CommentMapper.ToProto(MakeComment(removed: true, authorBanned: true));

        Assert.True(proto.RemovedByAdmin);
        Assert.Equal("", proto.UserEmail);
        Assert.Equal("", proto.Body);
        Assert.False(proto.IsCommentingBanned);
    }

    [Fact]
    public void ToProto_VisibleCommentByABannedAuthor_IsFlagged()
    {
        Assert.True(CommentMapper.ToProto(MakeComment(authorBanned: true)).IsCommentingBanned);
    }
}
