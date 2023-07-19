import type { Metric } from './metrics'
import { sendMetric } from './metrics'

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
  buy_org_name: string
  template_name: string
  sent_to: string
  sent_date: string
}

type SendMessageMetric = Metric & { fields: SendMessageFieldsMetric }

const buildSendMessageMetric = async (
  metricParam: SendMessageMetricParam
): Promise<SendMessageMetric> => {
  const metric: SendMessageMetric = {
    name: 'b2b-suite-buyerorg-data',
    kind: 'send-message-graphql-event',
    description: 'Send Message Action - Graphql',
    account: metricParam.account,
    fields: {
      buy_org_name: metricParam.quote?.organization,
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
    const metric = await buildSendMessageMetric(metricsParam)

    await sendMetric(metric)
  } catch (error) {
    console.warn('Unable to log Send Quote Metrics', error)
  }
}
