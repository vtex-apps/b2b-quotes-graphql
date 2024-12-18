import { NotFoundError, UserInputError } from '@vtex/api'
import pLimit from 'p-limit'

import {
  QUOTE_DATA_ENTITY,
  QUOTE_FIELDS,
  SCHEMA_VERSION,
} from '../../../constants'
import {
  costCenterName as getCostCenterName,
  organizationName as getOrganizationName,
} from '../../fieldResolvers'

export async function getSellerQuotesPaginated(ctx: Context, next: NextFn) {
  const { seller } = ctx.state

  if (!seller) {
    throw new UserInputError('get-seller-quote-invalid-params')
  }

  // default page = 1
  const page = parseInt(
    Array.isArray(ctx.query.page) ? ctx.query.page[0] : ctx.query.page || '1',
    10
  )

  // default pageSize = 15
  const pageSize = parseInt(
    Array.isArray(ctx.query.pageSize)
      ? ctx.query.pageSize[0]
      : ctx.query.pageSize || '15',
    10
  )

  if (page < 1 || pageSize < 1) {
    throw new UserInputError('get-seller-quote-invalid-pagination-params')
  }

  const {
    data,
    pagination,
  } = await ctx.clients.masterdata.searchDocumentsWithPaginationInfo<Quote>({
    dataEntity: QUOTE_DATA_ENTITY,
    fields: QUOTE_FIELDS,
    pagination: { page, pageSize },
    schema: SCHEMA_VERSION,
    where: `seller=${seller}`,
  })

  if (!data || !data.length) {
    throw new NotFoundError('seller-quotes-not-found')
  }

  const limit = pLimit(15)
  const enrichedQuotes = await Promise.all(
    data.map((quote) =>
      limit(async () => {
        const organizationName = await getOrganizationName(
          { organization: quote.organization },
          null,
          ctx
        )

        const costCenterName = await getCostCenterName(
          { costCenter: quote.costCenter },
          null,
          ctx
        )

        return { ...quote, organizationName, costCenterName }
      })
    )
  )

  ctx.body = {
    data: enrichedQuotes,
    pagination: {
      page,
      pageSize,
      total: pagination.total,
    },
  }

  await next()
}
