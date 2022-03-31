import { indexBy, map, prop } from 'ramda'

import { CHECKOUT_APP } from '../clients/checkout'
import templates from '../templates'
import { isEmail, toHash } from '../utils'
import GraphQLError from '../utils/GraphQLError'
import message from '../utils/message'
import { processQueue } from '../utils/Queue'
import { costCenterName, organizationName } from './fieldResolvers'

export const SCHEMA_VERSION = 'v1.2'

export const QUOTE_DATA_ENTITY = 'quotes'

const CRON_EXPRESSION = '0 */12 * * *'

export const QUOTE_FIELDS = [
  'id',
  'referenceName',
  'creatorEmail',
  'creatorRole',
  'creationDate',
  'expirationDate',
  'lastUpdate',
  'updateHistory',
  'items',
  'subtotal',
  'status',
  'organization',
  'costCenter',
  'viewedBySales',
  'viewedByCustomer',
]

const routes = {
  addCustomData: (
    account: string,
    orderFormId: string,
    appId: string,
    property?: string
    // eslint-disable-next-line max-params
  ) =>
    `${routes.orderForm(account)}/${orderFormId}/customData/${appId}/${
      property ?? ''
    }`,
  addPriceToItems: (account: string, orderFormId: string) =>
    `${routes.orderForm(account)}/${orderFormId}/items/update`,
  addToCart: (account: string, orderFormId: string) =>
    `${routes.orderForm(account)}/${orderFormId}/items/`,
  baseUrl: (account: string) =>
    `http://${account}.vtexcommercestable.com.br/api`,
  checkoutConfig: (account: string) =>
    `${routes.baseUrl(account)}/checkout/pvt/configuration/orderForm`,
  clearCart: (account: string, id: string) =>
    `${routes.orderForm(account)}/${id}/items/removeAll`,
  getQuote: (account: string, id: string) =>
    `${routes.quoteEntity(
      account
    )}/documents/${id}?_fields=id,email,cartName,status,description,items,creationDate,subtotal,discounts,shipping,taxes,total,customData,address`,
  listQuotes: (account: string, email: string) =>
    `${routes.quoteEntity(
      account
    )}/search?email=${email}&_schema=${SCHEMA_VERSION}&_fields=id,email,cartName,status,description,items,creationDate,subtotal,discounts,taxes,shipping,total,customData,address&_sort=creationDate DESC`,
  orderForm: (account: string) =>
    `${routes.baseUrl(account)}/checkout/pub/orderForm`,
  quoteEntity: (account: string) =>
    `${routes.baseUrl(account)}/dataentities/quote`,
  saveSchema: (account: string) =>
    `${routes.quoteEntity(account)}/schemas/${SCHEMA_VERSION}`,
}

const getAppId = (): string => {
  return process.env.VTEX_APP_ID ?? ''
}

const schema = {
  properties: {
    costCenter: {
      title: 'Cost Center',
      type: ['null', 'string'],
    },
    creationDate: {
      format: 'date-time',
      title: 'Creation Date',
      type: 'string',
    },
    creatorEmail: {
      title: 'Creator Email',
      type: 'string',
    },
    creatorRole: {
      title: 'Creator Role',
      type: 'string',
    },
    expirationDate: {
      format: 'date-time',
      title: 'Expiration Date',
      type: 'string',
    },
    items: {
      title: 'Cart',
      type: 'array',
    },
    lastUpdate: {
      format: 'date-time',
      title: 'Last Update',
      type: 'string',
    },
    organization: {
      title: 'Organization',
      type: ['null', 'string'],
    },
    referenceName: {
      title: 'Reference Name',
      type: 'string',
    },
    status: {
      title: 'Status',
      type: 'string',
    },
    subtotal: {
      title: 'Subtotal',
      type: 'number',
    },
    updateHistory: {
      title: 'Update History',
      type: 'array',
    },
    viewedByCustomer: {
      title: 'Viewed by Customer',
      type: 'boolean',
    },
    viewedBySales: {
      title: 'Viewed by Sales',
      type: 'boolean',
    },
  },
  'v-cache': false,
  'v-default-fields': [
    'referenceName',
    'creatorEmail',
    'creationDate',
    'expirationDate',
    'lastUpdate',
    'items',
    'subtotal',
    'status',
  ],
  'v-immediate-indexing': true,
  'v-indexed': [
    'creatorEmail',
    'creationDate',
    'expirationDate',
    'lastUpdate',
    'referenceName',
    'status',
    'organization',
    'costCenter',
  ],
}

