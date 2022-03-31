import type { InstanceOptions, IOContext } from '@vtex/api'
import { JanusClient } from '@vtex/api'

export default class HostClient extends JanusClient {
  private readonly ctx: IOContext
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, {
      ...options,
      headers: {
        ...(ctx.adminUserAuthToken
          ? {
              VtexIdclientAutCookie: ctx.adminUserAuthToken,
            }
          : {}),
      },
    })
    this.ctx = ctx
  }

  public getHost = async (): Promise<any> => {
    const { account, workspace } = this.ctx
    const link = `http://${workspace}--${account}.myvtex.com/b2b-quotes-graphql/_v/0/host`

    return this.http.get(link)
  }
}
