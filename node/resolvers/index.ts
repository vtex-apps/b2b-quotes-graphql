import { indexBy, map, prop } from 'ramda'

import { CHECKOUT_APP } from '../clients/checkout'
import { organizationName, costCenterName } from './fieldResolvers'
import templates from '../templates'
import { toHash } from '../utils'
import GraphQLError from '../utils/GraphQLError'
import message from '../utils/message'
import { processQueue } from '../utils/Queue'

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
  baseUrl: (account: string) =>
    `http://${account}.vtexcommercestable.com.br/api`,
  orderForm: (account: string) =>
    `${routes.baseUrl(account)}/checkout/pub/orderForm`,
  checkoutConfig: (account: string) =>
    `${routes.baseUrl(account)}/checkout/pvt/configuration/orderForm`,
  quoteEntity: (account: string) =>
    `${routes.baseUrl(account)}/dataentities/quote`,
  listQuotes: (account: string, email: string) =>
    `${routes.quoteEntity(
      account
    )}/search?email=${email}&_schema=${SCHEMA_VERSION}&_fields=id,email,cartName,status,description,items,creationDate,subtotal,discounts,taxes,shipping,total,customData,address&_sort=creationDate DESC`,
  getQuote: (account: string, id: string) =>
    `${routes.quoteEntity(
      account
    )}/documents/${id}?_fields=id,email,cartName,status,description,items,creationDate,subtotal,discounts,shipping,taxes,total,customData,address`,

  saveSchema: (account: string) =>
    `${routes.quoteEntity(account)}/schemas/${SCHEMA_VERSION}`,
  clearCart: (account: string, id: string) =>
    `${routes.orderForm(account)}/${id}/items/removeAll`,
  addToCart: (account: string, orderFormId: string) =>
    `${routes.orderForm(account)}/${orderFormId}/items/`,
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
}

const getAppId = (): string => {
  return process.env.VTEX_APP_ID ?? ''
}

const schema = {
  properties: {
    referenceName: {
      type: 'string',
      title: 'Reference Name',
    },
    creatorEmail: {
      type: 'string',
      title: 'Creator Email',
    },
    creatorRole: {
      type: 'string',
      title: 'Creator Role',
    },
    creationDate: {
      type: 'string',
      title: 'Creation Date',
      format: 'date-time',
    },
    expirationDate: {
      type: 'string',
      title: 'Expiration Date',
      format: 'date-time',
    },
    lastUpdate: {
      type: 'string',
      title: 'Last Update',
      format: 'date-time',
    },
    updateHistory: {
      type: 'array',
      title: 'Update History',
    },
    items: {
      type: 'array',
      title: 'Cart',
    },
    subtotal: {
      type: 'number',
      title: 'Subtotal',
    },
    status: {
      type: 'string',
      title: 'Status',
    },
    organization: {
      type: ['null', 'string'],
      title: 'Organization',
    },
    costCenter: {
      type: ['null', 'string'],
      title: 'Cost Center',
    },
    viewedBySales: {
      type: 'boolean',
      title: 'Viewed by Sales',
    },
    viewedByCustomer: {
      type: 'boolean',
      title: 'Viewed by Customer',
    },
  },
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
  'v-cache': false,
}

interface Settings {
  adminSetup: {
    cartLifeSpan: number
    allowManualPrice: boolean
    hasCron?: boolean
    cronExpression?: string
  }
  schemaVersion: string
  templateHash: string | null
}

const defaultSettings: Settings = {
  adminSetup: {
    cartLifeSpan: 30,
    allowManualPrice: false,
  },
  schemaVersion: '',
  templateHash: null,
}

