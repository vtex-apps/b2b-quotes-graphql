import { IOClients } from '@vtex/api'

import RequestHub from '../utils/Hub'
import { Scheduler } from '../utils/Scheduler'
import Broadcaster from './broadcaster'
import Checkout from './checkout'
import MailClient from './email'
import HostClient from './host'
import OrdersClient from './orders'
import Organizations from './organizations'
import StorefrontPermissions from './storefrontPermissions'
import VtexId from './vtexId'

// Extend the default IOClients implementation with our own custom clients.
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

  public get broadcaster() {
    return this.getOrSet('broadcaster', Broadcaster)
  }

  public get orders() {
    return this.getOrSet('orders', OrdersClient)
  }

  public get host() {
    return this.getOrSet('host', HostClient)
  }
}
