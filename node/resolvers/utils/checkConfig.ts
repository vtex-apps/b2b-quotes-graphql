import templates from '../../templates'
import { toHash } from '../../utils'
import {
  APP_NAME,
  CRON_EXPRESSION,
  QUOTE_DATA_ENTITY,
  SCHEMA_VERSION,
  routes,
  schema,
} from '../../constants'

export const defaultSettings: Settings = {
  adminSetup: {
    allowManualPrice: false,
    cartLifeSpan: 30,
    quotesManagedBy: 'MARKETPLACE',
    hasCron: false,
  },
  schemaVersion: '',
  schemaHash: null,
  templateHash: null,
}

const defaultHeaders = (authToken: string) => ({
  Accept: 'application/vnd.vtex.ds.v10+json',
  'Content-Type': 'application/json',
  'Proxy-Authorization': authToken,
  VtexIdclientAutCookie: authToken,
})

// checks and configure the OrderForm based on quoteId
export const checkAndCreateQuotesConfig = async (
  ctx: Context
): Promise<any> => {
  const {
    clients: { checkout, vbase },
    vtex: { logger, authToken },
  } = ctx

  let hasQuoteConfig = false

  const saveQuotesConfig = async (flag: boolean) => {
    return vbase
      .saveJSON(APP_NAME, 'quotes', { quote: flag })
      .then(() => true)
      .catch((error) =>
        logger.error({
          error,
          message: 'vBaseSaveJson-error',
        })
      )
  }

  try {
    hasQuoteConfig =
      (await vbase.getJSON<{ quote: boolean }>(APP_NAME, 'quotes'))?.quote ??
      false
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
        (currApp: any) => currApp.id === APP_NAME
      ) === -1
    ) {
      checkoutConfig.apps.push({
        fields: ['quoteId'],
        id: APP_NAME,
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
    } else {
      saveQuotesConfig(true)
    }
  }
}

const initializeCron = async (settings: Settings, ctx: Context) => {
  const {
    vtex: { account, workspace },
    clients: { scheduler },
  } = ctx

  const cronQueue = await scheduler
    .getQueue()
    .then((data: any) => {
      return data
    })
    .catch(() => {
      return null
    })

  if (cronQueue?.expression === CRON_EXPRESSION) return settings

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
    })
    .catch((error) => {
      if (error.response.status !== 304) {
        settings.adminSetup.hasCron = false
      } else {
        settings.adminSetup.hasCron = true
        settings.adminSetup.cronExpression = CRON_EXPRESSION
        settings.adminSetup.cronWorkspace = workspace
      }
    })

  return settings
}

const initializeSchema = async (settings: Settings, ctx: Context) => {
  const {
    clients: { masterdata },
  } = ctx

  try {
    await masterdata.createOrUpdateSchema({
      dataEntity: QUOTE_DATA_ENTITY,
      schemaBody: schema,
      schemaName: SCHEMA_VERSION,
    })

    settings.schemaVersion = SCHEMA_VERSION
    settings.schemaHash = toHash(schema)
  } catch (error) {
    if (error.response.status >= 400) {
      settings.schemaVersion = ''
    } else {
      settings.schemaVersion = SCHEMA_VERSION
    }
  }

  return settings
}

const initializeManualPrice = async (settings: Settings, ctx: Context) => {
  const {
    vtex: { account, authToken, logger },
    clients: { hub },
  } = ctx

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
      settings.adminSetup.allowManualPrice = true
    }
  } catch (error) {
    settings.adminSetup.allowManualPrice = false
    logger.warn({
      error,
      message: 'initializeManualPrice-error',
    })
  }

  return settings
}

const initializeTemplates = async (
  settings: Settings,
  currTemplateHash: string,
  ctx: Context
) => {
  const {
    vtex: { logger },
    clients: { mail },
  } = ctx

  const updates: Array<Promise<any>> = []

  templates.forEach((template) => {
    updates.push(mail.publishTemplate(template))
  })

  await Promise.all(updates)
    .then(() => {
      settings.templateHash = currTemplateHash
    })
    .catch((error) => {
      logger.error({
        error,
        message: 'checkConfig-publishTemplateError',
      })
      throw new Error(error)
    })

  return settings
}

const checkInitializations = async ({
  settings,
  currTemplateHash,
  changed,
  ctx,
}: {
  settings: Settings
  currTemplateHash: string
  changed: boolean
  ctx: Context
}) => {
  const {
    vtex: { workspace },
  } = ctx

  if (
    !settings?.adminSetup?.hasCron ||
    settings?.adminSetup?.cronExpression !== CRON_EXPRESSION ||
    settings?.adminSetup?.cronWorkspace !== workspace
  ) {
    if (!settings?.adminSetup?.hasCron) {
      settings.adminSetup = {
        ...defaultSettings.adminSetup,
      }
    }

    const oldCronSetting = settings.adminSetup.hasCron

    settings = await initializeCron(settings, ctx)

    if (settings.adminSetup.hasCron !== oldCronSetting) {
      changed = true
    }
  }

  const currentSchemaHash = toHash(schema)

  if (
    settings?.schemaVersion !== SCHEMA_VERSION ||
    settings?.schemaHash !== currentSchemaHash
  ) {
    const oldSchemaVersion = settings?.schemaVersion
    const oldSchemaHash = settings?.schemaHash

    settings = await initializeSchema(settings, ctx)

    const mustUpdateSettings =
      settings.schemaVersion !== oldSchemaVersion ||
      settings.schemaHash !== oldSchemaHash

    if (mustUpdateSettings) {
      changed = true
    }
  }

  if (!settings?.adminSetup?.allowManualPrice) {
    const oldManualPriceSetting = settings?.adminSetup?.allowManualPrice

    settings = await initializeManualPrice(settings, ctx)

    if (settings.adminSetup.allowManualPrice !== oldManualPriceSetting) {
      changed = true
    }
  }

  if (settings?.templateHash !== currTemplateHash) {
    const oldTemplateHash = settings?.templateHash

    settings = await initializeTemplates(settings, currTemplateHash, ctx)

    if (settings.templateHash !== oldTemplateHash) {
      changed = true
    }
  }

  return { settings, changed }
}

export const checkConfig = async (ctx: Context) => {
  const {
    vtex: { logger },
    clients: { vbase },
  } = ctx

  let settings: Settings | null = null
  let changed = false

  const currTemplateHash = toHash(templates)

  try {
    settings = await vbase.getJSON<Settings | null>(APP_NAME, 'settings', true)
  } catch (error) {
    logger.error({
      error,
      message: 'checkConfig-getAppSettingsError',
    })

    return null
  }

  if (
    !settings?.adminSetup?.cartLifeSpan &&
    !settings?.adminSetup?.quotesManagedBy
  ) {
    settings = defaultSettings
    changed = true
  }

  const initializationResult = await checkInitializations({
    settings,
    currTemplateHash,
    changed,
    ctx,
  })

  settings = initializationResult.settings
  changed = initializationResult.changed

  if (changed) {
    await vbase.saveJSON(APP_NAME, 'settings', settings)
  }

  await checkAndCreateQuotesConfig(ctx)

  return settings
}
