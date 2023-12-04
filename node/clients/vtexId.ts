import type { InstanceOptions, IOContext } from '@vtex/api'
import { JanusClient } from '@vtex/api'

interface AuthenticatedUser {
  user: string
}

export default class VtexId extends JanusClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(context, {
      ...options,
      headers: {
        ...options?.headers,
        'x-vtex-user-agent': context.userAgent,
      },
    })
  }

  public async getAuthenticatedUser(
    authToken: string
  ): Promise<AuthenticatedUser> {
    return this.http.get('/api/vtexid/pub/authenticated/user/', {
      metric: 'authenticated-user-get',
      params: { authToken },
    })
  }
}
