import { QUOTE_DATA_ENTITY, QUOTE_FIELDS, SCHEMA_VERSION } from '../constants'
import { NO_REPLY_EMAIL } from './index'
import message from './message'

const processItem = ({
  ctx,
  item,
  baseDate,
  index,
}: {
  ctx: Context
  item: Quote
  baseDate: Date
  index: number
}) => {
  const {
    clients: { masterdata },
    vtex: { logger },
  } = ctx

  const { id, referenceName, organization, costCenter, updateHistory } = item

  if (item.status === 'placed' || item.status === 'declined') {
    return
  }

  const status = 'expired'
  const now = new Date(baseDate)

  now.setSeconds(now.getSeconds() + index)

  const nowISO = now.toISOString()

  const users = updateHistory.map((anUpdate) => anUpdate.email)
  const uniqueUsers = [...new Set(users)]

  const lastUpdate = nowISO
  const update = {
    date: nowISO,
    email: NO_REPLY_EMAIL,
    note: '',
    role: 'expiration-system',
    status,
  }

  updateHistory.push(update)

  masterdata
    .updatePartialDocument({
      dataEntity: QUOTE_DATA_ENTITY,
      fields: { lastUpdate, updateHistory, status },
      id,
      schema: SCHEMA_VERSION,
    })
    .then(() => {
      message(ctx).quoteUpdated({
        costCenter,
        id,
        lastUpdate: {
          email: 'expiration-system',
          note: '',
          status: status.toUpperCase(),
        },
        name: referenceName,
        organization,
        users: uniqueUsers,
      })
    })
    .catch((error) => {
      logger.error({ message: 'quoteExpired-Error', error })
    })
}

export const processQueue = (ctx: Context) => {
  const {
    clients: { masterdata },
    vtex: { logger },
  } = ctx

  const now = new Date()
  const nowISO = now.toISOString()

  masterdata
    .searchDocuments({
      dataEntity: QUOTE_DATA_ENTITY,
      fields: QUOTE_FIELDS,
      pagination: {
        page: 1,
        pageSize: 500,
      },
      schema: SCHEMA_VERSION,
      sort: 'creationDate ASC',
      where: `status <> 'expired' AND expirationDate < ${nowISO}`,
    })
    .then((data: any) => {
      if (Array.isArray(data)) {
        logger.info({
          itemsToBeProcessed: data.length,
          message: `expirationQueue-foundItems`,
        })

        data.forEach((item, index) => {
          processItem({ ctx, item, index, baseDate: now })
        })
      }
    })
    .catch((error) => {
      logger.error({ message: 'expirationQueue-error', error })
      throw error
    })
}
