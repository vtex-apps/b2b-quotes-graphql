export const organizationName = async (
  { organization }: { organization: string },
  _: any,
  ctx: Context | EventBroadcastContext
) => {
  const {
    clients: { organizations },
    vtex: { logger },
  } = ctx

  try {
    const organizationData = await organizations.getOrganizationById(
      organization
    )

    return organizationData?.data?.getOrganizationById?.name ?? null
  } catch (error) {
    logger.warn({
      error,
      message: 'getOrganizationName-error',
    })
  }
}

export const costCenterName = async (
  { costCenter }: { costCenter: string },
  _: any,
  ctx: Context | EventBroadcastContext
) => {
  const {
    clients: { organizations },
    vtex: { logger },
  } = ctx

  try {
    const costCenterData = await organizations.getCostCenterById(costCenter)

    return costCenterData?.data?.getCostCenterById?.name ?? null
  } catch (error) {
    logger.warn({
      error,
      message: 'getCostCenterName-error',
    })
  }
}
