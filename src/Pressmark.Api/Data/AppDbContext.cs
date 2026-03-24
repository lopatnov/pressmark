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
            e.HasOne(x => x.User)
                .WithMany(u => u.ReadItems)
                .HasForeignKey(x => x.UserId);
            e.HasOne(x => x.FeedItem)
                .WithMany(f => f.ReadItems)
                .HasForeignKey(x => x.FeedItemId);
        });

        // Likes (composite PK)
        modelBuilder.Entity<Like>(e =>
        {
            e.ToTable("likes");
            e.HasKey(x => new { x.UserId, x.FeedItemId });
            e.HasIndex(x => x.FeedItemId);   // count likes per item
            e.HasIndex(x => x.CreatedAt);    // time window filter for community feed
            e.HasOne(x => x.User)
                .WithMany(u => u.Likes)
                .HasForeignKey(x => x.UserId);
            e.HasOne(x => x.FeedItem)
                .WithMany(f => f.Likes)
                .HasForeignKey(x => x.FeedItemId);
        });

        // Bookmarks (composite PK)
        modelBuilder.Entity<Bookmark>(e =>
        {
            e.ToTable("bookmarks");
            e.HasKey(x => new { x.UserId, x.FeedItemId });
            e.HasIndex(x => x.UserId);
            e.HasOne(x => x.User)
                .WithMany(u => u.Bookmarks)
                .HasForeignKey(x => x.UserId);
            e.HasOne(x => x.FeedItem)
                .WithMany(f => f.Bookmarks)
                .HasForeignKey(x => x.FeedItemId);
        });

        // SiteSettings
        modelBuilder.Entity<SiteSetting>(e =>
        {
            e.ToTable("site_settings");
            e.HasKey(x => x.Key);
        });

        // Seed SiteSettings
        modelBuilder.Entity<SiteSetting>().HasData(
            new SiteSetting { Key = "site_name",             Value = "Pressmark" },
            new SiteSetting { Key = "community_window_days", Value = "1" },
            new SiteSetting { Key = "registration_mode",     Value = "open" }
        );
    }
}
