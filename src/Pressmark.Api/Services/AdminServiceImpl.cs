using Grpc.Core;
using Pressmark.Api.Protos;
using Google.Protobuf.WellKnownTypes;

namespace Pressmark.Api.Services;

public class AdminServiceImpl : AdminService.AdminServiceBase
{
    public override Task<SiteSettings> GetSiteSettings(Empty request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 3"));

    public override Task<Empty> UpdateSiteSettings(UpdateSiteSettingsRequest request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 3"));

    public override Task<Empty> HideFeedItem(HideFeedItemRequest request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 3"));

    public override Task<Empty> BanSubscription(BanSubscriptionRequest request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 3"));

    public override Task<UserList> ListUsers(Empty request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 3"));
}
