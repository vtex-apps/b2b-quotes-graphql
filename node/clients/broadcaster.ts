import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

export default class Broadcaster extends ExternalClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(`http://app.io.vtex.com`, context, options)
  }

  public async sendCatalogNotifications(): Promise<unknown> {
    return this.http.post(
      `/vtex.broadcaster-worker/v0/${this.context.account}/${this.context.workspace}/index-routes`,
      null,
      {
        headers: {
          VtexIdclientAutCookie: `${this.context.authToken}`,
        },
        metric: 'broadcaster-post',
      }
    )
  }
}
