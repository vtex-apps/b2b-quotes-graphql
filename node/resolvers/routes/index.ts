import { method } from '@vtex/api'

import { getAppId } from '../../constants'
import { processQueue } from '../../utils/Queue'
import { getSellerQuote } from './seller/getSellerQuote'
import { getSellerQuotesPaginated } from './seller/getSellerQuotesPaginated'
import { saveSellerQuote } from './seller/saveSellerQuote'
import {
  setSellerResponseMetadata,
  validateSellerRequest,
} from './seller/utils'

function createSellerHandlers(
  mainHandler: (ctx: Context, next: NextFn) => Promise<void>
) {
  return [validateSellerRequest, mainHandler, setSellerResponseMetadata]
}

export const Routes = {
  host: async (ctx: Context) => {
    ctx.set('Content-Type', 'application/json')
    ctx.set('Cache-Control', 'no-cache, no-store')
    ctx.response.body = {
      host: ctx.vtex.host,
    }
  },
  queueHandler: async (ctx: Context) => {
    const date = new Date().toISOString()

    processQueue(ctx)
    ctx.set('Content-Type', 'application/json')
    ctx.set('Cache-Control', 'no-cache, no-store')
    ctx.response.body = { date, appId: getAppId() }
    ctx.response.status = 200
  },
  getSellerQuote: method({
    GET: createSellerHandlers(getSellerQuote),
  }),
  getSellerQuotesPaginated: method({
    GET: createSellerHandlers(getSellerQuotesPaginated),
  }),
  saveSellerQuote: method({
    POST: createSellerHandlers(saveSellerQuote),
  }),
}
