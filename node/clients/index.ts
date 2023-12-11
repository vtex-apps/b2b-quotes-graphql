import type { IOContext } from '@vtex/api'
import { IOClients } from '@vtex/api'

import RequestHub from '../utils/Hub'
import Identity from '../utils/Identity'
import { Scheduler } from '../utils/Scheduler'
import Checkout from './checkout'
import MailClient from './email'
import HostClient from './HostClient'
import OrdersClient from './OrdersClient'
import Organizations from './organizations'
import StorefrontPermissions from './storefrontPermissions'
import VtexId from './vtexId'

// Extend the default IOClients implementation with our own custom clients.
export const getTokenToHeader = (ctx: IOContext) => {
  const token =
    ctx.storeUserAuthToken ?? ctx.adminUserAuthToken ?? ctx.authToken

  return {
    VtexIdclientAutCookie: token,
    cookie: `VtexIdclientAutCookie=${ctx.authToken}`,
    sessionToken: ctx.sessionToken,
    'x-vtex-session': ctx.sessionToken,
  }
}

export class Clients extends IOClients {
  public get hub() {
    return this.getOrSet('hub', RequestHub)
  }

  public get vtexId() {
    return this.getOrSet('vtexId', VtexId)
  }

  public get checkout() {
    return this.getOrSet('checkout', Checkout)
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
}
