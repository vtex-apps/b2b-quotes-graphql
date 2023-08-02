import type { Metric } from './metrics'
import { sendMetric } from './metrics'

type UseQuoteFieldsMetric = {
  quote_id: string
  quote_reference_name: string
  order_form_id: string
  quote_creation_date: string
  quote_use_date: string
  creator_email: string
  user_email: string
  cost_center_id: string
  buyer_org_id: string
  quote_last_update: string
}

type UseQuoteMetric = Metric & { fields: UseQuoteFieldsMetric }

export type UseQuoteMetricsParams = {
  quote: Quote
  orderFormId: string
  account: string
  userEmail: string
}

const buildUseQuoteMetric = (
  metricsParam: UseQuoteMetricsParams
): UseQuoteMetric => {
  const { quote, orderFormId, account, userEmail } = metricsParam

  const metric: UseQuoteMetric = {
    name: 'b2b-suite-buyerorg-data',
    kind: 'use-quote-graphql-event',
    description: 'Use Quotation Action - Graphql',
    account,
    fields: {
      buyer_org_id: quote.organization,
      cost_center_id: quote.costCenter,
      quote_id: quote.id,
      quote_reference_name: quote.referenceName,
      order_form_id: orderFormId,
      quote_creation_date: quote.creationDate,
      quote_use_date: new Date().toISOString(),
      creator_email: quote.creatorEmail,
      user_email: userEmail,
      quote_last_update: quote.lastUpdate,
    },
  }

  return metric
}

export const sendUseQuoteMetric = async (
  metricsParam: UseQuoteMetricsParams
) => {
  try {
    const metric = buildUseQuoteMetric(metricsParam)

    await sendMetric(metric)
  } catch (error) {
    console.warn('Unable to log metrics', error)
  }
}
