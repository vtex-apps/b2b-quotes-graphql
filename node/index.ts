import type {
  ClientsConfig,
  EventContext,
  IOContext,
  ParamsContext,
  RecorderState,
  ServiceContext,
} from '@vtex/api'
import { LRUCache, Service } from '@vtex/api'

import { Clients } from './clients'
import { orderHandler } from './middlewares/order'
import { resolvers } from './resolvers'
import { schemaDirectives } from './resolvers/directives'
import type SellerQuotesController from './resolvers/utils/sellerQuotesController'

const TIMEOUT_MS = 5000

// Create a LRU memory cache for the Status client.
// The @vtex/api HttpClient respects Cache-Control headers and uses the provided cache.
const memoryCache = new LRUCache<string, any>({ max: 5000 })

metrics.trackCache('status', memoryCache)

// This is the configuration for clients available in `ctx.clients`.
const clients: ClientsConfig<Clients> = {
  // We pass our custom implementation of the clients bag, containing the Status client.
  implementation: Clients,
  options: {
    // All IO Clients will be initialized with these options, unless otherwise specified.
    default: {
      retries: 2,
      timeout: TIMEOUT_MS,
    },
    // This key will be merged with the default options and add this cache to our Status client.
    status: {
      memoryCache,
    },
  },
}

declare global {
  // We declare a global Context type just to avoid re-writing ServiceContext<Clients, State> in every handler and resolver
  type Context = ServiceContext<Clients> & {
    vtex: IOContext & {
      sellerQuotesController?: SellerQuotesController
    }
  }

  type NextFn = () => Promise<unknown>

  // The shape of our State object found in `ctx.state`. This is used as state bag to communicate between middlewares.
  interface State {
    code: number
  }
  type EventBroadcastContext = EventContext<Clients, RecorderState>
}
// Export a service that defines route handlers and client options.
export default new Service<Clients, RecorderState, ParamsContext>({
  clients,
  events: {
    broadcasterOrder: [orderHandler],
  },
  graphql: {
    resolvers: {
      Mutation: resolvers.Mutation,
      Query: resolvers.Query,
      Quote: resolvers.Quote,
    },
    schemaDirectives,
  },
  routes: resolvers.Routes,
})
