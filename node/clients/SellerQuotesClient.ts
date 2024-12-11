/* eslint-disable no-console */
import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

const SELLER_CLIENT_OPTIONS: InstanceOptions = {
  retries: 5,
  timeout: 5000,
  exponentialTimeoutCoefficient: 2,
  exponentialBackoffCoefficient: 2,
  initialBackoffDelay: 100,
}

interface VerifyQuoteSettingsResponse {
  receiveQuotes: boolean
}

interface NotifySellerQuoteResponse {
  status: string
}

const routes = {
  verifyQuoteSettings: '/verify-quote-settings',
  notifyNewQuote: '/notify-new-quote',
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

  private getRoute(account: string, path: string) {
    const subdomain = this.context.production
      ? account
      : `${this.context.workspace}--${account}`

    return `http://${subdomain}.myvtex.com/_v/b2b-seller-quotes${path}`
  }

  public async verifyQuoteSettings(account: string) {
    return this.http
      .get<VerifyQuoteSettingsResponse>(
        this.getRoute(account, routes.verifyQuoteSettings)
      )
      .then((res) => {
        console.log('==================================================')
        console.log('SUCCESS RESPONSE WHEN VERIFY SELLER:', res)

        return res
      })
      .catch((err) => {
        console.log('==================================================')
        console.log('ERROR WHEN VEFIFY SELLER:', err)
        throw err
      })
  }

  public async notifyNewQuote(account: string, quote: Quote) {
    return this.http
      .postRaw<NotifySellerQuoteResponse>(
        this.getRoute(account, routes.notifyNewQuote),
        quote
      )
      .then((res) => {
        console.log('==================================================')
        console.log('SUCCESS RESPONSE WHEN NOTIFY SELLER:', res)

        return res
      })
      .catch((err) => {
        console.log('==================================================')
        console.log('ERROR WHEN NOTIFY SELLER:', err)
        throw err
      })
  }
}
