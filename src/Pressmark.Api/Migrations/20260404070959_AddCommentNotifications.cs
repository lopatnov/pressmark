using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pressmark.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCommentNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "digest_enabled",
                table: "users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "last_digest_sent_at",
                table: "users",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "comment_subscriptions",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    feed_item_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_comment_subscriptions", x => new { x.user_id, x.feed_item_id });
                    table.ForeignKey(
                        name: "FK_comment_subscriptions_feed_items_feed_item_id",
                        column: x => x.feed_item_id,
                        principalTable: "feed_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_comment_subscriptions_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_comment_subscriptions_feed_item_id",
                table: "comment_subscriptions",
                column: "feed_item_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "comment_subscriptions");

            migrationBuilder.DropColumn(
                name: "digest_enabled",
                table: "users");

            migrationBuilder.DropColumn(
                name: "last_digest_sent_at",
                table: "users");
        }
    }
}
