import { processQueue } from '../../utils/Queue'
import { getAppId } from '../../constants'

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
}