interface Settings {
  adminSetup: {
    cartLifeSpan: number
    allowManualPrice: boolean
    hasCron?: boolean
    cronExpression?: string
    cronWorkspace?: string
  }
  schemaVersion: string
  templateHash: string | null
}

const defaultSettings: Settings = {
  adminSetup: {
    allowManualPrice: false,
    cartLifeSpan: 30,
    hasCron: false,
  },
  schemaVersion: '',
  templateHash: null,
}

const defaultHeaders = (authToken: string) => ({
  Accept: 'application/vnd.vtex.ds.v10+json',
  'Content-Type': 'application/json',
  'Proxy-Authorization': authToken,
  VtexIdclientAutCookie: authToken,
})

// checks and configure the OrderForm based on quoteId
const checkAndCreateQuotesConfig = async (ctx: Context): Promise<any> => {
  const {
    clients: { checkout, vbase },
    vtex: { logger, authToken },
  } = ctx

  let hasQuoteConfig = false

  const saveQuotesConfig = async (flag: boolean) => {
    return vbase
      .saveJSON(CHECKOUT_APP, 'quotes', { quote: flag })
      .then(() => true)
      .catch((e) =>
        logger.error({
          e,
          message: 'vBaseSaveJson-error',
        })
      )
  }

  try {
    hasQuoteConfig =
      (await vbase.getJSON<{ quote: boolean }>(CHECKOUT_APP, 'quotes'))
        ?.quote ?? false
  } catch (error) {
    const errStr = error.toString()

    if (errStr.match(/404/gm)) {
      await saveQuotesConfig(false)
    } else {
      logger.error({
        error,
        message: 'vBaseSaveGet-error',
      })
    }
  }

  if (!hasQuoteConfig) {
    const checkoutConfig: any = await checkout
      .getOrderFormConfiguration()
      .catch((error) => {
        logger.error({
          error,
          message: 'getOrderFormConfiguration-error',
        })
      })

    if (
      checkoutConfig?.apps.findIndex(
        (currApp: any) => currApp.id === CHECKOUT_APP
      ) === -1
    ) {
      checkoutConfig.apps.push({
        fields: ['quoteId'],
        id: CHECKOUT_APP,
        major: 1,
      })
      const setCheckoutConfig: any = await checkout
        .setOrderFormConfiguration(checkoutConfig, authToken)
        .then(() => true)
        .catch((error) => {
          logger.error({
            error,
            message: 'setOrderFormConfiguration-error',
          })

          return false
        })

      if (setCheckoutConfig) {
        await saveQuotesConfig(true)
      }

      logger.info('setOrderFormConfiguration-success')
    } else {
      saveQuotesConfig(true)
    }
  }
}

