import { createClient } from '@connectrpc/connect'
import { transport } from './transport'
import { AuthService } from './generated/auth_connect'
import { FeedService } from './generated/feed_connect'
import { SubscriptionService } from './generated/subscription_connect'
import { AdminService } from './generated/admin_connect'

export const authClient        = createClient(AuthService, transport)
export const feedClient        = createClient(FeedService, transport)
export const subscriptionClient = createClient(SubscriptionService, transport)
export const adminClient       = createClient(AdminService, transport)
