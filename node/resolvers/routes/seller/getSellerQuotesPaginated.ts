export async function getSellerQuotesPaginated(ctx: Context, next: NextFn) {
  const { query } = ctx

  const page = parseInt(
    Array.isArray(query.page) ? query.page[0] : query.page || '1',
    10
  )

  const pageSize = parseInt(
    Array.isArray(query.pageSize) ? query.pageSize[0] : query.pageSize || '15',
    10
  )

  const validPage = page >= 0 ? page : 1
  const validPageSize = pageSize >= 0 ? pageSize : 15

  ctx.body = await ctx.vtex.sellerQuotesController?.getSellerQuotesPaginated(
    validPage,
    validPageSize
  )

  await next()
}
