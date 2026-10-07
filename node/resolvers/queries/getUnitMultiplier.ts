export const getUnitMultiplier = async (
  _: any,
  { skuId }: { skuId: string },
  ctx: Context
): Promise<number | null> => {
  const sku = await ctx.clients.catalog.getSkuById(skuId)

  return sku?.UnitMultiplier ?? null
}
