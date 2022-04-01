import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

interface AuthenticatedUser {
  user: string
}

export default class VtexId extends ExternalClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('http://vtexid.vtex.com.br/api/', context, options)
  }

  public async getAuthenticatedUser(
    authToken: string
  ): Promise<AuthenticatedUser> {
    return this.http.get('vtexid/pub/authenticated/user/', {
      metric: 'authenticated-user-get',
      params: { authToken },
    })
  }
}
