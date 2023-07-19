import axios from 'axios'

const ANALYTICS_URL = 'https://rc.vtex.com/api/analytics/schemaless-events'

type CreateQuoteMetric = {
  kind: 'create-quote-graphql-event'
  description: 'Create Quotation Action - Graphql'
}

type SendMessageMetric = {
  kind: 'send-message-graphql-event'
  description: 'Send Message Action - Graphql'
}

export type Metric = {
  name: 'b2b-suite-buyerorg-data'
  account: string
} & (CreateQuoteMetric | SendMessageMetric)

export const sendMetric = async (metric: Metric) => {
  try {
    await axios.post(ANALYTICS_URL, metric)
  } catch (error) {
    console.warn('Unable to log metrics', error)
  }
}
