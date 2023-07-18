import axios from 'axios'

const ANALYTICS_URL = 'https://rc.vtex.com/api/analytics/schemaless-events'

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

type MetricsParam = {
  sessionData: SessionData
  sendToSalesRep: boolean
  userData: UserData
  quoteId: string
  quoteReferenceName: string
  creationDate: string
}

type Metric = {
  name: 'b2b-suite-buyerorg-data'
  kind: 'create-quote-graphql-event'
  description: 'Create Quotation Action - Graphql'
  account: string
}

type QuoteFieldsMetric = {
  cost_center_id: string
  cost_center_name: string
  buy_org_id: string
  buy_org_name: string
  member_id: string
  member_email: string
  role: string
  creation_date: string
  quote_id: string
  quote_reference_name: string
  send_to_sales_rep: boolean
}

type QuoteMetric = Metric & { fields: QuoteFieldsMetric }

const getCostCenterById = async (id: string, ctx: Context) => {
  const cost = await ctx.clients.organizations.getCostCenterById(id)

  return cost?.data?.getCostCenterById?.name
}

const getOrganizationById = async (id: string, ctx: Context) => {
  const cost = await ctx.clients.organizations.getOrganizationById(id)

  return cost?.data?.getOrganizationById?.name
}

const buildQuoteMetric = async (
  metricsParam: MetricsParam,
  ctx: Context
): Promise<QuoteMetric> => {
  const { namespaces } = metricsParam.sessionData
  const accountName = namespaces.account.accountName.value
  const userEmail = namespaces.profile.email.value

  const names = await Promise.all([
    getOrganizationById(metricsParam.userData.orgId, ctx),
    getCostCenterById(metricsParam.userData?.costId, ctx),
  ])

  const metric: QuoteMetric = {
    name: 'b2b-suite-buyerorg-data',
    kind: 'create-quote-graphql-event',
    description: 'Create Quotation Action - Graphql',
    account: accountName,
    fields: {
      buy_org_id: metricsParam.userData.orgId,
      buy_org_name: names[0],
      cost_center_id: metricsParam.userData?.costId,
      cost_center_name: names[1],
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

export const sendMetric = async (metricsParam: MetricsParam, ctx: Context) => {
  try {
    const metric = await buildQuoteMetric(metricsParam, ctx)

    await axios.post(ANALYTICS_URL, metric)
  } catch (error) {
    console.warn('Unable to log metrics', error)
  }
}
