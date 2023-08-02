import type { Metric } from './metrics'
import { sendMetric } from './metrics'

type UserData = {
  orgId: string
  costId: string
  roleId: string
}

type SessionData = {
  namespaces: {
    profile: {
      id: { value: string }
      email: { value: string }
    }
    account: {
      accountName: { value: string }
    }
  }
}

type CreateQuoteMetricParam = {
  sessionData: SessionData
  sendToSalesRep: boolean
  userData: UserData
  quoteId: string
  quoteReferenceName: string
  creationDate: string
}

type CreateQuoteFieldsMetric = {
  cost_center_id: string
  buyer_org_id: string
  member_id: string
  member_email: string
  role: string
  creation_date: string
  quote_id: string
  quote_reference_name: string
  send_to_sales_rep: boolean
}

type CreateQuoteMetric = Metric & { fields: CreateQuoteFieldsMetric }

const buildQuoteMetric = async (
  metricsParam: CreateQuoteMetricParam
): Promise<CreateQuoteMetric> => {
  const { namespaces } = metricsParam.sessionData
  const accountName = namespaces.account.accountName.value
  const userEmail = namespaces.profile.email.value

  const metric: CreateQuoteMetric = {
    name: 'b2b-suite-buyerorg-data',
    kind: 'create-quote-graphql-event',
    description: 'Create Quotation Action - Graphql',
    account: accountName,
    fields: {
      buyer_org_id: metricsParam.userData.orgId,
      cost_center_id: metricsParam.userData?.costId,
      member_id: namespaces?.profile?.id?.value,
      member_email: userEmail,
      role: metricsParam.userData?.roleId,
      creation_date: metricsParam.creationDate,
      quote_id: metricsParam.quoteId,
      quote_reference_name: metricsParam.quoteReferenceName,
      send_to_sales_rep: metricsParam.sendToSalesRep,
    },
  }

  return metric
}

export const sendCreateQuoteMetric = async (
  metricsParam: CreateQuoteMetricParam
) => {
  try {
    const metric = await buildQuoteMetric(metricsParam)

    await sendMetric(metric)
  } catch (error) {
    console.warn('Unable to log Create Quote Metrics', error)
  }
}
