using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pressmark.Api.Migrations
{
    /// <inheritdoc />
    public partial class InviteTokenExpiry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "is_revoked",
                table: "invite_tokens");

            migrationBuilder.RenameColumn(
                name: "revoked_at",
                table: "invite_tokens",
                newName: "expires_at");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "expires_at",
                table: "invite_tokens",
                newName: "revoked_at");

            migrationBuilder.AddColumn<bool>(
                name: "is_revoked",
                table: "invite_tokens",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }
    }
}
