using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Entities;

namespace Pressmark.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<FeedItem> FeedItems => Set<FeedItem>();
    public DbSet<ReadItem> ReadItems => Set<ReadItem>();
    public DbSet<Like> Likes => Set<Like>();
    public DbSet<Bookmark> Bookmarks => Set<Bookmark>();
    public DbSet<SiteSetting> SiteSettings => Set<SiteSetting>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<InviteToken> InviteTokens => Set<InviteToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Users
        modelBuilder.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Email).IsUnique();
        });

        // Subscriptions
        modelBuilder.Entity<Subscription>(e =>
        {
            e.ToTable("subscriptions");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.UserId);
            e.HasOne(x => x.User)
                .WithMany(u => u.Subscriptions)
                .HasForeignKey(x => x.UserId);
        });

        // FeedItems
        modelBuilder.Entity<FeedItem>(e =>
        {
            e.ToTable("feed_items");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.SubscriptionId);
            e.HasIndex(x => new { x.PublishedAt, x.Id });  // cursor pagination
            e.HasOne(x => x.Subscription)
                .WithMany(s => s.FeedItems)
                .HasForeignKey(x => x.SubscriptionId);
        });

        // ReadItems (composite PK)
        modelBuilder.Entity<ReadItem>(e =>
        {
            e.ToTable("read_items");
            e.HasKey(x => new { x.UserId, x.FeedItemId });
            e.HasIndex(x => x.UserId);
            // NoAction on User side: MSSQL disallows multiple cascade paths
            // (User→Subscription→FeedItem→ReadItem already cascades via feed_item_id)
            e.HasOne(x => x.User)
                .WithMany(u => u.ReadItems)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.FeedItem)
                .WithMany(f => f.ReadItems)
                .HasForeignKey(x => x.FeedItemId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Likes (composite PK)
        modelBuilder.Entity<Like>(e =>
        {
            e.ToTable("likes");
            e.HasKey(x => new { x.UserId, x.FeedItemId });
            e.HasIndex(x => x.FeedItemId);   // count likes per item
            e.HasIndex(x => x.CreatedAt);    // time window filter for community feed
            // NoAction on User side: MSSQL disallows multiple cascade paths
            e.HasOne(x => x.User)
                .WithMany(u => u.Likes)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.FeedItem)
                .WithMany(f => f.Likes)
                .HasForeignKey(x => x.FeedItemId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Bookmarks (composite PK)
        modelBuilder.Entity<Bookmark>(e =>
        {
            e.ToTable("bookmarks");
            e.HasKey(x => new { x.UserId, x.FeedItemId });
            e.HasIndex(x => x.UserId);
            // NoAction on User side: MSSQL disallows multiple cascade paths
            e.HasOne(x => x.User)
                .WithMany(u => u.Bookmarks)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.FeedItem)
                .WithMany(f => f.Bookmarks)
                .HasForeignKey(x => x.FeedItemId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // RefreshTokens
        modelBuilder.Entity<RefreshToken>(e =>
        {
            e.ToTable("refresh_tokens");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.UserId, x.ExpiresAt });
            e.HasIndex(x => x.TokenHash);
            e.HasOne(x => x.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // InviteTokens
        modelBuilder.Entity<InviteToken>(e =>
        {
            e.ToTable("invite_tokens");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Token).IsUnique();
        });

        // PasswordResetTokens
        modelBuilder.Entity<PasswordResetToken>(e =>
        {
            e.ToTable("password_reset_tokens");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.TokenHash);
            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // SiteSettings
        modelBuilder.Entity<SiteSetting>(e =>
        {
            e.ToTable("site_settings");
            e.HasKey(x => x.Key);
        });

        // Seed SiteSettings
        modelBuilder.Entity<SiteSetting>().HasData(
            new SiteSetting { Key = "site_name", Value = "Pressmark" },
            new SiteSetting { Key = "community_window_days", Value = "1" },
            new SiteSetting { Key = "registration_mode", Value = "open" }
        );
    }
}
