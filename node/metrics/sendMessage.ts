import type { Metric } from '../clients/analytics'
import { B2B_METRIC_NAME } from '../clients/analytics'

type Quote = {
  costCenter: string
  id: string
  organization: string
}

type SendMessageMetricParam = {
  quote: Quote
  account: string
  sentTo: string
  templateName: string
}

type SendMessageFieldsMetric = {
  cost_center_name: string
  quote_id: string
  buyer_org_name: string
  template_name: string
  sent_to: string
  sent_date: string
}

export class SendMessageMetric implements Metric {
  public readonly description: string
  public readonly kind: string
  public readonly account: string
  public readonly fields: SendMessageFieldsMetric
  public readonly name = B2B_METRIC_NAME

  constructor(account: string, fields: SendMessageFieldsMetric) {
    this.account = account
    this.fields = fields
    this.kind = 'send-message-graphql-event'
    this.description = 'Send Message Action - Graphql'
  }
}

const buildSendMessageMetric = (
  metricParam: SendMessageMetricParam
): SendMessageMetric => {
  return new SendMessageMetric(metricParam.account, {
    buyer_org_name: metricParam.quote?.organization,
    cost_center_name: metricParam.quote?.costCenter,
    quote_id: metricParam.quote?.id,
    template_name: metricParam.templateName,
    sent_to: metricParam.sentTo,
    sent_date: new Date().toISOString(),
  })
}

export const sendMessageMetric = async (
  ctx: Context,
  metricsParam: SendMessageMetricParam
) => {
  const {
    clients: { analytics },
  } = ctx

  try {
    const metric = buildSendMessageMetric(metricsParam)

    await analytics.sendMetric(metric)
  } catch (error) {
    console.warn('Unable to log Send Quote Message Metrics', error)
  }
}
