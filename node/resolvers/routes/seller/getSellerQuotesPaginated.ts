import { invalidParam } from './utils'

export async function getSellerQuotesPaginated(ctx: Context, next: NextFn) {
  const { query } = ctx
  const {
    page,
    pageSize,
    search,
    status,
    where: customWhere = '',
    sort,
  } = query

  const pageNumber = parseInt(Array.isArray(page) ? page[0] : page || '1', 10)
  const pageSizeNumber = parseInt(
    Array.isArray(pageSize) ? pageSize[0] : pageSize || '25',
    10
  )

  const filters: string[] = []

  if (!invalidParam(search)) {
    const searchTerm = `*${search.replace(/'/g, '').split(/\s+/).join('*')}*`

    filters.push(
      `(referenceName='${searchTerm}' OR creatorEmail='${searchTerm}' OR creatorName='${searchTerm}')`
    )
  }

  if (!invalidParam(status)) {
    filters.push(`(status=${status})`)
  }

  if (!invalidParam(customWhere)) {
    filters.push(`(${customWhere})`)
  }

  const where = filters.join(' AND ')
  const validPage = pageNumber >= 0 ? pageNumber : 1
  const validPageSize = pageSizeNumber >= 0 ? pageSizeNumber : 25

  ctx.body = await ctx.vtex.sellerQuotesController?.getSellerQuotesPaginated({
    page: validPage,
    pageSize: validPageSize,
    where,
    ...(!invalidParam(sort) && { sort }),
  })

  await next()
}
