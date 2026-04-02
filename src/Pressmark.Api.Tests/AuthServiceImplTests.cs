using System.Security.Cryptography;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;
using Pressmark.Api.Data;
using Pressmark.Api.Entities;
using Pressmark.Api.Protos;
using Pressmark.Api.Services;
using Xunit;

namespace Pressmark.Api.Tests;

public class AuthServiceImplTests
{
    private readonly Mock<AppDbContext> _dbMock;
    private readonly Mock<JwtService> _jwtMock;
    private readonly Mock<IEmailService> _emailServiceMock;
    private readonly Mock<IConfiguration> _configMock;
    private readonly Mock<IHttpContextAccessor> _httpContextAccessorMock;
    private readonly AuthServiceImpl _authService;

    public AuthServiceImplTests()
    {
        _dbMock = new Mock<AppDbContext>(new DbContextOptions<AppDbContext>());
        _jwtMock = new Mock<JwtService>(Mock.Of<IConfiguration>());
        _emailServiceMock = new Mock<IEmailService>();
        _configMock = new Mock<IConfiguration>();
        _httpContextAccessorMock = new Mock<IHttpContextAccessor>();

        _authService = new AuthServiceImpl(
            _dbMock.Object,
            _jwtMock.Object,
            _emailServiceMock.Object,
            _configMock.Object);
    }

    #region Register Tests

    [Fact]
    public async Task Register_InvalidEmail_ThrowsRpcException()
    {
        // Arrange
        var request = new RegisterRequest
        {
            Email = "invalid-email",
            Password = "password123"
        };

        var context = CreateMockServerCallContext();

        // Act & Assert
        var ex = await Assert.ThrowsAsync<RpcException>(() => 
            _authService.Register(request, context));
        
        Assert.Equal(StatusCode.InvalidArgument, ex.StatusCode);
        Assert.Contains("Invalid email address", ex.Status.Detail);
    }

    [Fact]
    public async Task Register_PasswordTooShort_ThrowsRpcException()
    {
        // Arrange
        var request = new RegisterRequest
        {
            Email = "test@example.com",
            Password = "short"
        };

        var context = CreateMockServerCallContext();

        // Act & Assert
        var ex = await Assert.ThrowsAsync<RpcException>(() => 
            _authService.Register(request, context));
        
        Assert.Equal(StatusCode.InvalidArgument, ex.StatusCode);
        Assert.Contains("8 characters", ex.Status.Detail);
    }

