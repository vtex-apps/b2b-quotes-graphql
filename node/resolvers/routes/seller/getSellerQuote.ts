import { NotFoundError, UserInputError } from '@vtex/api'

import {
  QUOTE_DATA_ENTITY,
  QUOTE_FIELDS,
  SCHEMA_VERSION,
} from '../../../constants'
import {
  costCenterName as getCostCenterName,
  organizationName as getOrganizationName,
} from '../../fieldResolvers'
import { invalidParam } from './utils'

export async function getSellerQuote(ctx: Context, next: NextFn) {
  const { id } = ctx.vtex.route.params
  const { seller } = ctx.state

  if (!seller || invalidParam(id)) {
    throw new UserInputError('get-seller-quote-invalid-params')
  }

  const [quote] = await ctx.clients.masterdata.searchDocuments<Quote>({
    dataEntity: QUOTE_DATA_ENTITY,
    fields: QUOTE_FIELDS,
    pagination: { page: 1, pageSize: 1 },
    schema: SCHEMA_VERSION,
    where: `id=${id} AND seller=${seller}`,
  })

  if (!quote) {
    throw new NotFoundError('seller-quote-not-found')
  }

  const { organization, costCenter } = quote

  const organizationName = await getOrganizationName(
    { organization },
    null,
    ctx
  )

  const costCenterName = await getCostCenterName({ costCenter }, null, ctx)

  ctx.body = { ...quote, organizationName, costCenterName }

  await next()
}
