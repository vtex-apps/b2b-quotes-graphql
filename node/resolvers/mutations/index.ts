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
import {
  createItemComparator,
  createQuoteObject,
  splitItemsBySeller,
} from '../utils/quotes'
import SellerQuotesController from '../utils/sellerQuotesController'

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
    const { sessionData, storefrontPermissions, segmentData } = vtex as any

    checkSession(sessionData)

    if (!storefrontPermissions?.permissions?.includes('create-quotes')) {
      throw new GraphQLError('operation-not-permitted')
    }

    try {
      let quoteBySeller: SellerQuoteMap = {}

      if (settings?.adminSetup.quotesManagedBy === 'SELLER') {
        const sellerItems = items.filter(
          ({ seller }) => seller && seller !== '1'
        )

        quoteBySeller = await splitItemsBySeller({
          ctx,
          items: sellerItems,
        })
      }

      const sellerQuotesQuantity = Object.keys(quoteBySeller).length

      const remainingItems = items.filter(
        (item) =>
          !Object.values(quoteBySeller).some((quote) =>
            quote.items.some(createItemComparator(item))
          )
      )

      const oneSellerQuoteAndNoRemainingItems =
        sellerQuotesQuantity === 1 && !remainingItems.length

      const isOnlyOneQuote =
        !sellerQuotesQuantity || oneSellerQuoteAndNoRemainingItems

      const [firstSellerQuote] = Object.values(quoteBySeller)

      let parentQuoteItems = sellerQuotesQuantity ? remainingItems : items

      if (isOnlyOneQuote && firstSellerQuote) {
        parentQuoteItems = firstSellerQuote.items
      }

      const quoteCommonFields = {
        sessionData,
        storefrontPermissions,
        segmentData,
        settings,
        referenceName,
        note,
        sendToSalesRep,
        sellerQuotesQuantity,
      }

      const parentQuote = createQuoteObject({
        ...quoteCommonFields,
        items: parentQuoteItems,
        subtotal,
        ...(isOnlyOneQuote &&
          firstSellerQuote && {
            seller: firstSellerQuote.seller,
            sellerName: firstSellerQuote.sellerName,
          }),
      })

      const { DocumentId: parentQuoteId } = await masterdata.createDocument({
        dataEntity: QUOTE_DATA_ENTITY,
        fields: parentQuote,
        schema: SCHEMA_VERSION,
      })

      if (isOnlyOneQuote && firstSellerQuote) {
        await ctx.clients.sellerQuotes.notifyNewQuote(
          firstSellerQuote.seller,
          parentQuoteId,
          parentQuote.creationDate
        )
      }

      if (!isOnlyOneQuote) {
        const childrenQuoteIds: string[] = []

        if (parentQuoteItems.length) {
          const marketplaceSubtotal = parentQuoteItems.reduce(
            (acc, item) => acc + item.sellingPrice * item.quantity,
            0
          )

          const marketplaceSeller = await ctx.clients.seller.getSeller('1')

          const marketplaceQuote = createQuoteObject({
            ...quoteCommonFields,
            items: parentQuoteItems,
            subtotal: marketplaceSubtotal,
            seller: '1',
            sellerName: marketplaceSeller?.name ?? ctx.vtex.account,
            parentQuote: parentQuoteId,
          })

          const {
            DocumentId: markerplaceQuoteId,
          } = await masterdata.createDocument({
            dataEntity: QUOTE_DATA_ENTITY,
            fields: marketplaceQuote,
            schema: SCHEMA_VERSION,
          })

          childrenQuoteIds.push(markerplaceQuoteId)
        }

        const sellerQuoteIds = await Promise.all(
          Object.entries(quoteBySeller).map(async ([seller, sellerQuote]) => {
            const sellerQuoteObject = createQuoteObject({
              ...quoteCommonFields,
              ...sellerQuote,
              parentQuote: parentQuoteId,
            })

            const data = await masterdata.createDocument({
              dataEntity: QUOTE_DATA_ENTITY,
              fields: sellerQuoteObject,
              schema: SCHEMA_VERSION,
            })

            await ctx.clients.sellerQuotes.notifyNewQuote(
              seller,
              data.DocumentId,
              sellerQuoteObject.creationDate
            )

            return data.DocumentId
          })
        )

        childrenQuoteIds.push(...sellerQuoteIds)

        if (childrenQuoteIds.length) {
          await masterdata.updatePartialDocument({
            dataEntity: QUOTE_DATA_ENTITY,
            fields: {
              hasChildren: true,
              childrenQuantity: childrenQuoteIds.length,
            },
            id: parentQuoteId,
            schema: SCHEMA_VERSION,
          })
        }
      }

      if (sendToSalesRep) {
        message(ctx)
          .quoteCreated({
            costCenter: parentQuote.costCenter,
            id: parentQuoteId,
            lastUpdate: {
              email: parentQuote.creatorEmail,
              note,
              status: parentQuote.status.toUpperCase(),
            },
            name: referenceName,
            organization: parentQuote.organization,
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
          orgId: parentQuote.organization,
          costId: parentQuote.costCenter,
          roleId: parentQuote.creatorRole,
        },
        costCenterName: 'costCenterData?.getCostCenterById?.name',
        buyerOrgName: 'organizationData?.getOrganizationById?.name',
        quoteId: parentQuoteId,
        quoteReferenceName: referenceName,
        sendToSalesRep,
        creationDate: parentQuote.creationDate,
      }

      sendCreateQuoteMetric(ctx, metricsParam)

      return parentQuoteId
    } catch (error) {
      logger.error({
        error,
        message: 'createQuote-error ',
      })

      const errorMessage =
        error.message || error.response?.data?.message || error

      throw new GraphQLError(errorMessage)
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

      const sellerQuotesController = new SellerQuotesController(ctx)

      if (existingQuote.parentQuote) {
        sellerQuotesController.handleParentQuoteSubtotalAndStatus(
          existingQuote.parentQuote
        )
      }

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
      const mainQuote: Quote = await masterdata.getDocument({
        dataEntity: QUOTE_DATA_ENTITY,
        fields: QUOTE_FIELDS,
        id,
      })

      const quotes: Quote[] = []
      const items: QuoteItem[] = []

      if (mainQuote.hasChildren) {
        const sellerQuotesController = new SellerQuotesController(ctx)
        const childrenQuotes = await sellerQuotesController.getAllChildrenQuotes(
          id
        )

        let errorsCount = 0

        for (const quote of childrenQuotes) {
          try {
            checkQuoteStatus(quote)
            quotes.push(quote)
          } catch (e) {
            if (++errorsCount === childrenQuotes.length) {
              throw e
            }

            continue
          }
        }
      } else {
        checkQuoteStatus(mainQuote)
        quotes.push(mainQuote)
      }

      for (const quote of quotes) {
        items.push(...quote.items)
      }

      const { salesChannel } = mainQuote

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

      for (const quote of quotes) {
        const metricParams: UseQuoteMetricsParams = {
          quote,
          orderFormId,
          account,
          userEmail: sessionData?.namespaces?.profile?.email?.value,
        }

        sendUseQuoteMetric(ctx, metricParams)
      }
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
