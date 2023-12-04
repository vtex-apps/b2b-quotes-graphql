import { indexBy, map, prop } from 'ramda'
import { UserInputError } from '@vtex/api'

import {
  checkConfig,
  checkAndCreateQuotesConfig,
  defaultSettings,
} from '../utils/checkConfig'
import {
  checkSession,
  checkPermissionsForUpdateQuote,
  checkQuoteStatus,
  checkOperationsForUpdateQuote,
} from '../utils/checkPermissions'
import { isEmail } from '../../utils'
import GraphQLError from '../../utils/GraphQLError'
import message from '../../utils/message'
import {
  APP_NAME,
  QUOTE_DATA_ENTITY,
  QUOTE_FIELDS,
  SCHEMA_VERSION,
  routes,
} from '../../constants'
import { sendCreateQuoteMetric } from '../../metrics/createQuote'
import type { UseQuoteMetricsParams } from '../../metrics/useQuote'
import { sendUseQuoteMetric } from '../../metrics/useQuote'

export const Mutation = {
  clearCart: async (_: any, params: any, ctx: Context) => {
    const {
      vtex: { account, logger },
      clients: { hub },
    } = ctx

    try {
      await hub.post(routes.clearCart(account, params.orderFormId), {
        expectedOrderFormSections: ['items'],
      })
    } catch (error) {
      logger.error({
        error,
        message: 'clearCart-error',
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
  createQuote: async (
    _: any,
    {
      input: {
        referenceName,
        items,
        subtotal,
        note,
        sendToSalesRep,
        organization,
        costCenter,
        role: roleName,
      },
    }: {
      input: {
        referenceName: string
        items: QuoteItem[]
        subtotal: number
        note: string
        sendToSalesRep: boolean
        organization?: string
        costCenter?: string
        role: string
      }
    },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
      vtex,
      vtex: { logger },
    } = ctx

    const {
      sessionData,
      storefrontPermissions,
      segmentData,
      authenticatedUser,
    } = vtex as any

    const isAdmin = !!(
      authenticatedUser ||
      (sessionData?.namespaces?.authentication?.adminUserEmail?.value &&
        !storefrontPermissions?.permissions?.length)
    )

    const settings = await checkConfig(ctx)

    if (!isAdmin) {
      checkSession(sessionData)
    }

    if (
      !storefrontPermissions?.permissions?.includes('create-quotes') &&
      !isAdmin
    ) {
      throw new GraphQLError('operation-not-permitted')
    }

    if (isAdmin) {
      if (!organization || !costCenter) {
        throw new UserInputError(
          'organizationId and costcenterId are required.'
        )
      }
    }

    const email =
      sessionData?.namespaces?.profile?.email?.value ||
      authenticatedUser?.user ||
      sessionData?.namespaces?.authentication?.adminUserEmail?.value

    const { role } = storefrontPermissions || {}

    const { slug } = role || {}

    const newRole = isAdmin ? roleName || 'admin' : slug

    const organizationId =
      sessionData?.namespaces?.['storefront-permissions']?.organization
        ?.value || organization

    const costCenterId =
      sessionData?.namespaces?.['storefront-permissions']?.costcenter?.value ||
      costCenter

    const now = new Date()
    const nowISO = now.toISOString()
    const expirationDate = new Date()

    expirationDate.setDate(
      expirationDate.getDate() + (settings?.adminSetup?.cartLifeSpan ?? 30)
    )
    const expirationDateISO = expirationDate.toISOString()

    const status = sendToSalesRep ? 'pending' : 'ready'
    const lastUpdate = nowISO
    const updateHistory = [
      {
        date: nowISO,
        email,
        note,
        role: newRole,
        status,
      },
    ]

    const salesChannel: string = segmentData?.channel

    const quote = {
      costCenter: costCenterId,
      creationDate: nowISO,
      creatorEmail: email,
      creatorRole: newRole,
      expirationDate: expirationDateISO,
      items,
      lastUpdate,
      organization: organizationId,
      referenceName,
      status,
      subtotal,
      updateHistory,
      viewedByCustomer: sendToSalesRep,
      viewedBySales: !sendToSalesRep,
      salesChannel,
    }

    try {
      const data = await masterdata
        .createDocument({
          dataEntity: QUOTE_DATA_ENTITY,
          fields: quote,
          schema: SCHEMA_VERSION,
        })
        .then((res: any) => res)

      if (sendToSalesRep) {
        message(ctx)
          .quoteCreated({
            costCenter: costCenterId,
            id: data.DocumentId,
            lastUpdate: {
              email,
              note,
              status: status.toUpperCase(),
            },
            name: referenceName,
            organization: organizationId,
          })
          .then(() => {
            logger.info({
              message: `[Quote created] E-mail sent to sales reps`,
            })
          })
      }

      const metricsParam = {
        sessionData,
        userData: {
          orgId: organizationId,
          costId: costCenterId,
          roleId: newRole,
        },
        costCenterName: 'costCenterData?.getCostCenterById?.name',
        buyerOrgName: 'organizationData?.getOrganizationById?.name',
        quoteId: data.DocumentId,
        quoteReferenceName: referenceName,
        sendToSalesRep,
        creationDate: nowISO,
      }

      sendCreateQuoteMetric(metricsParam)

      return data.DocumentId
    } catch (error) {
      logger.error({
        error,
        message: 'createQuote-error ',
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
  updateQuote: async (
    _: any,
    {
      input: {
        id,
        items,
        subtotal,
        note,
        decline,
        expirationDate,
        organization,
        costCenter,
        role: roleName
      },
    }: {
      input: {
        id: string
        items: QuoteItem[]
        subtotal: number
        note: string
        decline: boolean
        expirationDate: string
        organization: string
        costCenter: string
        role: string
      }
    },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
      vtex,
      vtex: { logger },
    } = ctx

    const {
      sessionData,
      storefrontPermissions,
      authenticatedUser,
    } = vtex as any

    const isAdmin = !!(
      authenticatedUser ||
      (sessionData?.namespaces?.authentication?.adminUserEmail?.value &&
        !storefrontPermissions?.permissions?.length)
    )

    if (!isAdmin) {
      checkSession(sessionData)
    }

    if (isAdmin) {
      if (!organization || !costCenter) {
        throw new UserInputError(
          'organizationId and costcenterId are required.'
        )
      }
    }

    const email =
      sessionData?.namespaces?.profile?.email?.value ||
      authenticatedUser?.user ||
      sessionData?.namespaces?.authentication?.adminUserEmail?.value

    const { permissions, role } = storefrontPermissions || {}

    const { slug } = role || {}

    const isCustomer = slug?.includes('customer')
    const isSales = slug?.includes('sales')
    const itemsChanged = items?.length > 0

    if (!isAdmin) {
      checkPermissionsForUpdateQuote({
        permissions,
        itemsChanged,
        decline,
      })
    }

    const userOrganizationId =
      sessionData?.namespaces?.['storefront-permissions']?.organization
        ?.value || organization

    const userCostCenterId =
      sessionData?.namespaces?.['storefront-permissions']?.costcenter?.value ||
      costCenter

    const now = new Date()
    const nowISO = now.toISOString()

    try {
      const existingQuote: Quote = await masterdata.getDocument({
        dataEntity: QUOTE_DATA_ENTITY,
        fields: QUOTE_FIELDS,
        id,
      })

      checkQuoteStatus(existingQuote)

      const expirationChanged = expirationDate !== existingQuote.expirationDate

      if (!isAdmin) {
        checkOperationsForUpdateQuote({
          permissions,
          expirationChanged,
          itemsChanged,
          existingQuote,
          userCostCenterId,
          userOrganizationId,
          declineQuote: decline,
        })
      } else {
        if (userOrganizationId !== existingQuote.organization) {
          throw new GraphQLError('operation-not-permitted')
        }

        if (userCostCenterId !== existingQuote.costCenter) {
          throw new GraphQLError('operation-not-permitted')
        }
      }

      const readyOrRevised = itemsChanged ? 'ready' : 'revised'
      const status = decline ? 'declined' : readyOrRevised

      const lastUpdate = nowISO
      const update = {
        date: nowISO,
        email,
        note,
        role: isAdmin ? roleName || 'admin' : slug,
        status,
      }

      const { updateHistory } = existingQuote

      updateHistory.push(update)

      const updatedQuote: Quote = {
        ...existingQuote,
        expirationDate: expirationChanged
          ? expirationDate
          : existingQuote.expirationDate,
        items: itemsChanged ? items : existingQuote?.items || [],
        lastUpdate,
        status,
        subtotal: subtotal ?? existingQuote.subtotal,
        updateHistory,
        viewedByCustomer: decline || isCustomer,
        viewedBySales: decline || isSales,
      }

      const data = await masterdata
        .updateEntireDocument({
          dataEntity: QUOTE_DATA_ENTITY,
          fields: updatedQuote,
          id,
          schema: SCHEMA_VERSION,
        })
        .then((res: any) => res)

      const users = updateHistory.map((anUpdate) => anUpdate.email)
      const uniqueUsers = [
        ...new Set(
          users.filter((userEmail: string) => isEmail.test(userEmail))
        ),
      ]

      message(ctx)
        .quoteUpdated({
          costCenter: existingQuote.costCenter,
          id: existingQuote.id,
          lastUpdate: {
            email,
            note,
            status: status.toUpperCase(),
          },
          name: existingQuote.referenceName,
          organization: existingQuote.organization,
          users: uniqueUsers,
        })
        .then(() => {
          logger.info({
            message: `[Quote updated] E-mail sent ${uniqueUsers.join(', ')}`,
          })
        })

      return data?.id || existingQuote.id
    } catch (error) {
      logger.warn({
        error,
        message: 'updateQuote-warning',
      })
      throw new GraphQLError(error)
    }
  },
  useQuote: async (
    _: any,
    { id, orderFormId }: { id: string; orderFormId: string },
    ctx: Context
  ) => {
    const {
      clients: { masterdata, hub },
      vtex,
      vtex: { account, logger },
    } = ctx

    const {
      sessionData,
      storefrontPermissions,
      authenticatedUser,
    } = vtex as any

    const isAdmin = !!(
      authenticatedUser ||
      (sessionData?.namespaces?.authentication?.adminUserEmail?.value &&
        !storefrontPermissions?.permissions?.length)
    )

    if (!isAdmin) {
      checkSession(sessionData)
    }

    const { permissions } = storefrontPermissions || {}

    if (!permissions?.includes('use-quotes') && !isAdmin) {
      throw new GraphQLError('operation-not-permitted')
    }

    const token =
      ctx.cookies.get(`VtexIdclientAutCookie_${account}`) ||
      authenticatedUser?.token

    const useHeaders = {
      'Content-Type': 'application/json',
      Cookie: `VtexIdclientAutCookie=${token};`,
    }

    try {
      // GET QUOTE DATA
      const quote: Quote = await masterdata.getDocument({
        dataEntity: QUOTE_DATA_ENTITY,
        fields: QUOTE_FIELDS,
        id,
      })

      checkQuoteStatus(quote)

      const { items, salesChannel } = quote

      // CLEAR CURRENT CART
      if (orderFormId !== 'default-order-form') {
        await hub.post(
          routes.clearCart(account, orderFormId),
          {
            expectedOrderFormSections: ['items'],
          },
          useHeaders
        )
      }

      // CREATE CART IF IT DOESN'T EXIST YET
      if (orderFormId === 'default-order-form') {
        const newOrderForm = await hub.get(
          routes.orderForm(account),
          useHeaders
        )

        orderFormId = (newOrderForm.data as any).orderFormId
      }

      await checkAndCreateQuotesConfig(ctx)
      await hub
        .put(
          routes.addCustomData({
            account,
            orderFormId,
            appId: APP_NAME,
            property: 'quoteId',
          }),
          {
            value: id,
          },
          useHeaders
        )
        .then((res: any) => {
          return res.data
        })
        .catch((error) =>
          logger.error({
            error,
            message: 'useQuote-addCustomDataError',
          })
        )

      const salesChannelQueryString = salesChannel ? `?sc=${salesChannel}` : ''

      // ADD ITEMS TO CART
      const data = await hub
        .post(
          `${routes.addToCart(account, orderFormId)}${salesChannelQueryString}`,
          {
            expectedOrderFormSections: ['items'],
            orderItems: items.map((item) => {
              return {
                id: item.id,
                quantity: item.quantity,
                seller: item.seller || '1',
              }
            }),
          }
        )
        .then((res: any) => {
          return res.data
        })

      const { items: itemsAdded } = data

      const sellingPriceMap = indexBy(
        prop('id'),
        map(
          (item: any) => ({
            id: item.id,
            price: item.sellingPrice,
          }),
          items
        )
      )

      const orderItems: any[] = []

      itemsAdded.forEach((item: any, key: number) => {
        orderItems.push({
          index: key,
          price: prop(item.id, sellingPriceMap)?.price,
          quantity: item.quantity,
        })
      })

      await hub.post(
        routes.addPriceToItems(account, orderFormId),
        {
          orderItems,
        },
        useHeaders
      )

      const metricParams: UseQuoteMetricsParams = {
        quote,
        orderFormId,
        account,
        userEmail:
          sessionData?.namespaces?.profile?.email?.value ||
          authenticatedUser?.user,
      }

      sendUseQuoteMetric(metricParams)
    } catch (error) {
      logger.error({
        error,
        message: 'useQuote-error',
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
  saveAppSettings: async (
    _: void,
    { input: { cartLifeSpan } }: { input: { cartLifeSpan: number } },
    ctx: Context
  ) => {
    const {
      clients: { vbase },
      vtex: { logger },
    } = ctx

    let settings = null
    let noSettingsFound = false

    try {
      settings = await vbase.getJSON<Settings | null>(
        APP_NAME,
        'settings',
        true
      )
    } catch (error) {
      logger.error({
        error,
        message: 'saveAppSettings-getAppSettingsError',
      })

      return null
    }

    if (!settings) {
      settings = defaultSettings
      noSettingsFound = true
    }

    const newSettings = {
      ...settings,
      adminSetup: {
        ...settings.adminSetup,
        cartLifeSpan,
      },
    }

    try {
      await vbase.saveJSON(APP_NAME, 'settings', newSettings)
    } catch (error) {
      logger.error({
        error,
        message: 'saveAppSettings-saveAppSettingsError',
      })

      return noSettingsFound ? null : settings
    }

    return newSettings
  },
}
