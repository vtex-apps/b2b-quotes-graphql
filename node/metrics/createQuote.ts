import type { Metric } from '../clients/analytics'
import { B2B_METRIC_NAME } from '../clients/analytics'

type UserData = {
  orgId: string
  costId: string
  roleId: string
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
  member_email: string
  role: string
  creation_date: string
  quote_id: string
  quote_reference_name: string
  send_to_sales_rep: boolean
}

export class CreateQuoteMetric implements Metric {
  public readonly description: string
  public readonly kind: string
  public readonly account: string
  public readonly fields: CreateQuoteFieldsMetric
  public readonly name = B2B_METRIC_NAME

  constructor(account: string, fields: CreateQuoteFieldsMetric) {
    this.account = account
    this.fields = fields
    this.kind = 'create-quote-graphql-event'
    this.description = 'Create Quotation Action - Graphql'
  }
}

const buildQuoteMetric = (
  metricsParam: CreateQuoteMetricParam
): CreateQuoteMetric => {
  const { namespaces } = metricsParam.sessionData
  const accountName = namespaces?.account?.accountName?.value
  const userEmail = namespaces?.profile?.email?.value

  return new CreateQuoteMetric(accountName, {
    buyer_org_id: metricsParam.userData?.orgId,
    cost_center_id: metricsParam.userData?.costId,
    member_email: userEmail,
    role: metricsParam.userData?.roleId,
    creation_date: metricsParam.creationDate,
    quote_id: metricsParam.quoteId,
    quote_reference_name: metricsParam.quoteReferenceName,
    send_to_sales_rep: metricsParam.sendToSalesRep,
  })
}

export const sendCreateQuoteMetric = async (
  ctx: Context,
  metricsParam: CreateQuoteMetricParam
) => {
  const {
    clients: { analytics },
  } = ctx

  try {
    const metric = buildQuoteMetric(metricsParam)

    await analytics.sendMetric(metric)
  } catch (error) {
    console.warn('Unable to log Create Quote Metrics', error)
  }
}
