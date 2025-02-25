import type { IOContext } from '@vtex/api'
import { IOClients } from '@vtex/api'

import AnalyticsClient from './analytics'
import RequestHub from '../utils/Hub'
import Identity from '../utils/Identity'
import { Scheduler } from '../utils/Scheduler'
import Checkout from './checkout'
import LMClient from './LMClient'
import MailClient from './email'
import HostClient from './HostClient'
import OrdersClient from './OrdersClient'
import Organizations from './organizations'
import StorefrontPermissions from './storefrontPermissions'
import VtexId from './vtexId'
import SellerQuotesClient from './SellerQuotesClient'
import SellerClient from './SellerClient'

export const getTokenToHeader = (ctx: IOContext) => {
  // provide authToken (app token) as an admin token as this is a call
  // between b2b suite apps and no further token validation is needed
  const adminToken = ctx.authToken
  const userToken = ctx.storeUserAuthToken ?? null
  const { sessionToken, account } = ctx

  let allCookies = `VtexIdclientAutCookie=${adminToken}`

  if (userToken) {
    allCookies += `; VtexIdclientAutCookie_${account}=${userToken}`
  }

  return {
    'x-vtex-credential': ctx.authToken,
    VtexIdclientAutCookie: adminToken,
    cookie: allCookies,
    ...(sessionToken && {
      'x-vtex-session': sessionToken,
    }),
  }
}

// Extend the default IOClients implementation with our own custom clients.
export class Clients extends IOClients {
  public get analytics() {
    return this.getOrSet('analytics', AnalyticsClient)
  }

  public get hub() {
    return this.getOrSet('hub', RequestHub)
  }

  public get vtexId() {
    return this.getOrSet('vtexId', VtexId)
  }

  public get checkout() {
    return this.getOrSet('checkout', Checkout)
  }

  public get lm() {
    return this.getOrSet('lm', LMClient)
  }

  public get mail() {
    return this.getOrSet('mail', MailClient)
  }

  public get organizations() {
    return this.getOrSet('organizations', Organizations)
  }

  public get storefrontPermissions() {
    return this.getOrSet('storefrontPermissions', StorefrontPermissions)
  }

  public get scheduler() {
    return this.getOrSet('scheduler', Scheduler)
  }

  public get orders() {
    return this.getOrSet('orders', OrdersClient)
  }

  public get host() {
    return this.getOrSet('host', HostClient)
  }

  public get identity() {
    return this.getOrSet('identity', Identity)
  }

  public get sellerQuotes() {
    return this.getOrSet('sellerQuotes', SellerQuotesClient)
  }

  public get seller() {
    return this.getOrSet('seller', SellerClient)
  }
}
