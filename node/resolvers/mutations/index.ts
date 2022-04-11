import { indexBy, map, prop } from 'ramda'

import {
  checkConfig,
  checkAndCreateQuotesConfig,
  defaultSettings,
} from '../utils/checkConfig'
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

export const Mutation = {
  clearCart: async (_: any, params: any, ctx: Context) => {
    const {
      vtex: { account, logger },
      clients: { hub },
    } = ctx

    try {
      // CLEAR CURRENT CART
      await hub.post(routes.clearCart(account, params.orderFormId), {
        expectedOrderFormSections: ['items'],
      })
    } catch (e) {
      logger.error({
        e,
        message: 'clearCart-error',
      })
      if (e.message) {
        throw new GraphQLError(e.message)
      } else if (e.response?.data?.message) {
        throw new GraphQLError(e.response.data.message)
      } else {
        throw new GraphQLError(e)
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

    const { sessionData, storefrontPermissions } = vtex as any

    const settings = await checkConfig(ctx)

    if (!sessionData?.namespaces['storefront-permissions']?.organization) {
      throw new GraphQLError('organization-data-not-found')
    }

    if (!sessionData?.namespaces?.profile?.email?.value) {
      throw new GraphQLError('email-not-found')
    }

    if (!storefrontPermissions?.permissions?.includes('create-quotes')) {
      throw new GraphQLError('operation-not-permitted')
    }

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

    const quote = {
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
      viewedByCustomer: sendToSalesRep,
      viewedBySales: !sendToSalesRep,
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
          .catch((e) => {
            logger.error({
              error: e,
              message: `[Quote updated] E-mail not sent`,
            })
          })
      }

      return data.DocumentId
    } catch (e) {
      logger.error({
        e,
        message: 'createQuote-error',
      })
      if (e.message) {
        throw new GraphQLError(e.message)
      } else if (e.response?.data?.message) {
        throw new GraphQLError(e.response.data.message)
      } else {
        throw new GraphQLError(e)
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

    if (!sessionData?.namespaces['storefront-permissions']) {
      throw new GraphQLError('organization-data-not-found')
    }

    if (!sessionData?.namespaces?.profile?.email?.value) {
      throw new GraphQLError('email-not-found')
    }

    const email = sessionData.namespaces.profile.email.value
    const {
      permissions,
      role: { slug },
    } = storefrontPermissions

    const isCustomer = slug.includes('customer')
    const isSales = slug.includes('sales')
    const itemsChanged = items?.length > 0

    if (
      (itemsChanged &&
        !permissions.some((permission: string) =>
          permission.includes('edit-quotes')
        )) ||
      (!itemsChanged &&
        !permissions.some((permission: string) =>
          permission.includes('access-quotes')
        )) ||
      (decline && !permissions.includes('decline-quotes'))
    ) {
      throw new GraphQLError('operation-not-permitted')
    }

    const {
      organization: { value: userOrganizationId },
      costcenter: { value: userCostCenterId },
    } = sessionData.namespaces['storefront-permissions']

    const now = new Date()
    const nowISO = now.toISOString()

    try {
      const existingQuote = (await masterdata.getDocument({
        dataEntity: QUOTE_DATA_ENTITY,
        fields: QUOTE_FIELDS,
        id,
      })) as Quote

      if (!existingQuote) {
        throw new GraphQLError('quote-not-found')
      }

      if (
        existingQuote.status === 'expired' ||
        existingQuote.status === 'declined'
      ) {
        throw new GraphQLError('quote-cannot-be-updated')
      }

      const expirationChanged = expirationDate !== existingQuote.expirationDate

      if (
        expirationChanged &&
        !permissions.some((permission: string) =>
          permission.includes('edit-quotes')
        )
      ) {
        throw new GraphQLError('operation-not-permitted')
      }

      // if user only has permission to edit their organization's quotes, check that the org matches
      if (
        ((itemsChanged || expirationChanged) &&
          !permissions.includes('edit-quotes-all') &&
          permissions.includes('edit-quotes-organization')) ||
        (!itemsChanged &&
          !expirationChanged &&
          !permissions.includes('access-quotes-all') &&
          permissions.includes('access-quotes-organization'))
      ) {
        if (userOrganizationId !== existingQuote.organization) {
          throw new GraphQLError('operation-not-permitted')
        }
      }

      // if user only has permission to edit their cost center's quotes, check that the cost center matches
      if (
        ((itemsChanged || expirationChanged) &&
          !permissions.includes('edit-quotes-all') &&
          !permissions.includes('edit-quotes-organization')) ||
        (!itemsChanged &&
          !expirationChanged &&
          !permissions.includes('access-quotes-all') &&
          !permissions.includes('access-quotes-organization'))
      ) {
        if (userCostCenterId !== existingQuote.costCenter) {
          throw new GraphQLError('operation-not-permitted')
        }
      }

      const status = decline ? 'declined' : itemsChanged ? 'ready' : 'revised'

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

      const updatedQuote = {
        ...existingQuote,
        expirationDate: expirationChanged
          ? expirationDate
          : existingQuote.expirationDate,
        items: itemsChanged ? items : existingQuote.items,
        lastUpdate,
        status,
        subtotal: subtotal ?? existingQuote.subtotal,
        updateHistory,
        viewedByCustomer: decline || isCustomer,
        viewedBySales: decline || isSales,
      } as Quote

      const data = await masterdata
        .updateEntireDocument({
          dataEntity: QUOTE_DATA_ENTITY,
          fields: updatedQuote,
          id,
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
        .catch((e) => {
          logger.error({
            error: e,
            message: `[Quote updated] E-mail not sent`,
          })
        })

      return data.id
    } catch (e) {
      logger.warn({
        e,
        message: 'updateQuote-warning',
      })
      if (e.message) {
        throw new GraphQLError(e.message)
      } else if (e.response?.data?.message) {
        throw new GraphQLError(e.response.data.message)
      } else {
        throw new GraphQLError(e)
      }
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

    const { sessionData, storefrontPermissions } = vtex as any

    if (!sessionData?.namespaces['storefront-permissions']) {
      throw new GraphQLError('organization-data-not-found')
    }

    if (!sessionData?.namespaces?.profile?.email?.value) {
      throw new GraphQLError('email-not-found')
    }

    // const email = sessionData.namespaces.profile.email.value
    const { permissions } = storefrontPermissions

    if (!permissions.includes('use-quotes')) {
      throw new GraphQLError('operation-not-permitted')
    }

    const token = ctx.cookies.get(`VtexIdclientAutCookie`)

    const useHeaders = {
      'Content-Type': 'application/json',
      Cookie: `VtexIdclientAutCookie=${token};`,
    }

    try {
      // GET QUOTE DATA
      const quote = (await masterdata.getDocument({
        dataEntity: QUOTE_DATA_ENTITY,
        fields: QUOTE_FIELDS,
        id,
      })) as Quote

      if (quote.status === 'declined' || quote.status === 'expired') {
        throw new GraphQLError('quote-cannot-be-used')
      }

      const { items } = quote

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
        .catch((e) =>
          logger.error({
            e,
            message: 'useQuote-addCustomDataError',
          })
        )

      // ADD ITEMS TO CART
      const data = await hub
        .post(routes.addToCart(account, orderFormId), {
          expectedOrderFormSections: ['items'],
          orderItems: items.map((item) => {
            return {
              id: item.id,
              quantity: item.quantity,
              seller: item.seller || '1',
            }
          }),
        })
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
    } catch (e) {
      logger.error({
        e,
        message: 'useQuote-error',
      })
      if (e.message) {
        throw new GraphQLError(e.message)
      } else if (e.response?.data?.message) {
        throw new GraphQLError(e.response.data.message)
      } else {
        throw new GraphQLError(e)
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
