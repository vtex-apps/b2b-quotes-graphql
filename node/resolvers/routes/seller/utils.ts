import { ForbiddenError } from '@vtex/api'

import SellerQuotesController from '../../utils/sellerQuotesController'

const USER_AGENT_REGEX = /^vtex\.b2b-seller-quotes@\d+\.\d+\.\d+$/

export function invalidParam(
  param?: string | string[]
): param is string[] | undefined {
  return !param || Array.isArray(param)
}

export async function validateSellerRequest(ctx: Context, next: NextFn) {
  const { seller } = ctx.vtex.route.params

  if (
    invalidParam(seller) ||
    seller !== ctx.headers['x-vtex-origin-account'] ||
    !ctx.headers['user-agent']?.match(USER_AGENT_REGEX)
  ) {
    throw new ForbiddenError('request-not-allowed')
  }

  ctx.vtex.sellerQuotesController = new SellerQuotesController(ctx, seller)

  await next()
}

export async function setSellerResponseMetadata(ctx: Context) {
  ctx.set('Access-Control-Allow-Origin', '*')
  ctx.set('Content-Type', 'application/json')
  ctx.status = 200
}
