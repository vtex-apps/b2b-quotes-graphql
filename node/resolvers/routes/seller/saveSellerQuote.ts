import { UserInputError } from '@vtex/api'
import { json } from 'co-body'

import { invalidParam } from './utils'

function throwsInputError(): never {
  throw new UserInputError('save-seller-quote-invalid-params')
}

export async function saveSellerQuote(ctx: Context, next: NextFn) {
  const { id } = ctx.vtex.route.params

  if (invalidParam(id)) {
    throwsInputError()
  }

  const payload: Partial<Quote> = await json(ctx.req)

  if (!payload) {
    throwsInputError()
  }

  await ctx.vtex.sellerQuotesController?.saveSellerQuote(id, payload)

  await next()
}
