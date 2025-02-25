import { UserInputError } from '@vtex/api'

import { invalidParam } from './utils'

export async function getSellerQuote(ctx: Context, next: NextFn) {
  const { id } = ctx.vtex.route.params

  if (invalidParam(id)) {
    throw new UserInputError('get-seller-quote-invalid-params')
  }

  const quote = await ctx.vtex.sellerQuotesController?.getFullSellerQuote(id)

  ctx.body = quote

  await next()
}
