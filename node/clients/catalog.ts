import type {
  InstanceOptions,
  IOContext,
  RequestTracingConfig,
} from '@vtex/api'
import { JanusClient } from '@vtex/api'

import { APP_NAME } from '../constants'
import { createTracing } from '../utils/index'

const SEARCH_ENDPOINT = '/api/catalog_system/pub/products/search'

// The catalog search is only used to enrich the cart with price tokens, so it
// must never slow down or break the flow that depends on it.
const CATALOG_CLIENT_OPTIONS: InstanceOptions = {
  retries: 1,
  timeout: 3000,
}

export default class Catalog extends JanusClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, {
      ...options,
      ...CATALOG_CLIENT_OPTIONS,
      headers: {
        ...options?.headers,
        Accept: 'application/json',
      },
    })
  }

  /**
   * Searches products by SKU id. The response carries the signed price
   * (`sellers[].commertialOffer.PriceToken`) generated for this request.
   */
  public searchBySkuIds(
    skuIds: string[],
    salesChannel?: string | null,
    tracingConfig?: RequestTracingConfig
  ) {
    const metric = `${APP_NAME}-catalogSearchBySkuIds`

    const filters = skuIds.map((skuId) => `fq=skuId:${skuId}`).join('&')
    const salesChannelQueryString = salesChannel ? `&sc=${salesChannel}` : ''
    const pagination = `&_from=0&_to=${skuIds.length - 1}`

    return this.http.get<CatalogProduct[]>(
      `${SEARCH_ENDPOINT}?${filters}${salesChannelQueryString}${pagination}`,
      {
        metric,
        tracing: createTracing(metric, tracingConfig),
      }
    )
  }
}
