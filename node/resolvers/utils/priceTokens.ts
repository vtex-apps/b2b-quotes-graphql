import { splitEvery, uniq, unnest } from 'ramda'

import { CATALOG_SEARCH_PAGE_SIZE } from '../../constants'

export const priceTokenKey = (skuId: string, seller: string) =>
  `${skuId}-${seller}`

/**
 * Fetches the signed prices (`priceToken`) for the given SKUs.
 *
 * The `useQuote` flow applies items stored in Master Data, so there is no live
 * search to reuse a token from - we have to ask the catalog search for a fresh
 * one at the moment the quote is applied. Sending the token to
 * `POST /orderForm/{id}/items` lets Checkout add the items even when Pricing is
 * unavailable. The negotiated price is still applied afterwards through
 * `PUT /orderForm/{id}/items/update`, so the token never changes the final
 * price charged.
 *
 * The token is optional by design: it is only used when Pricing is down, it is
 * behind a feature flag on the search API, and this whole call is a resilience
 * improvement. Any failure is logged and ignored, keeping the previous behavior
 * of adding items without a token.
 *
 * The field is `PriceToken` (PascalCase) here because this reads the Catalog
 * Search REST API. Do not switch to the camelCase `priceToken`: that name only
 * exists in `vtex.search-graphql`, which maps the REST field - reading
 * PascalCase from a search-graphql query is a known source of bugs.
 *
 * The token is a JWT signed by `session/data-signer`, valid for 30 minutes,
 * whose claims bind the price to `{ id, seller, accountName, salesChannel }` -
 * hence the sales channel must be forwarded to the search, so the token is not
 * bound to a channel other than the one the item is added on. When the quote
 * carries no sales channel, the search resolves it to the account default, the
 * same one `addToCart` falls back to.
 */
export const getPriceTokens = async (
  ctx: Context,
  { skuIds, salesChannel }: { skuIds: string[]; salesChannel?: string | null }
): Promise<Record<string, string>> => {
  const {
    clients: { catalog },
    vtex: { logger },
  } = ctx

  const priceTokens: Record<string, string> = {}

  if (!skuIds.length) return priceTokens

  try {
    const batches = splitEvery(CATALOG_SEARCH_PAGE_SIZE, uniq(skuIds))

    const products = unnest(
      await Promise.all(
        batches.map((batch) => catalog.searchBySkuIds(batch, salesChannel))
      )
    )

    for (const product of products) {
      for (const item of product?.items ?? []) {
        for (const seller of item?.sellers ?? []) {
          const priceToken = seller?.commertialOffer?.PriceToken

          if (priceToken) {
            priceTokens[priceTokenKey(item.itemId, seller.sellerId)] =
              priceToken
          }
        }
      }
    }
  } catch (error) {
    logger.warn({
      error,
      message: 'getPriceTokens-catalogSearchError',
    })
  }

  return priceTokens
}
