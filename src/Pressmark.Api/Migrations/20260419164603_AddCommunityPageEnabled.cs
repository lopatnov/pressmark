using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pressmark.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCommunityPageEnabled : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "site_settings",
                columns: new[] { "key", "value" },
                values: new object[] { "community_page_enabled", "true" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "site_settings",
                keyColumn: "key",
                keyValue: "community_page_enabled");
        }
    }
}
