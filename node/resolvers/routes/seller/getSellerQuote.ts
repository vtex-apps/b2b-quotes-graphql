import { UserInputError } from '@vtex/api'

import { getFullSellerQuote } from '../../utils/quotes'
import { invalidParam } from './utils'

export async function getSellerQuote(ctx: Context, next: NextFn) {
  const { id } = ctx.vtex.route.params

  if (invalidParam(id)) {
    throw new UserInputError('get-seller-quote-invalid-params')
  }

  const { seller } = ctx.state as { seller: string }
  const quote = await getFullSellerQuote(ctx, seller, id)

  ctx.body = quote

  await next()
}
