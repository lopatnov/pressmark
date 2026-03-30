import { createClient } from '@connectrpc/connect'
import { transport } from './transport'
import { AuthService } from './generated/auth_pb'
import { FeedService } from './generated/feed_pb'
import { SubscriptionService } from './generated/subscription_pb'
import { AdminService } from './generated/admin_pb'

export const authClient = createClient(AuthService, transport)
export const feedClient = createClient(FeedService, transport)
export const subscriptionClient = createClient(SubscriptionService, transport)
export const adminClient = createClient(AdminService, transport)
