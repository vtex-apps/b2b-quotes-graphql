import type { Metric } from '../clients/analytics'
import { B2B_METRIC_NAME } from '../clients/analytics'

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

export class UseQuoteMetric implements Metric {
  public readonly description: string
  public readonly kind: string
  public readonly account: string
  public readonly fields: UseQuoteFieldsMetric
  public readonly name = B2B_METRIC_NAME

  constructor(account: string, fields: UseQuoteFieldsMetric) {
    this.account = account
    this.fields = fields
    this.kind = 'use-quote-graphql-event'
    this.description = 'Use Quotation Action - Graphql'
  }
}

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

  return new UseQuoteMetric(account, {
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
  })
}

export const sendUseQuoteMetric = async (
  ctx: Context,
  metricsParam: UseQuoteMetricsParams
) => {
  const {
    clients: { analytics },
  } = ctx

  try {
    const metric = buildUseQuoteMetric(metricsParam)

    await analytics.sendMetric(metric)
  } catch (error) {
    console.warn('Unable to log metrics', error)
  }
}
