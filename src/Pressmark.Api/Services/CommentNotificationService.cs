using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;

namespace Pressmark.Api.Services;

/// <summary>
/// Fans out "new comment" emails to everyone watching an article.
/// Runs detached from the request that triggered it, so it creates its own
/// service scope rather than borrowing the request's <see cref="AppDbContext"/>,
/// and swallows delivery failures — a bad mailbox must never fail the comment.
/// </summary>
public class CommentNotificationService(
    IServiceScopeFactory scopeFactory,
    IConfiguration config,
    ILogger<CommentNotificationService> logger)
{
    /// <summary>
    /// Notifies every subscriber of the article except the commenter themselves.
    /// </summary>
    public async Task NotifySubscribersAsync(
        Guid feedItemId, string commenterEmail, string articleTitle, string commentBody)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var scopedDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

            // No Include: the projection selects the email, so EF Core would ignore it.
            var subscribers = await scopedDb.CommentSubscriptions
                .AsNoTracking()
                .Where(s => s.FeedItemId == feedItemId && s.User.Email != commenterEmail)
                .Select(s => s.User.Email)
                .ToListAsync();

            var baseUrl = config["App:BaseUrl"] ?? "http://localhost:5173";
            var articlePageUrl = $"{baseUrl.TrimEnd('/')}/article/{feedItemId}";

            foreach (var email in subscribers)
            {
                try
                {
                    await emailService.SendCommentNotificationAsync(
                        email, commenterEmail, articleTitle, articlePageUrl, commentBody,
                        CancellationToken.None);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Failed to send comment notification to a subscriber");
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error in NotifySubscribersAsync for feed item {FeedItemId}", feedItemId);
        }
    }
}
