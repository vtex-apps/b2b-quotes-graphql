import type StorefrontPermissions from '../clients/storefrontPermissions'

interface QuoteUpdate {
  email: string
  status: string
  note: string
}

const getUsers = async (
  storefrontPermissions: StorefrontPermissions,
  roleSlug: string,
  organizationId?: string
) => {
  const {
    data: { listRoles },
  }: any = await storefrontPermissions.listRoles()

  const role = listRoles.find((r: any) => r.slug === roleSlug)

  if (!role) return []

  const {
    data: { listUsers },
  }: any = await storefrontPermissions.listUsers({
    roleId: role.id,
    ...(organizationId && { organizationId }),
  })

  return listUsers
}

const getOrgAndCostCenterNames = async (
  ctx: Context,
  organizationId: string,
  costCenterId: string
) => {
  const {
    clients: { organizations },
    vtex: { logger },
  } = ctx

  try {
    const {
      data: {
        getOrganizationById: { name: organizationName },
      },
    } = await organizations.getOrganizationById(organizationId)

    const {
      data: {
        getCostCenterById: { name: costCenterName },
      },
    } = await organizations.getCostCenterById(costCenterId)

    return { organizationName, costCenterName }
  } catch (error) {
    logger.error({
      message: 'quoteUpdatedMessage-getOrgNamesError',
      error,
    })

    return { organizationName: null, costCenterName: null }
  }
}

const message = (ctx: Context) => {
  const {
    clients: { mail, storefrontPermissions },
    vtex: { logger, host },
  } = ctx

  let rootPath = ctx.get('x-vtex-root-path')

  // Defend against malformed root path. It should always start with `/`.
  if (rootPath && !rootPath.startsWith('/')) {
    rootPath = `/${rootPath}`
  }

  if (rootPath === '/') {
    rootPath = ''
  }

  const quoteCreated = async ({
    name,
    id,
    organization,
    costCenter,
    lastUpdate,
  }: {
    name: string
    id: string
    organization: string
    costCenter: string
    lastUpdate: QuoteUpdate
  }) => {
    let users = []

    try {
      users = await getUsers(storefrontPermissions, 'sales-admin')
    } catch (error) {
      logger.error({
        message: 'quoteCreatedMessage-getUsersError',
        error,
      })
    }

    const { organizationName, costCenterName } = await getOrgAndCostCenterNames(
      ctx,
      organization,
      costCenter
    )

    const link = `https://${host}${rootPath}/b2b-quotes/${id}`

    if (organizationName && costCenterName) {
      for (const user of users) {
        mail.sendMail({
          templateName: 'quote-created',
          jsonData: {
            message: { to: user.email },
            quote: {
              name,
              id,
              link,
              organization: organizationName,
              costCenter: costCenterName,
              lastUpdate,
            },
          },
        })
      }
    }
  }

  const quoteUpdated = async ({
    users,
    name,
    id,
    organization,
    costCenter,
    lastUpdate,
  }: {
    users: string[]
    name: string
    id: string
    organization: string
    costCenter: string
    lastUpdate: QuoteUpdate
  }) => {
    const { organizationName, costCenterName } = await getOrgAndCostCenterNames(
      ctx,
      organization,
      costCenter
    )

    const link = `https://${host}${rootPath}/b2b-quotes/${id}`

    if (organizationName && costCenterName) {
      for (const user of users) {
        mail.sendMail({
          templateName: 'quote-updated',
          jsonData: {
            message: { to: user },
            quote: {
              name,
              id,
              link,
              organization: organizationName,
              costCenter: costCenterName,
              lastUpdate,
            },
          },
        })
      }
    }
  }

  return {
    quoteCreated,
    quoteUpdated,
  }
}

export default message
