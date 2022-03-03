import { QUOTE_DATA_ENTITY, QUOTE_FIELDS, SCHEMA_VERSION } from '../resolvers'

const processItem = ({ ctx, item }: { ctx: Context; item: any }) => {
  const {
    clients: { masterdata },
    vtex: { logger },
  } = ctx

  masterdata
    .updateEntireDocument({
      dataEntity: QUOTE_DATA_ENTITY,
      id: item.id,
      fields: { ...item, status: 'expired' },
    })
    .then(() => {
      logger.info({ message: `## ${item.id} changed to expired` })
    })
    .catch((error) => {
      logger.error({ message: 'Update masterdata error', error })
    })
}

export const processQueue = (ctx: Context) => {
  const {
    clients: { masterdata },
    vtex: { logger },
  } = ctx

  masterdata
    .searchDocuments({
      dataEntity: QUOTE_DATA_ENTITY,
      fields: QUOTE_FIELDS,
      where: `status <> 'expired' AND expirationDate < ${new Date().toISOString()}`,
      sort: 'creationDate ASC',
      schema: SCHEMA_VERSION,
      pagination: {
        page: 1,
        pageSize: 500,
      },
    })
    .then((data: any) => {
      if (Array.isArray(data)) {
        logger.info({ message: `#### Items to be processed => ${data.length}` })

        data.forEach((item) => {
          processItem({ ctx, item })
        })
      }
    })
    .catch((error) => {
      logger.error({ message: 'Queue ERROR', error })
      throw error
    })
}
