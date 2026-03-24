using Grpc.Core;
using Pressmark.Api.Protos;
using Google.Protobuf.WellKnownTypes;

namespace Pressmark.Api.Services;

public class FeedServiceImpl : FeedService.FeedServiceBase
{
    public override Task<FeedPage> GetFeed(GetFeedRequest request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 2"));

    public override Task<FeedPage> GetCommunityFeed(GetCommunityFeedRequest request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 3"));

    public override Task<Empty> MarkAsRead(MarkAsReadRequest request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 3"));

    public override Task<Empty> MarkAllAsRead(MarkAllAsReadRequest request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 3"));

    public override Task<UnreadCount> GetUnreadCount(Empty request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 3"));

    public override Task<ToggleLikeResponse> ToggleLike(ToggleLikeRequest request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 3"));

    public override Task<ToggleBookmarkResponse> ToggleBookmark(ToggleBookmarkRequest request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 3"));

    public override Task<FeedPage> GetBookmarks(GetBookmarksRequest request, ServerCallContext context)
        => throw new RpcException(new Status(StatusCode.Unimplemented, "Phase 3"));
}
