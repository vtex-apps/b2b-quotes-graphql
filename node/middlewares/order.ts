import { QUOTE_DATA_ENTITY, QUOTE_FIELDS } from '../resolvers'
import { isEmail } from '../utils'
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
  try {
    order = await orders.getOrder(body.orderId)

    if (!order || !order.status || !order.items) {
      return
    }
  } catch (error) {
    logger.error({
      data: ctx.body,
      error,
      message: 'OrderHandler-getOrderError',
    })
  }

  // update to placed order
  const { customData } = order

  const index = customData?.customApps?.findIndex(
    (item) => item.id === 'b2b-quotes-graphql'
  )

  if (index !== -1 && customData && customData.customApps) {
    const { quoteId } = customData?.customApps[index].fields

    if (quoteId && quoteId.length > 1) {
      try {
        const item = (await masterdata.getDocument({
          dataEntity: QUOTE_DATA_ENTITY,
          fields: QUOTE_FIELDS,
          id: quoteId,
        })) as Quote

        const quote = {
          ...item,
          status: 'placed',
          updateHistory: [
            ...item.updateHistory,
            {
              date: new Date().toISOString(),
              email: order.followUpEmail ?? '',
              note: `Order placed orderId: ${body.orderId}`,
              status: 'placed',
            },
          ],
        }

        const data = await masterdata
          .updateEntireDocument({
            dataEntity: QUOTE_DATA_ENTITY,
            fields: quote,
            id: quoteId,
          })
          .then((res: any) => res)

        const users = quote.updateHistory.map((anUpdate) => anUpdate.email)

        const uniqueUsers = [
          ...new Set(
            users.filter((userEmail: string) => isEmail.test(userEmail))
          ),
        ]

        message(ctx)
          .quoteUpdated({
            costCenter: quote.costCenter,
            id: quoteId,
            lastUpdate: quote.updateHistory[
              quote.updateHistory.length - 1
            ] as QuoteUpdate,
            name: quote.referenceName,
            orderId: body.orderId,
            organization: quote.organization,
            templateName: 'quote-order-placed',
            users: uniqueUsers,
          })
          .then(() => {
            logger.info({
              message: `[Quote placed] E-mail sent ${uniqueUsers.join(', ')}`,
            })
          })
          .catch((error) => {
            logger.error({
              data: ctx.body,
              error,
              message: 'OrderHandler-quoteUpdatedError',
            })
          })

        logger.info({
          data,
          message: 'OrderHandler-updateQuoteStatus',
        })
      } catch (e) {
        logger.error({
          data: ctx.body,
          error: e,
          message: 'OrderHandler-updateQuoteStatusError',
          quoteId,
        })
      }
    }
  }

  return next()
}