const checkConfig = async (ctx: Context) => {
  const {
    vtex: { account, authToken, logger, workspace },
    clients: { hub, apps, mail, masterdata, scheduler },
  } = ctx

  const appId = 'vtex.b2b-quotes@0.x'
  let settings: Settings | null = null
  let changed = false

  const currTemplateHash = toHash(templates)

  try {
    settings = await apps.getAppSettings(appId)
  } catch (error) {
    logger.error({
      error,
      message: 'checkConfig-getAppSettingsError',
    })

    return null
  }

  if (
    !settings?.adminSetup?.hasCron ||
    settings?.adminSetup?.cronExpression !== CRON_EXPRESSION ||
    settings?.adminSetup?.cronWorkspace !== workspace
  ) {
    if (settings && settings.adminSetup === undefined) {
      settings.adminSetup = {
        ...defaultSettings.adminSetup,
      }
    }

    const cronQueue = await scheduler
      .getQueue()
      .then((data: any) => {
        return data
      })
      .catch(() => {
        return null
      })

    if (!cronQueue || cronQueue.expression !== CRON_EXPRESSION) {
      try {
        const time = new Date().getTime()
        const QueueSchedule = {
          id: 'b2b-quotes-graphql-queue-schedule',
          request: {
            body: null,
            headers: {
              'cache-control': 'no-cache',
              pragma: 'no-cache',
            },
            method: 'GET',
            uri: `https://${workspace}--${account}.myvtex.com/b2b-quotes-graphql/_v/0/process-queue?v=${time}`,
          },
          scheduler: {
            endDate: '2031-12-30T23:29:00',
            expression: CRON_EXPRESSION,
          },
        }

        await scheduler
          .createOrUpdate(QueueSchedule)
          .then(() => {
            if (!settings) {
              return
            }

            settings.adminSetup.hasCron = true
            settings.adminSetup.cronExpression = CRON_EXPRESSION
            settings.adminSetup.cronWorkspace = workspace
            changed = true
          })
          .catch((e: any) => {
            if (!settings) {
              return
            }

            if (e.response.status !== 304) {
              settings.adminSetup.hasCron = false
            } else {
              settings.adminSetup.hasCron = true
              settings.adminSetup.cronExpression = CRON_EXPRESSION
              settings.adminSetup.cronWorkspace = workspace
            }
          })
      } catch (e) {
        if (settings) {
          settings.adminSetup.hasCron = false
        }
      }
    }
  }

  if (!settings?.adminSetup?.cartLifeSpan) {
    settings = defaultSettings
    changed = true
  }

  if (settings?.schemaVersion !== SCHEMA_VERSION) {
    try {
      await masterdata.createOrUpdateSchema({
        dataEntity: QUOTE_DATA_ENTITY,
        schemaBody: schema,
        schemaName: SCHEMA_VERSION,
      })

      changed = true
      settings.schemaVersion = SCHEMA_VERSION
    } catch (e) {
      if (e.response.status >= 400) {
        settings.schemaVersion = ''
      } else {
        settings.schemaVersion = SCHEMA_VERSION
        changed = true
      }
    }
  }

  if (!settings?.adminSetup?.allowManualPrice) {
    try {
      const url = routes.checkoutConfig(account)
      const headers = defaultHeaders(authToken)

      const { data: checkoutConfig } = await hub.get(url, headers, schema)

      if (checkoutConfig.allowManualPrice !== true) {
        await hub.post(
          url,
          JSON.stringify({
            ...checkoutConfig,
            allowManualPrice: true,
          }),
          headers
        )
        changed = true
        settings.adminSetup.allowManualPrice = true
      }
    } catch (e) {
      settings.adminSetup.allowManualPrice = false
    }
  }

  if (!settings?.templateHash || settings.templateHash !== currTemplateHash) {
    const updates: Array<Promise<any>> = []

    templates.forEach((template) => {
      updates.push(mail.publishTemplate(template))
    })

    await Promise.all(updates)
      .then(() => {
        if (settings) {
          settings.templateHash = currTemplateHash
          changed = true
        }
      })
      .catch((e) => {
        logger.error({
          error: e,
          message: 'checkConfig-publishTemplateError',
        })
        throw new Error(e)
      })
  }

  if (changed) {
    await apps.saveAppSettings(appId, settings)
  }

  await checkAndCreateQuotesConfig(ctx)

  return settings
}

