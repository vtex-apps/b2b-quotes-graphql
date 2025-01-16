export const APP_NAME = 'b2b-quotes-graphql'
export const SCHEMA_VERSION = 'v1.3'
export const QUOTE_DATA_ENTITY = 'quotes'
export const B2B_USER_SCHEMA_VERSION = 'v0.1.2'
export const B2B_USER_DATA_ENTITY = 'b2b_users'
export const CRON_EXPRESSION = '0 */12 * * *'

export const QUOTE_FIELDS = [
  'id',
  'referenceName',
  'creatorEmail',
  'creatorName',
  'creatorRole',
  'creationDate',
  'expirationDate',
  'lastUpdate',
  'updateHistory',
  'items',
  'subtotal',
  'status',
  'organization',
  'costCenter',
  'viewedBySales',
  'viewedByCustomer',
  'salesChannel',
  'seller',
  'sellerName',
  'parentQuote',
  'hasChildren',
  'childrenQuantity',
]

export const routes = {
  addCustomData: ({
    account,
    orderFormId,
    appId,
    property,
  }: {
    account: string
    orderFormId: string
    appId: string
    property?: string
  }) =>
    `${routes.orderForm(account)}/${orderFormId}/customData/${appId}/${
      property ?? ''
    }`,
  addPriceToItems: (account: string, orderFormId: string) =>
    `${routes.orderForm(account)}/${orderFormId}/items/update`,
  addToCart: (account: string, orderFormId: string) =>
    `${routes.orderForm(account)}/${orderFormId}/items/`,
  baseUrl: (account: string) =>
    `http://${account}.vtexcommercestable.com.br/api`,
  checkoutConfig: (account: string) =>
    `${routes.baseUrl(account)}/checkout/pvt/configuration/orderForm`,
  clearCart: (account: string, id: string) =>
    `${routes.orderForm(account)}/${id}/items/removeAll`,
  getQuote: (account: string, id: string) =>
    `${routes.quoteEntity(
      account
    )}/documents/${id}?_fields=id,email,cartName,status,description,items,creationDate,subtotal,discounts,shipping,taxes,total,customData,address`,
  listQuotes: (account: string, email: string) =>
    `${routes.quoteEntity(
      account
    )}/search?email=${email}&_schema=${SCHEMA_VERSION}&_fields=id,email,cartName,status,description,items,creationDate,subtotal,discounts,taxes,shipping,total,customData,address&_sort=creationDate DESC`,
  orderForm: (account: string) =>
    `${routes.baseUrl(account)}/checkout/pub/orderForm`,
  quoteEntity: (account: string) =>
    `${routes.baseUrl(account)}/dataentities/quote`,
  saveSchema: (account: string) =>
    `${routes.quoteEntity(account)}/schemas/${SCHEMA_VERSION}`,
}

export const getAppId = (): string => {
  return process.env.VTEX_APP_ID ?? ''
}

export const schema = {
  properties: {
    costCenter: {
      title: 'Cost Center',
      type: ['null', 'string'],
    },
    creationDate: {
      format: 'date-time',
      title: 'Creation Date',
      type: 'string',
    },
    creatorEmail: {
      title: 'Creator Email',
      type: 'string',
    },
    creatorName: {
      title: 'Creator Name',
      type: ['null', 'string'],
    },
    creatorRole: {
      title: 'Creator Role',
      type: 'string',
    },
    expirationDate: {
      format: 'date-time',
      title: 'Expiration Date',
      type: 'string',
    },
    items: {
      title: 'Cart',
      type: 'array',
    },
    lastUpdate: {
      format: 'date-time',
      title: 'Last Update',
      type: 'string',
    },
    organization: {
      title: 'Organization',
      type: ['null', 'string'],
    },
    referenceName: {
      title: 'Reference Name',
      type: 'string',
    },
    salesChannel: {
      title: 'Sales Channel',
      type: ['null', 'string'],
    },
    status: {
      title: 'Status',
      type: 'string',
    },
    subtotal: {
      title: 'Subtotal',
      type: 'number',
    },
    updateHistory: {
      title: 'Update History',
      type: 'array',
    },
    viewedByCustomer: {
      title: 'Viewed by Customer',
      type: 'boolean',
    },
    viewedBySales: {
      title: 'Viewed by Sales',
      type: 'boolean',
    },
    seller: {
      title: 'Seller',
      type: ['null', 'string'],
    },
    sellerName: {
      title: 'Seller Name',
      type: ['null', 'string'],
    },
    parentQuote: {
      title: 'Parent quote',
      type: ['null', 'string'],
    },
    hasChildren: {
      title: 'Has children',
      type: ['null', 'boolean'],
    },
    childrenQuantity: {
      title: 'Children Quantity',
      type: ['null', 'number'],
    },
  },
  'v-cache': false,
  'v-default-fields': [
    'referenceName',
    'creatorEmail',
    'creatorName',
    'creationDate',
    'expirationDate',
    'lastUpdate',
    'items',
    'subtotal',
    'status',
    'seller',
    'sellerName',
    'parentQuote',
    'hasChildren',
    'childrenQuantity',
  ],
  'v-immediate-indexing': true,
  'v-indexed': [
    'creatorEmail',
    'creatorName',
    'creationDate',
    'expirationDate',
    'lastUpdate',
    'referenceName',
    'status',
    'organization',
    'costCenter',
    'salesChannel',
    'seller',
    'sellerName',
    'parentQuote',
    'hasChildren',
  ],
}
