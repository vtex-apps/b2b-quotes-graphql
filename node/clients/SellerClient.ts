import type { IOContext, InstanceOptions } from '@vtex/api'
import { JanusClient } from '@vtex/api'

export default class SellerClient extends JanusClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(context, {
      ...options,
      headers: {
        ...options?.headers,
        VtexIdclientAutcookie: context.authToken,
      },
    })
  }

  public async getSeller(sellerId: string) {
    return this.http.get<Seller>(`/api/seller-register/pvt/sellers/${sellerId}`)
  }
}