export const resolvers = {
  Mutation: {
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
                message: `[Quote created] E-mail sent to sales reps}`,
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

        const expirationChanged =
          expirationDate !== existingQuote.expirationDate

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
            routes.addCustomData(account, orderFormId, CHECKOUT_APP, 'quoteId'),
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
  },
  Query: {
    getQuote: async (_: any, { id }: { id: string }, ctx: Context) => {
      const {
        clients: { masterdata },
        vtex,
        vtex: { logger },
      } = ctx

      const { sessionData, storefrontPermissions } = vtex as any

      if (
        !storefrontPermissions?.permissions?.length ||
        !sessionData?.namespaces['storefront-permissions']?.organization
          ?.value ||
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

      await checkConfig(ctx)

      try {
        const quote = (await masterdata.getDocument({
          dataEntity: QUOTE_DATA_ENTITY,
          fields: QUOTE_FIELDS,
          id,
        })) as Quote

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

        return quote
      } catch (e) {
        logger.error({
          e,
          message: 'getQuote-error',
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
        clients: { masterdata, organizations },
        vtex,
        vtex: { logger },
      } = ctx

      const { sessionData, storefrontPermissions } = vtex as any

      if (
        !storefrontPermissions?.permissions?.length ||
        !sessionData?.namespaces['storefront-permissions']?.organization
          ?.value ||
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

      await checkConfig(ctx)
      const whereArray = []

      // if user only has permission to access their organization's quotes,
      // hard-code that organization into the masterdata search
      if (!permissions.includes('access-quotes-all')) {
        whereArray.push(`organization=${userOrganizationId}`)
      } else if (organization?.length) {
        // if user is filtering by organization name, look up organization ID
        const orgArray = [] as string[]

        organization.forEach(async (org) => {
          const organizationResult = await organizations.getOrganizationIDs(org)

          if (organizationResult?.data?.getOrganizations?.data?.length > 0) {
            organizationResult.data.getOrganizations.data.forEach(
              (element: any) => {
                orgArray.push(`organization=${element.id}`)
              }
            )
          }
        })
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
        // if user is filtering by cost center name, look up cost center ID
        const ccArray = [] as string[]
        const promises = [] as Array<Promise<unknown>>

        costCenter.forEach((cc) => {
          promises.push(organizations.getCostCenterIDs(cc))
        })

        const results = await Promise.all(promises)

        results.forEach((costCenterResult: any) => {
          if (costCenterResult?.data?.getCostCenters?.data?.length > 0) {
            costCenterResult.data.getCostCenters.data.forEach(
              (element: any) => {
                ccArray.push(`costCenter=${element.id}`)
              }
            )
          }
        })
        const costCenters = `(${ccArray.join(' OR ')})`

        whereArray.push(costCenters)
      }

      if (status?.length) {
        const statusArray = [] as string[]

        status.forEach((stat) => {
          statusArray.push(`status=${stat}`)
        })
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

      const where = whereArray.join(' AND ')

      try {
        const quotes = await masterdata.searchDocumentsWithPaginationInfo({
          dataEntity: QUOTE_DATA_ENTITY,
          fields: QUOTE_FIELDS,
          pagination: { page, pageSize },
          schema: SCHEMA_VERSION,
          sort: `${sortedBy} ${sortOrder}`,
          ...(where && { where }),
        })

        return quotes
      } catch (e) {
        logger.error({
          e,
          message: 'getQuotes-error',
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
    getSetupConfig: async (_: any, __: any, ___: Context) => {
      // deprecated
      return null
    },
  },
  Quote: {
    costCenterName,
    organizationName,
  },
  Routes: {
    host: async (ctx: Context) => {
      ctx.set('Content-Type', 'application/json')
      ctx.set('Cache-Control', 'no-cache, no-store')
      ctx.response.body = {
        host: ctx.vtex.host,
      }
    },
    queueHandler: async (ctx: Context) => {
      const date = new Date().toISOString()

      processQueue(ctx)
      ctx.set('Content-Type', 'application/json')
      ctx.set('Cache-Control', 'no-cache, no-store')
      ctx.response.body = { date, appId: getAppId() }
      ctx.response.status = 200
    },
  },
}
