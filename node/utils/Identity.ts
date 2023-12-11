import type { InstanceOptions, IOContext } from '@vtex/api'
import { JanusClient } from '@vtex/api'

export default class Identity extends JanusClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, {
      ...options,
      headers: {
        ...options?.headers,
      },
    })
  }

  public async validateToken(token: string): Promise<any> {
    return this.http.post('/api/vtexid/credential/validate', { token })
  }

  public async getToken({
    appkey,
    apptoken,
  }: {
    appkey: string
    apptoken: string
  }): Promise<any> {
    return this.http.post('/api/vtexid/apptoken/login', { appkey, apptoken })
  }
}
