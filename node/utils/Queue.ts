import { QUOTE_DATA_ENTITY, QUOTE_FIELDS, SCHEMA_VERSION } from '../resolvers'
import message from './message'

const processItem = ({ ctx, item }: { ctx: Context; item: Quote }) => {
  const {
    clients: { masterdata },
    vtex: { logger },
  } = ctx

  const { id, referenceName, organization, costCenter, updateHistory } = item

  const status = 'expired'
  const now = new Date()
  const nowISO = now.toISOString()

  const users = updateHistory.map((anUpdate) => anUpdate.email)
  const uniqueUsers = [...new Set(users)]

  const lastUpdate = nowISO
  const update = {
    date: nowISO,
    email: 'noreply@vtexcommerce.com.br',
    role: 'expiration-system',
    status,
    note: '',
  }

  updateHistory.push(update)

  masterdata
    .updateEntireDocument({
      dataEntity: QUOTE_DATA_ENTITY,
      id,
      fields: { ...item, lastUpdate, updateHistory, status },
    })
    .then(() => {
      message(ctx)
        .quoteUpdated({
          users: uniqueUsers,
          name: referenceName,
          id,
          organization,
          costCenter,
          lastUpdate: {
            email: 'expiration-system',
            note: '',
            status: status.toUpperCase(),
          },
        })
        .catch((error) => {
          logger.error({ message: 'quoteExpired-emailError', error })
        })

      logger.info({ message: `quoteExpired`, quoteId: id })
    })
    .catch((error) => {
      logger.error({ message: 'quoteExpired-mdError', error })
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
      where: `status <> 'expired' AND expirationDate < ${nowISO}`,
      sort: 'creationDate ASC',
      schema: SCHEMA_VERSION,
      pagination: {
        page: 1,
        pageSize: 500,
      },
    })
    .then((data: any) => {
      if (Array.isArray(data)) {
        logger.info({
          message: `expirationQueue-foundItems`,
          itemsToBeProcessed: data.length,
        })

        data.forEach((item) => {
          processItem({ ctx, item })
        })
      }
    })
    .catch((error) => {
      logger.error({ message: 'expirationQueue-error', error })
      throw error
    })
}