const defaultHeaders = (authToken: string) => ({
  'Content-Type': 'application/json',
  Accept: 'application/vnd.vtex.ds.v10+json',
  VtexIdclientAutCookie: authToken,
  'Proxy-Authorization': authToken,
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
          message: 'vBaseSaveJson-error',
          e,
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
        message: 'vBaseSaveGet-error',
        error,
      })
    }
  }

  if (!hasQuoteConfig) {
    const checkoutConfig: any = await checkout
      .getOrderFormConfiguration()
      .catch((error) => {
        logger.error({
          message: 'getOrderFormConfiguration-error',
          error,
        })
      })

    if (
      checkoutConfig?.apps.findIndex(
        (currApp: any) => currApp.id === CHECKOUT_APP
      ) === -1
    ) {
      checkoutConfig.apps.push({
        major: 1,
        id: CHECKOUT_APP,
        fields: ['quoteId'],
      })
      const setCheckoutConfig: any = await checkout
        .setOrderFormConfiguration(checkoutConfig, authToken)
        .then(() => true)
        .catch((error) => {
          logger.error({
            message: 'setOrderFormConfiguration-error',
            error,
          })

          return false
        })

      if (setCheckoutConfig) {
        await saveQuotesConfig(true)
      }

      logger.info('the orderFom configuration has been completed')
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
      message: 'checkConfig-getAppSettingsError',
      error,
    })

    return null
  }

  if (
    !settings?.adminSetup.hasCron ||
    settings?.adminSetup.cronExpression !== CRON_EXPRESSION
  ) {
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
          scheduler: {
            expression: CRON_EXPRESSION,
            endDate: '2031-12-30T23:29:00',
          },
          request: {
            uri: `https://${workspace}--${account}.myvtex.com/b2b-quotes-graphql/_v/0/process-queue?v=${time}`,
            method: 'GET',
            headers: {
              'cache-control': 'no-cache',
              pragma: 'no-cache',
            },
            body: null,
          },
        }

        await scheduler
          .createOrUpdate(QueueSchedule)
          .then(() => {
            if (settings) {
              settings.adminSetup.hasCron = true
              settings.adminSetup.cronExpression = CRON_EXPRESSION
            }
          })
          .catch((e: any) => {
            if (settings) {
              settings.adminSetup.hasCron = false
              // eslint-disable-next-line vtex/prefer-early-return
              if (e.response.status === 304) {
                settings.adminSetup.hasCron = true
                settings.adminSetup.cronExpression = CRON_EXPRESSION
              }
            }
          })
      } catch (e) {
        console.error('Error saving cron =>', e)
        if (settings) {
          settings.adminSetup.hasCron = false
        }
      }

      changed = true
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
        schemaName: SCHEMA_VERSION,
        schemaBody: schema,
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

    changed = true

    templates.forEach(async (template) => {
      const existingData = await mail.getTemplate(template.Name)

      if (!existingData) {
        updates.push(mail.publishTemplate(template))
      }
    })

    await Promise.all(updates)
      .then(() => {
        if (settings) {
          settings.templateHash = currTemplateHash
        }
      })
      .catch((e) => {
        logger.error({
          message: 'checkConfig-publishTemplateError',
          error: e,
        })
        throw new Error(e)
      })
  }

  if (changed) await apps.saveAppSettings(appId, settings)
  await checkAndCreateQuotesConfig(ctx)

  return settings
}

