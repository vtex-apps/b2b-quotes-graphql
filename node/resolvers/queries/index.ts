import {
  APP_NAME,
  B2B_USER_DATA_ENTITY,
  B2B_USER_SCHEMA_VERSION,
  QUOTE_DATA_ENTITY,
  QUOTE_FIELDS,
  SCHEMA_VERSION,
} from '../../constants'
import GraphQLError from '../../utils/GraphQLError'
import { checkConfig } from '../utils/checkConfig'
import SellerQuotesController from '../utils/sellerQuotesController'

// This function checks if given email is an user part of a buyer org.
export const isUserPartOfBuyerOrg = async (email: string, ctx: Context) => {
  const {
    clients: { masterdata },
  } = ctx

  const where = `email=${email}`
  const resp = await masterdata.searchDocumentsWithPaginationInfo({
    dataEntity: B2B_USER_DATA_ENTITY,
    fields: ['id'], // we don't need to fetch all fields, only if there is an entry or not
    pagination: {
      page: 1,
      pageSize: 1, // we only need to know if there is at least one user entry
    },
    schema: B2B_USER_SCHEMA_VERSION,
    ...(where ? { where } : {}),
  })

  const { data } = (resp as unknown) as {
    data: any
  }

  if (data.length > 0) {
    return true
  }

  return false
}

const buildWhereStatement = async ({
  permissions,
  organization,
  costCenter,
  status,
  search,
  userOrganizationId,
  userCostCenterId,
  userSalesChannel,
}: {
  permissions: string[]
  organization?: string[]
  costCenter?: string[]
  status?: string[]
  search?: string
  userOrganizationId: string
  userCostCenterId: string
  userSalesChannel?: string
}) => {
  // only the main quotes must be fetched
  const whereArray = ['(parentQuote is null)']

  // if user only has permission to access their organization's quotes,
  // hard-code that organization into the masterdata search
  if (!permissions.includes('access-quotes-all')) {
    whereArray.push(`organization=${userOrganizationId}`)
  } else if (organization?.length) {
    const orgArray = organization.map((org) => `organization=${org}`)
    const organizationsStatement = `(${orgArray.join(' OR ')})`

    whereArray.push(organizationsStatement)
  }

  // similarly, if user only has permission to see their cost center's quotes,
  // hard-code its ID into the search
  if (
    !permissions.includes('access-quotes-all') &&
    !permissions.includes('access-quotes-organization')
  ) {
    whereArray.push(`costCenter=${userCostCenterId}`)
  } else if (costCenter?.length) {
    const ccArray = costCenter.map((cc) => `costCenter=${cc}`)
    const costCenters = `(${ccArray.join(' OR ')})`

    whereArray.push(costCenters)
  }

  // similarly, if user only has permission to see their quotes from their sales channel,
  // hard-code its value into the search
  // allow all users to view quotes without a sales channel
  if (
    !permissions.includes('access-quotes-all') &&
    !permissions.includes('access-quotes-all-saleschannel') &&
    userSalesChannel
  ) {
    whereArray.push(
      `((salesChannel is null) OR salesChannel="${userSalesChannel}")`
    )
  }

  if (status?.length) {
    const statusArray = status.map((stat) => `status=${stat}`)
    const statuses = `(${statusArray.join(' OR ')})`

    whereArray.push(statuses)
  }

  if (search) {
    const searchArray = [] as string[]

    searchArray.push(`referenceName="*${search}*"`)
    searchArray.push(`creatorEmail="*${search}*"`)
    const searches = `(${searchArray.join(' OR ')})`

    whereArray.push(searches)
  }

  return whereArray.join(' AND ')
}

