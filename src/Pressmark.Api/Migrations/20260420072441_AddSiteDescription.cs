using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pressmark.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSiteDescription : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "site_settings",
                columns: new[] { "key", "value" },
                values: new object[] { "site_description", "A self-hosted RSS reader and community feed" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "site_settings",
                keyColumn: "key",
                keyValue: "site_description");
        }
    }
}