export const resolvers = {
  Routes: {
    queueHandler: async (ctx: Context) => {
      const date = new Date().toISOString()

      processQueue(ctx)
      ctx.set('Content-Type', 'application/json')
      ctx.set('Cache-Control', 'no-cache, no-store')
      ctx.response.body = { date, appId: getAppId() }
      ctx.response.status = 200
    },
  },
  Query: {
    getSetupConfig: async (_: any, __: any, ___: Context) => {
      // deprecated
      return null
    },
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
          id,
          fields: QUOTE_FIELDS,
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
          message: 'getQuote-error',
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
        whereArray.push(` =${userCostCenterId}`)
      } else if (costCenter?.length) {
        // if user is filtering by cost center name, look up cost center ID
        const ccArray = [] as string[]

        costCenter.forEach(async (cc) => {
          const costCenterResult = await organizations.getCostCenterIDs(cc)

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

      const where = whereArray.join(' AND ')

      try {
        const quotes = await masterdata.searchDocumentsWithPaginationInfo({
          dataEntity: QUOTE_DATA_ENTITY,
          fields: QUOTE_FIELDS,
          schema: SCHEMA_VERSION,
          pagination: { page, pageSize },
          sort: `${sortedBy} ${sortOrder}`,
          ...(where && { where }),
          ...(search && { keyword: search }),
        })

        return quotes
      } catch (e) {
        logger.error({
          message: 'getQuotes-error',
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
    },
  },
  Quote: {
    organizationName,
    costCenterName,
  },
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
          message: 'clearCart-error',
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
          role: slug,
          status,
          note,
        },
      ]

      const quote = {
        referenceName,
        creatorEmail: email,
        creationDate: nowISO,
        creatorRole: slug,
        expirationDate: expirationDateISO,
        items,
        subtotal,
        status,
        organization: organizationId,
        costCenter: costCenterId,
        lastUpdate,
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
          message(ctx).quoteCreated({
            name: referenceName,
            id: data.DocumentId,
            organization: organizationId,
            costCenter: costCenterId,
            lastUpdate: {
              email,
              note,
              status: status.toUpperCase(),
            },
          })
        }

        return data.DocumentId
      } catch (e) {
        logger.error({
          message: 'createQuote-error',
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
          id,
          fields: QUOTE_FIELDS,
        })) as Quote

        if (!existingQuote) throw new GraphQLError('quote-not-found')
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
          role: slug,
          status,
          note,
        }

        const { updateHistory } = existingQuote

        updateHistory.push(update)

        const updatedQuote = {
          ...existingQuote,
          viewedByCustomer: decline || isCustomer,
          viewedBySales: decline || isSales,
          items: itemsChanged ? items : existingQuote.items,
          subtotal: subtotal ?? existingQuote.subtotal,
          lastUpdate,
          updateHistory,
          status,
          expirationDate: expirationChanged
            ? expirationDate
            : existingQuote.expirationDate,
        } as Quote

        const data = await masterdata
          .updateEntireDocument({
            dataEntity: QUOTE_DATA_ENTITY,
            id,
            fields: updatedQuote,
          })
          .then((res: any) => res)

        const users = updateHistory.map((anUpdate) => anUpdate.email)
        const uniqueUsers = [...new Set(users)]

        message(ctx).quoteUpdated({
          users: uniqueUsers,
          name: existingQuote.referenceName,
          id: existingQuote.id,
          organization: existingQuote.organization,
          costCenter: existingQuote.costCenter,
          lastUpdate: {
            email,
            note,
            status: status.toUpperCase(),
          },
        })

        return data.id
      } catch (e) {
        logger.warn({
          message: 'updateQuote-warning',
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
          id,
          fields: QUOTE_FIELDS,
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
              message: 'useQuote-addCustomDataError',
              e,
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
            quantity: null,
            price: prop(item.id, sellingPriceMap).price,
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
          message: 'useQuote-error',
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
    },
  },
}

interface Quote {
  id: string
  referenceName: string
  creatorEmail: string
  creatorRole: string
  creationDate: string
  expirationDate: string
  lastUpdate: string
  updateHistory: QuoteUpdate[]
  items: QuoteItem[]
  subtotal: number
  status: string
  organization: string
  costCenter: string
  viewedBySales: boolean
  viewedByCustomer: boolean
}

interface QuoteUpdate {
  email: string
  role: string
  date: string
  status: string
  note: string
}

interface QuoteItem {
  name: string
  skuName: string
  refId: string
  id: string
  productId: string
  imageUrl: string
  listPrice: number
  price: number
  quantity: number
  sellingPrice: number
  seller: string
}
