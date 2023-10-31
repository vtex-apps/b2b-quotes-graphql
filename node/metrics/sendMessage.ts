import type { Metric } from '../clients/metrics'
import { B2B_METRIC_NAME, sendMetric } from '../clients/metrics'

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
  const metric: SendMessageMetric = {
    name: 'b2b-suite-buyerorg-data',
    kind: 'send-message-graphql-event',
    description: 'Send Message Action - Graphql',
    account: metricParam.account,
    fields: {
      buyer_org_name: metricParam.quote?.organization,
      cost_center_name: metricParam.quote?.costCenter,
      quote_id: metricParam.quote?.id,
      template_name: metricParam.templateName,
      sent_to: metricParam.sentTo,
      sent_date: new Date().toISOString(),
    },
  }

  return metric
}

export const sendMessageMetric = async (
  metricsParam: SendMessageMetricParam
) => {
  try {
    const metric = buildSendMessageMetric(metricsParam)

    await sendMetric(metric)
  } catch (error) {
    console.warn('Unable to log Send Quote Message Metrics', error)
  }
}
