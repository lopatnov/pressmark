using Grpc.Core;
using Pressmark.Api.Protos;
using Google.Protobuf.WellKnownTypes;

namespace Pressmark.Api.Services;

public class AuthServiceImpl : AuthService.AuthServiceBase
{
    public override Task<AuthResponse> Register(RegisterRequest request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 2"));

    public override Task<AuthResponse> Login(LoginRequest request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 2"));

    public override Task<AuthResponse> Refresh(RefreshRequest request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 2"));

    public override Task<Empty> Logout(Empty request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 2"));
}
