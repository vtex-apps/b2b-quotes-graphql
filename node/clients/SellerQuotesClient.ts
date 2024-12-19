import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

const SELLER_CLIENT_OPTIONS: InstanceOptions = {
  retries: 5,
  timeout: 5000,
  exponentialTimeoutCoefficient: 2,
  exponentialBackoffCoefficient: 2,
  initialBackoffDelay: 100,
}

const BASE_PATH = 'b2b-seller-quotes/_v/0'

const ROUTES = {
  verifyQuoteSettings: 'verify-quote-settings',
  notifyNewQuote: 'notify-new-quote',
}

export default class SellerQuotesClient extends ExternalClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super('', ctx, {
      ...options,
      ...SELLER_CLIENT_OPTIONS,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        VtexIdclientAutCookie: ctx.authToken,
      },
    })
  }

  private getRoute(sellerAccount: string, path: string) {
    const subdomain = this.context.production
      ? sellerAccount
      : `${this.context.workspace}--${sellerAccount}`

    return `http://${subdomain}.myvtex.com/${BASE_PATH}/${path}`
  }

  public async verifyQuoteSettings(sellerAccount: string) {
    return this.http.get<VerifyQuoteSettingsResponse>(
      this.getRoute(sellerAccount, ROUTES.verifyQuoteSettings)
    )
  }

  public async notifyNewQuote(
    sellerAccount: string,
    quoteId: string,
    creationDate: string
  ) {
    const payload: SellerQuoteNotifyInput = {
      quoteId,
      creationDate,
      marketplaceAccount: this.context.account,
    }

    return this.http.postRaw(
      this.getRoute(sellerAccount, ROUTES.notifyNewQuote),
      payload
    )
  }
}
