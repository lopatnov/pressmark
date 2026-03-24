using Grpc.Core;
using Pressmark.Api.Protos;
using Google.Protobuf.WellKnownTypes;

namespace Pressmark.Api.Services;

public class SubscriptionServiceImpl : SubscriptionService.SubscriptionServiceBase
{
    public override Task<Subscription> AddSubscription(AddSubscriptionRequest request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 2"));

    public override Task<Empty> RemoveSubscription(RemoveSubscriptionRequest request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 2"));

    public override Task<SubscriptionList> ListSubscriptions(Empty request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 2"));
}
