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
      .catch((e) =>
        logger.error({
          e,
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

      logger.info('setOrderFormConfiguration-success')
    } else {
      saveQuotesConfig(true)
    }
  }
}

export const checkConfig = async (ctx: Context) => {
  const {
    vtex: { account, authToken, logger, workspace },
    clients: { hub, mail, masterdata, scheduler, vbase },
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
    await vbase.saveJSON(APP_NAME, 'settings', settings)
  }

  await checkAndCreateQuotesConfig(ctx)

  return settings
}
