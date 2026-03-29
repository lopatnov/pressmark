using Microsoft.AspNetCore.Authorization;
using Pressmark.Api.Services;

namespace Pressmark.Api.Tests;

/// <summary>
/// Regression test: verifies that [Authorize(Roles = "Admin")] has not been
/// accidentally removed from AdminServiceImpl. The ASP.NET Core middleware
/// enforces this attribute at the transport level — if it is stripped the
/// entire admin surface becomes publicly accessible to any authenticated user.
/// </summary>
public class AdminServiceAuthorizationTests
{
    [Fact]
    public void AdminServiceImpl_HasAuthorizeAttribute_WithAdminRole()
    {
        var attr = typeof(AdminServiceImpl)
            .GetCustomAttributes(typeof(AuthorizeAttribute), inherit: false)
            .Cast<AuthorizeAttribute>()
            .SingleOrDefault();

        Assert.NotNull(attr);
        Assert.Equal("Admin", attr.Roles);
    }

    [Fact]
    public void FeedServiceImpl_DoesNotHaveAdminRoleRestriction()
    {
        // FeedService is for all authenticated users — ensure it was never
        // accidentally restricted to Admin only.
        var attr = typeof(FeedServiceImpl)
            .GetCustomAttributes(typeof(AuthorizeAttribute), inherit: false)
            .Cast<AuthorizeAttribute>()
            .SingleOrDefault();

        // May have [Authorize] (no role) but must NOT have Roles = "Admin"
        Assert.True(attr is null || attr.Roles != "Admin");
    }
}
