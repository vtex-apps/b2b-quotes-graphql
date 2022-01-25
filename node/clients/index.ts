import { IOClients } from '@vtex/api'

import RequestHub from '../utils/Hub'
import StorefrontPermissions from './storefrontPermissions'
import VtexId from './vtexId'
import Organizations from './organizations'
import { Checkout } from './Checkout'

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

  public get organizations() {
    return this.getOrSet('organizations', Organizations)
  }

  public get storefrontPermissions() {
    return this.getOrSet('storefrontPermissions', StorefrontPermissions)
  }
}
