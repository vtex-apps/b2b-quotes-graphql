import { indexBy, map, prop } from 'ramda'

import {
  APP_NAME,
  QUOTE_DATA_ENTITY,
  QUOTE_FIELDS,
  routes,
  SCHEMA_VERSION,
} from '../../constants'
import { sendCreateQuoteMetric } from '../../metrics/createQuote'
import type { UseQuoteMetricsParams } from '../../metrics/useQuote'
import { sendUseQuoteMetric } from '../../metrics/useQuote'
import { isEmail } from '../../utils'
import GraphQLError from '../../utils/GraphQLError'
import message from '../../utils/message'
import {
  checkAndCreateQuotesConfig,
  checkConfig,
  defaultSettings,
} from '../utils/checkConfig'
import {
  checkOperationsForUpdateQuote,
  checkPermissionsForUpdateQuote,
  checkQuoteStatus,
  checkSession,
} from '../utils/checkPermissions'

interface SellerQuote {
  items: QuoteItem[]
  referenceName: string
  note: string
  sendToSalesRep: boolean
  subtotal: number
}

interface QuoteSessionData {
  namespaces: {
    [key: string]: any // Dynamic keys allowed
  }
}

const createQuoteObject = ({
  sessionData,
  storefrontPermissions,
  segmentData,
  settings,
  items,
  referenceName,
  subtotal,
  note,
  sendToSalesRep,
}: {
  sessionData: QuoteSessionData
  storefrontPermissions: string
  segmentData?: { channel?: string }
  settings?: Settings
  items: QuoteItem[]
  referenceName: string
  subtotal: number
  note: string
  sendToSalesRep: boolean
}): QuoteWithOptionalId => {
  const email = sessionData.namespaces.profile.email.value

  const {
    role: { slug },
  } = storefrontPermissions

  const {
    organization: { value: organizationId },
    costcenter: { value: costCenterId },
  } = sessionData.namespaces['storefront-permissions']

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
      role: slug,
      status,
    },
  ]

  const salesChannel: string = segmentData?.channel ?? ''

  return {
    costCenter: costCenterId,
    creationDate: nowISO,
    creatorEmail: email,
    creatorRole: slug,
    expirationDate: expirationDateISO,
    items,
    lastUpdate,
    organization: organizationId,
    referenceName,
    status,
    subtotal,
    updateHistory,
    viewedByCustomer: !!sendToSalesRep,
    viewedBySales: !sendToSalesRep,
    salesChannel,
  }
}

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
      input: { referenceName, items, subtotal, note, sendToSalesRep },
    }: {
      input: {
        referenceName: string
        items: QuoteItem[]
        subtotal: number
        note: string
        sendToSalesRep: boolean
      }
    },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
      vtex,
      vtex: { logger },
    } = ctx

    const settings = await checkConfig(ctx)
    const quoteBySeller: Record<string, SellerQuote> = {}
    const { sessionData, storefrontPermissions, segmentData } = vtex as any

    checkSession(sessionData)

    if (settings?.adminSetup.quotesManagedBy === 'SELLER') {
      items.forEach(({ seller, sellingPrice, ...itemData }) => {
        if (!quoteBySeller[seller]) {
          quoteBySeller[seller] = {
            items: [],
            referenceName,
            note,
            sendToSalesRep,
            subtotal: 0,
          }
        }

        quoteBySeller[seller].items.push({ seller, sellingPrice, ...itemData })
        quoteBySeller[seller].subtotal += sellingPrice
      })

      const documentIds = await Promise.all(
        Object.entries(quoteBySeller).map(async ([seller, sellerQuote]) => {
          const sellerQuoteObject = createQuoteObject({
            sessionData,
            storefrontPermissions,
            segmentData,
            settings: settings || undefined,
            items: sellerQuote.items,
            referenceName: sellerQuote.referenceName,
            subtotal: sellerQuote.subtotal,
            note: sellerQuote.note,
            sendToSalesRep: sellerQuote.sendToSalesRep,
          })

          const data = await masterdata.createDocument({
            dataEntity: QUOTE_DATA_ENTITY,
            fields: sellerQuoteObject,
            schema: SCHEMA_VERSION,
          })

          if (sendToSalesRep) {
            await message(ctx).quoteCreated({
              costCenter: sellerQuoteObject.costCenter,
              id: data.DocumentId,
              lastUpdate: {
                email: sellerQuoteObject.creatorEmail,
                note: sellerQuote.note,
                status: sellerQuoteObject.status.toUpperCase(),
              },
              name: sellerQuote.referenceName,
              organization: sellerQuoteObject.organization,
            })

            logger.info({
              message: `[Quote created for seller: ${seller}] E-mail sent to sales reps`,
            })
          }

          const metricsParam = {
            sessionData,
            userData: {
              orgId: sellerQuoteObject.organization,
              costId: sellerQuoteObject.costCenter,
              roleId: sellerQuoteObject.creatorRole,
            },
            costCenterName: 'costCenterData?.getCostCenterById?.name',
            buyerOrgName: 'organizationData?.getOrganizationById?.name',
            quoteId: data.DocumentId,
            quoteReferenceName: referenceName,
            sendToSalesRep,
            creationDate: sellerQuoteObject.creationDate,
          }

          sendCreateQuoteMetric(ctx, metricsParam)

          return data.DocumentId
        })
      )

      return documentIds
    }

    if (!storefrontPermissions?.permissions?.includes('create-quotes')) {
      throw new GraphQLError('operation-not-permitted')
    }

    const quote = createQuoteObject({
      sessionData,
      storefrontPermissions,
      segmentData,
      settings: settings || undefined,
      items,
      referenceName,
      subtotal,
      note,
      sendToSalesRep,
    })

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
            costCenter: quote.costCenter,
            id: data.DocumentId,
            lastUpdate: {
              email: quote.creatorEmail,
              note,
              status: quote.status.toUpperCase(),
            },
            name: referenceName,
            organization: quote.organization,
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
          orgId: quote.organization,
          costId: quote.costCenter,
          roleId: quote.creatorRole,
        },
        costCenterName: 'costCenterData?.getCostCenterById?.name',
        buyerOrgName: 'organizationData?.getOrganizationById?.name',
        quoteId: data.DocumentId,
        quoteReferenceName: referenceName,
        sendToSalesRep,
        creationDate: quote.creationDate,
      }

      sendCreateQuoteMetric(ctx, metricsParam)

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
      input: { id, items, subtotal, note, decline, expirationDate },
    }: {
      input: {
        id: string
        items: QuoteItem[]
        subtotal: number
        note: string
        decline: boolean
        expirationDate: string
      }
    },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
      vtex,
      vtex: { logger },
    } = ctx

    const { sessionData, storefrontPermissions } = vtex as any

    checkSession(sessionData)

    const email = sessionData.namespaces.profile.email.value
    const {
      permissions,
      role: { slug },
    } = storefrontPermissions

    const isCustomer = slug.includes('customer')
    const isSales = slug.includes('sales')
    const itemsChanged = items?.length > 0

    checkPermissionsForUpdateQuote({
      permissions,
      itemsChanged,
      decline,
    })

    const {
      organization: { value: userOrganizationId },
      costcenter: { value: userCostCenterId },
    } = sessionData.namespaces['storefront-permissions']

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

      checkOperationsForUpdateQuote({
        permissions,
        expirationChanged,
        itemsChanged,
        existingQuote,
        userCostCenterId,
        userOrganizationId,
        declineQuote: decline,
      })

      const readyOrRevised = itemsChanged ? 'ready' : 'revised'
      const status = decline ? 'declined' : readyOrRevised

      const lastUpdate = nowISO
      const update = {
        date: nowISO,
        email,
        note,
        role: slug,
        status,
      }

      const { updateHistory } = existingQuote

      updateHistory.push(update)

      const updatedQuote: Quote = {
        ...existingQuote,
        expirationDate: expirationChanged
          ? expirationDate
          : existingQuote.expirationDate,
        items: itemsChanged ? items : existingQuote.items,
        lastUpdate,
        status,
        subtotal: subtotal ?? existingQuote.subtotal,
        updateHistory,
        viewedByCustomer: !!(decline || isCustomer),
        viewedBySales: !!(decline || isSales),
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

      return data.id
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
      vtex: { account, logger, authToken },
    } = ctx

    const { sessionData, storefrontPermissions } = vtex as any

    checkSession(sessionData)

    const { permissions } = storefrontPermissions

    if (!permissions.includes('use-quotes')) {
      throw new GraphQLError('operation-not-permitted')
    }

    const useHeaders = {
      'Content-Type': 'application/json',
      Cookie: `VtexIdclientAutCookie=${authToken};`,
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
          price: prop(item.id, sellingPriceMap).price,
          quantity: null,
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
        userEmail: sessionData?.namespaces?.profile?.email?.value,
      }

      sendUseQuoteMetric(ctx, metricParams)
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
    {
      input: { cartLifeSpan, quotesManagedBy = 'MARKETPLACE' },
    }: { input: { cartLifeSpan: number; quotesManagedBy: string } },
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
        quotesManagedBy,
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
