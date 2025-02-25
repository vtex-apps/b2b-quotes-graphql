import { QUOTE_DATA_ENTITY, QUOTE_FIELDS, SCHEMA_VERSION } from '../constants'
import SellerQuotesController from '../resolvers/utils/sellerQuotesController'
import { isEmail, NO_REPLY_EMAIL } from '../utils'
import message from '../utils/message'

export async function orderHandler(
  ctx: EventBroadcastContext,
  next: () => Promise<unknown>
) {
  const {
    clients: { orders, masterdata, host: hostClient },
    vtex: { logger },
    body,
  } = ctx

  let order: Order = {} as Order

  if (body.currentState !== 'order-created') {
    return next()
  }

  const { host } = await hostClient.getHost()

  ctx.vtex.host = host
  let id

  try {
    order = await orders.getOrder(body.orderId)
    if (!order || !order.status || !order.items) {
      return
    }

    // update to placed order
    const { customData } = order
    const index = customData?.customApps?.findIndex(
      (item) => item.id === 'b2b-quotes-graphql'
    )

    if (index !== -1 && customData && customData.customApps) {
      const { quoteId } = customData?.customApps[index].fields

      id = quoteId

      if (quoteId && quoteId.length > 1) {
        const item = (await masterdata.getDocument({
          dataEntity: QUOTE_DATA_ENTITY,
          fields: QUOTE_FIELDS,
          id: quoteId,
        })) as Quote

        const quotes: Quote[] = []

        quotes.push(item)

        if (item.hasChildren) {
          const sellerQuotesController = new SellerQuotesController(ctx)
          const childrenQuotes = await sellerQuotesController.getAllChildrenQuotes(
            quoteId
          )

          quotes.push(...childrenQuotes)
        }

        await Promise.all(
          quotes.map((quote) => processQuote(ctx, order, quote))
        )
      }
    }
  } catch (error) {
    logger.error({
      data: ctx.body,
      error,
      message: 'OrderHandler-updateQuoteStatusError',
      id,
    })
  }

  return next()
}

async function processQuote(
  ctx: EventBroadcastContext,
  order: Order,
  quote: Quote
) {
  const { orderId } = order

  const mustAddUpdateHistory =
    !quote.seller ||
    (quote.seller && order.items.some((item) => item.seller === quote.seller))

  if (mustAddUpdateHistory) {
    quote.updateHistory.push({
      date: new Date().toISOString(),
      email: NO_REPLY_EMAIL,
      note: `Order ID: ${orderId}`,
      role: 'order-notification-system',
      status: 'placed',
    })
  }

  const quoteUpdated = {
    ...quote,
    status: 'placed',
    updateHistory: quote.updateHistory,
  }

  await ctx.clients.masterdata.updateEntireDocument({
    dataEntity: QUOTE_DATA_ENTITY,
    fields: quoteUpdated,
    id: quote.id,
    schema: SCHEMA_VERSION,
  })

  // just users from single or children quotes need to be notified
  if (quote.hasChildren) return

  const users = quoteUpdated.updateHistory.map((anUpdate) => anUpdate.email)

  const uniqueUsers = [
    ...new Set(users.filter((userEmail: string) => isEmail.test(userEmail))),
  ]

  message(ctx)
    .quoteUpdated({
      costCenter: quoteUpdated.costCenter,
      id: quote.id,
      lastUpdate: {
        email: 'order-notification-system',
        note: `Order ID: ${orderId}`,
        status: 'PLACED',
      },
      name: quoteUpdated.referenceName,
      orderId,
      organization: quoteUpdated.organization,
      templateName: 'quote-order-placed',
      users: uniqueUsers,
    })
    .then(() => {
      ctx.vtex.logger.info({
        message: `[Quote placed] E-mail sent ${uniqueUsers.join(', ')}`,
      })
    })
}
