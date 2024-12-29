import { invalidParam } from './utils'

export async function getSellerQuotesPaginated(ctx: Context, next: NextFn) {
  const { query } = ctx
  const { page, pageSize, search, status } = query

  const pageNumber = parseInt(Array.isArray(page) ? page[0] : page || '1', 10)
  const pageSizeNumber = parseInt(
    Array.isArray(pageSize) ? pageSize[0] : pageSize || '25',
    10
  )

  const filters: string[] = []

  if (!invalidParam(search)) {
    filters.push(`(referenceName='*${search.split(/\s+/).join('*')}*')`)
  }

  if (!invalidParam(status)) {
    filters.push(`(status=${status})`)
  }

  const where = filters.join(' AND ')
  const validPage = pageNumber >= 0 ? pageNumber : 1
  const validPageSize = pageSizeNumber >= 0 ? pageSizeNumber : 25

  ctx.body = await ctx.vtex.sellerQuotesController?.getSellerQuotesPaginated(
    validPage,
    validPageSize,
    where
  )

  await next()
}