export const Query = {
  getQuote: async (_: any, { id }: { id: string }, ctx: Context) => {
    const {
      clients: { masterdata },
      vtex,
      vtex: { logger },
    } = ctx

    const { sessionData, storefrontPermissions, segmentData } = vtex as any

    if (
      !storefrontPermissions?.permissions?.length ||
      !sessionData?.namespaces['storefront-permissions']?.organization?.value ||
      !sessionData?.namespaces['storefront-permissions']?.costcenter?.value
    ) {
      return null
    }

    const { permissions } = storefrontPermissions
    const userOrganizationId =
      sessionData.namespaces['storefront-permissions'].organization.value

    const userCostCenterId =
      sessionData.namespaces['storefront-permissions'].costcenter.value

    const userSalesChannel = segmentData?.channel

    if (
      !permissions.some(
        (permission: string) => permission.indexOf('access-quotes') >= 0
      )
    ) {
      return null
    }

    await checkConfig(ctx)

    try {
      const quote: Quote = await masterdata.getDocument({
        dataEntity: QUOTE_DATA_ENTITY,
        fields: QUOTE_FIELDS,
        id,
      })

      // if user only has permission to view their organization's quotes, check that the org matches
      if (
        !permissions.includes('access-quotes-all') &&
        permissions.includes('access-quotes-organization') &&
        userOrganizationId !== quote.organization
      ) {
        return null
      }

      // if user only has permission to view their cost center's quotes, check that the cost center matches
      if (
        !permissions.includes('access-quotes-all') &&
        !permissions.includes('access-quotes-organization') &&
        userCostCenterId !== quote.costCenter
      ) {
        return null
      }

      // if user only has permission to view quotes from their sales channel, check that the sales channel matches or is null
      if (
        !permissions.includes('access-quotes-all') &&
        !permissions.includes('access-quotes-all-saleschannel') &&
        quote.salesChannel &&
        userSalesChannel !== quote.salesChannel
      ) {
        return null
      }

      return quote
    } catch (error) {
      logger.error({
        error,
        message: 'getQuote-error',
      })
      if (error.message) {
        throw new GraphQLError(error.message)
      } else if (error.response?.data?.message) {
        throw new GraphQLError(error.response.data.message)
      } else {
        throw new GraphQLError(error)
      }
    }
  },
  getQuotes: async (
    _: any,
    {
      organization,
      costCenter,
      status,
      search,
      page,
      pageSize,
      sortOrder,
      sortedBy,
    }: {
      organization: string[]
      costCenter: string[]
      status: string[]
      search: string
      page: number
      pageSize: number
      sortOrder: string
      sortedBy: string
    },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
      vtex,
      vtex: { logger },
    } = ctx

    const { sessionData, storefrontPermissions, segmentData } = vtex as any

    if (
      !storefrontPermissions?.permissions?.length ||
      !sessionData?.namespaces['storefront-permissions']?.organization?.value ||
      !sessionData?.namespaces['storefront-permissions']?.costcenter?.value
    ) {
      return null
    }

    const { permissions } = storefrontPermissions
    const userOrganizationId =
      sessionData.namespaces['storefront-permissions'].organization.value

    const userCostCenterId =
      sessionData.namespaces['storefront-permissions'].costcenter.value

    if (
      !permissions.some(
        (permission: string) => permission.indexOf('access-quotes') >= 0
      )
    ) {
      return null
    }

    const userSalesChannel = segmentData?.channel

    await checkConfig(ctx)

    const where = await buildWhereStatement({
      permissions,
      organization,
      costCenter,
      status,
      search,
      userOrganizationId,
      userCostCenterId,
      userSalesChannel,
    })

    try {
      return await masterdata.searchDocumentsWithPaginationInfo({
        dataEntity: QUOTE_DATA_ENTITY,
        fields: QUOTE_FIELDS,
        pagination: { page, pageSize },
        schema: SCHEMA_VERSION,
        sort: `${sortedBy} ${sortOrder}`,
        ...(where && { where }),
      })
    } catch (error) {
      logger.error({
        error,
        message: 'getQuotes-error',
      })
      throw new GraphQLError(error)
    }
  },
  getChildrenQuotes: async (
    _: any,
    {
      id,
      sortOrder,
      sortedBy,
    }: {
      id: string
      sortOrder: string
      sortedBy: string
    },
    ctx: Context
  ) => {
    const {
      vtex: { logger },
    } = ctx

    await checkConfig(ctx)
    const sellerQuotesController = new SellerQuotesController(ctx)

    try {
      return await sellerQuotesController.getAllChildrenQuotes(
        id,
        sortOrder,
        sortedBy
      )
    } catch (error) {
      logger.error({
        error,
        message: 'getQuotes-error',
      })
      throw new GraphQLError(error)
    }
  },
  getQuoteEnabledForUser: async (
    _: any,
    { email }: { email: string },
    ctx: Context
  ) => {
    const {
      vtex: { logger },
    } = ctx

    try {
      // if user is part of a buyer org, quote functionality is enabled
      return await isUserPartOfBuyerOrg(email, ctx)
    } catch (error) {
      logger.error({
        error,
        message: 'getQuoteEnabledForUser-error',
      })
      throw new GraphQLError(error)
    }
  },
  getAppSettings: async (_: void, __: void, ctx: Context) => {
    const {
      clients: { vbase },
      vtex: { logger },
    } = ctx

    await checkConfig(ctx)
    let settings = null

    try {
      settings = await vbase.getJSON<Settings | null>(
        APP_NAME,
        'settings',
        true
      )
    } catch (error) {
      logger.error({
        error,
        message: 'getAppSettings-getVbaseError',
      })

      return null
    }

    if (settings && !settings?.adminSetup.quotesManagedBy) {
      settings.adminSetup.quotesManagedBy = 'MARKETPLACE'
    }

    return settings
  },
  checkSellerQuotes: async (
    _: void,
    { sellers }: { sellers: string[] },
    ctx: Context
  ) => {
    // guarantee at least the marketplace seller to use your name if necessary
    const allSellers = sellers.filter((seller) => seller !== '1')

    allSellers.push('1')

    const verifiedSellers = await Promise.all(
      allSellers.map(async (seller) => {
        if (seller === '1') {
          return ctx.clients.seller.getSeller(seller)
        }

        const verifyResponse = await ctx.clients.sellerQuotes
          .verifyQuoteSettings(seller)
          .catch(() => null)

        if (verifyResponse?.receiveQuotes) {
          return ctx.clients.seller.getSeller(seller)
        }

        return null
      })
    )

    return verifiedSellers.filter(Boolean)
  },
}
