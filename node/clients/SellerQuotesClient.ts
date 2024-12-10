import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

const SELLER_CLIENT_OPTIONS: InstanceOptions = {
  retries: 5,
  timeout: 5000,
  exponentialTimeoutCoefficient: 2,
  exponentialBackoffCoefficient: 2,
  initialBackoffDelay: 100,
}

interface NotifySellerQuoteResponse {
  status: string
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

  private getUrl(account: string) {
    const subdomain = this.context.production
      ? account
      : `${this.context.workspace}--${account}`

    return `http://${subdomain}.myvtex.com/_v/b2b-seller-quotes/notify-quote`
  }

  public async notify(account: string, quote: Quote) {
    return this.http
      .postRaw<NotifySellerQuoteResponse>(this.getUrl(account), quote)
      .then((res) => {
        // eslint-disable-next-line no-console
        console.log('RESPONSE', res)

        return res
      })
  }
}
