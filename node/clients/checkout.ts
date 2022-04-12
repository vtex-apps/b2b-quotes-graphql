import type {
  InstanceOptions,
  IOContext,
  RequestTracingConfig,
} from '@vtex/api'
import { JanusClient } from '@vtex/api'

import { APP_NAME } from '../constants'
import { createTracing } from '../utils/index'

const CHECKOUT_ENDPOINT = 'api/checkout/pvt/configuration/orderForm'

export default class Checkout extends JanusClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, {
      ...options,
      headers: {
        ...(ctx.adminUserAuthToken
          ? {
              VtexIdclientAutCookie: ctx.adminUserAuthToken,
            }
          : {}),
      },
    })
  }

  public getOrderFormConfiguration(tracingConfig?: RequestTracingConfig) {
    const metric = `${APP_NAME}-getOrderForm`

    return this.http.get<OrderFormConfiguration>(CHECKOUT_ENDPOINT, {
      metric,
      tracing: createTracing(metric, tracingConfig),
    })
  }

  public setOrderFormConfiguration(
    body: OrderFormConfiguration,
    userToken: string,
    tracingConfig?: RequestTracingConfig
  ) {
    const metric = `${APP_NAME}-setOrderForm`

    return this.http.post(CHECKOUT_ENDPOINT, body, {
      headers: {
        VtexIdclientAutCookie: userToken,
      },
      metric,
      tracing: createTracing(metric, tracingConfig),
    })
  }
}
