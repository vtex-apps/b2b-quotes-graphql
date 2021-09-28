import GraphQLError from '../utils/GraphQLError'

export const organizationName = async (
  { organization }: { organization: string },
  _: any,
  ctx: Context
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
  } catch (e) {
    logger.error({
      message: 'getOrganizationName-error',
      e,
    })
    if (e.message) {
      throw new GraphQLError(e.message)
    } else if (e.response?.data?.message) {
      throw new GraphQLError(e.response.data.message)
    } else {
      throw new GraphQLError(e)
    }
  }
}

export const costCenterName = async (
  { costCenter }: { costCenter: string },
  _: any,
  ctx: Context
) => {
  const {
    clients: { organizations },
    vtex: { logger },
  } = ctx

  try {
    const costCenterData = await organizations.getCostCenterById(costCenter)

    return costCenterData?.data?.getCostCenterById?.name ?? null
  } catch (e) {
    logger.error({
      message: 'getCostCenterName-error',
      e,
    })
    if (e.message) {
      throw new GraphQLError(e.message)
    } else if (e.response?.data?.message) {
      throw new GraphQLError(e.response.data.message)
    } else {
      throw new GraphQLError(e)
    }
  }
}