    [Fact]
    public async Task Register_EmailAlreadyExists_ThrowsRpcException()
    {
        // Arrange
        var email = "existing@example.com";
        var request = new RegisterRequest
        {
            Email = email,
            Password = "password123"
        };

        var context = CreateMockServerCallContext();

        var usersMock = new Mock<DbSet<User>>();
        usersMock.Setup(m => m.AnyAsync(It.IsAny<System.Linq.Expressions.Expression<Func<User, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _dbMock.Setup(d => d.Users).Returns(usersMock.Object);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<RpcException>(() => 
            _authService.Register(request, context));
        
        Assert.Equal(StatusCode.AlreadyExists, ex.StatusCode);
        Assert.Contains("already registered", ex.Status.Detail);
    }

    [Fact]
    public async Task Register_RegistrationClosed_ThrowsRpcException()
    {
        // Arrange
        var request = new RegisterRequest
        {
            Email = "test@example.com",
            Password = "password123"
        };

        var context = CreateMockServerCallContext();

        _configMock.Setup(c => c["Jwt:Secret"]).Returns("super-secret-key-that-is-long-enough-for-hmac");
        var jwtService = new JwtService(_configMock.Object);
        _jwtMock.Setup(j => j.GenerateAccessToken(It.IsAny<User>())).Returns("access_token");
        _jwtMock.Setup(j => j.GenerateRefreshToken(It.IsAny<User>())).Returns("refresh_token");

        var settingsMock = new Mock<DbSet<SiteSetting>>();
        var settingsQueryMock = new Mock<IQueryable<SiteSetting>>();
        settingsQueryMock.As<IQueryable<SiteSetting>>()
            .Setup(m => m.Provider)
            .Returns(new TestAsyncQueryProvider<SiteSetting>(new List<SiteSetting>
            {
                new() { Key = "registration_mode", Value = "closed" }
            }.AsQueryable().Provider));
        
        settingsQueryMock.As<IQueryable<SiteSetting>>()
            .Setup(m => m.Expression)
            .Returns(new List<SiteSetting>().AsQueryable().Expression);
        
        settingsQueryMock.As<IQueryable<SiteSetting>>()
            .Setup(m => m.ElementType)
            .Returns(typeof(SiteSetting));
        
        settingsQueryMock.As<IQueryable<SiteSetting>>()
            .Setup(m => m.GetEnumerator())
            .Returns(new List<SiteSetting>
            {
                new() { Key = "registration_mode", Value = "closed" }
            }.GetEnumerator());

        _dbMock.Setup(d => d.SiteSettings).Returns(settingsMock.Object);
        _dbMock.Setup(d => d.SiteSettings.Where(It.IsAny<System.Linq.Expressions.Expression<Func<SiteSetting, bool>>>()))
            .Returns(settingsQueryMock.Object);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<RpcException>(() => 
            _authService.Register(request, context));
        
        Assert.Equal(StatusCode.FailedPrecondition, ex.StatusCode);
        Assert.Contains("Registration is closed", ex.Status.Detail);
    }

    #endregion

    #region Login Tests

    [Fact]
    public async Task Login_InvalidEmail_ThrowsRpcException()
    {
        // Arrange
        var request = new LoginRequest
        {
            Email = "invalid-email",
            Password = "password123"
        };

        var context = CreateMockServerCallContext();

        // Act & Assert
        var ex = await Assert.ThrowsAsync<RpcException>(() => 
            _authService.Login(request, context));
        
        Assert.Equal(StatusCode.InvalidArgument, ex.StatusCode);
        Assert.Contains("Invalid email address", ex.Status.Detail);
    }

    [Fact]
    public async Task Login_UserNotFound_ThrowsRpcException()
    {
        // Arrange
        var request = new LoginRequest
        {
            Email = "notfound@example.com",
            Password = "password123"
        };

        var context = CreateMockServerCallContext();

        var usersMock = new Mock<DbSet<User>>();
        usersMock.Setup(m => m.FirstOrDefaultAsync(It.IsAny<System.Linq.Expressions.Expression<Func<User, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        _dbMock.Setup(d => d.Users).Returns(usersMock.Object);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<RpcException>(() => 
            _authService.Login(request, context));
        
        Assert.Equal(StatusCode.NotFound, ex.StatusCode);
        Assert.Contains("Invalid credentials", ex.Status.Detail);
    }

    [Fact]
    public async Task Login_WrongPassword_ThrowsRpcException()
    {
        // Arrange
        var request = new LoginRequest
        {
            Email = "test@example.com",
            Password = "wrongpassword"
        };

        var context = CreateMockServerCallContext();

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "test@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("correctpassword"),
            Role = "User",
            CreatedAt = DateTime.UtcNow
        };

        var usersMock = new Mock<DbSet<User>>();
        usersMock.Setup(m => m.FirstOrDefaultAsync(It.IsAny<System.Linq.Expressions.Expression<Func<User, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        _dbMock.Setup(d => d.Users).Returns(usersMock.Object);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<RpcException>(() => 
            _authService.Login(request, context));
        
        Assert.Equal(StatusCode.Unauthenticated, ex.StatusCode);
        Assert.Contains("Invalid credentials", ex.Status.Detail);
    }

    #endregion

    #region RefreshToken Tests

    [Fact]
    public async Task RefreshToken_MissingRefreshToken_ThrowsRpcException()
    {
        // Arrange
        var request = new RefreshTokenRequest();

        var context = CreateMockServerCallContext();

        // Act & Assert
        var ex = await Assert.ThrowsAsync<RpcException>(() => 
            _authService.RefreshToken(request, context));
        
        Assert.Equal(StatusCode.Unauthenticated, ex.StatusCode);
        Assert.Contains("Refresh token is required", ex.Status.Detail);
    }

    [Fact]
    public async Task RefreshToken_InvalidRefreshToken_ThrowsRpcException()
    {
        // Arrange
        var request = new RefreshTokenRequest
        {
            RefreshToken = "invalid-token"
        };

        var context = CreateMockServerCallContext();

        _jwtMock.Setup(j => j.ValidateRefreshToken("invalid-token")).Returns((ClaimsPrincipal?)null);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<RpcException>(() => 
            _authService.RefreshToken(request, context));
        
        Assert.Equal(StatusCode.Unauthenticated, ex.StatusCode);
        Assert.Contains("Invalid refresh token", ex.Status.Detail);
    }

    #endregion

    #region ResetPassword Tests

    [Fact]
    public async Task ResetPasswordRequest_InvalidEmail_ThrowsRpcException()
    {
        // Arrange
        var request = new ResetPasswordRequestRequest
        {
            Email = "invalid-email"
        };

        var context = CreateMockServerCallContext();

        // Act & Assert
        var ex = await Assert.ThrowsAsync<RpcException>(() => 
            _authService.ResetPasswordRequest(request, context));
        
        Assert.Equal(StatusCode.InvalidArgument, ex.StatusCode);
        Assert.Contains("Invalid email address", ex.Status.Detail);
    }

    #endregion

    private static ServerCallContext CreateMockServerCallContext()
    {
        var mock = new Mock<ServerCallContext>();
        mock.Setup(c => c.CancellationToken).Returns(CancellationToken.None);
        return mock.Object;
    }
}

/// <summary>
/// Test helper for async query provider
/// </summary>
public class TestAsyncQueryProvider<T> : IAsyncQueryProvider
{
    private readonly IQueryProvider _inner;

    public TestAsyncQueryProvider(IQueryProvider inner)
    {
        _inner = inner;
    }

    public IQueryable CreateQuery(Expression expression)
    {
        return new TestAsyncEnumerable<T>(expression);
    }

    public IQueryable<TElement> CreateQuery<TElement>(Expression expression)
    {
        return new TestAsyncEnumerable<TElement>(expression);
    }

    public object? Execute(Expression expression)
    {
        return _inner.Execute(expression);
    }

    public TResult Execute<TResult>(Expression expression)
    {
        return _inner.Execute<TResult>(expression);
    }

    public Task<object?> ExecuteAsync(Expression expression, CancellationToken cancellationToken)
    {
        return Task.FromResult(Execute(expression));
    }

    public Task<TResult> ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken)
    {
        return Task.FromResult(Execute<TResult>(expression));
    }
}

public class TestAsyncEnumerable<T> : EnumerableQuery<T>, IAsyncEnumerable<T>, IQueryable<T>
{
    public TestAsyncEnumerable(IEnumerable<T> enumerable)
        : base(enumerable) { }

    public TestAsyncEnumerable(Expression expression)
        : base(expression) { }

    public IAsyncEnumerator<T> GetEnumerator()
    {
        return new TestAsyncEnumerator<T>(this.AsEnumerable().GetEnumerator());
    }

    public IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default)
    {
        return new TestAsyncEnumerator<T>(this.AsEnumerable().GetEnumerator());
    }

    IQueryProvider IQueryable.Provider => new TestAsyncQueryProvider<T>(this);
}

public class TestAsyncEnumerator<T> : IAsyncEnumerator<T>
{
    private readonly IEnumerator<T> _inner;

    public TestAsyncEnumerator(IEnumerator<T> inner)
    {
        _inner = inner;
    }

    public T Current => _inner.Current;

    public ValueTask<bool> MoveNextAsync()
    {
        return new ValueTask<bool>(_inner.MoveNext());
    }

    public ValueTask DisposeAsync()
    {
        _inner.Dispose();
        return new ValueTask();
    }
}
