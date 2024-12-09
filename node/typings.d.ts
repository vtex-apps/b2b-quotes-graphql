interface Quote {
  id: string
  referenceName: string
  creatorEmail: string
  creatorRole: string
  creationDate: string
  expirationDate: string
  lastUpdate: string
  updateHistory: QuoteUpdate[]
  items: QuoteItem[]
  subtotal: number
  status: string
  organization: string
  costCenter: string
  viewedBySales: boolean
  viewedByCustomer: boolean
  salesChannel: string | null
  seller?: string | null
  approvedBySeller?: boolean | null
}

interface QuoteWithOptionalId extends Quote {
  id?: string
}

interface QuoteUpdate {
  email: string
  role: string
  date: string
  status: string
  note: string
}

interface QuoteItem {
  name: string
  skuName: string
  refId: string
  id: string
  productId: string
  imageUrl: string
  listPrice: number
  price: number
  quantity: number
  sellingPrice: number
  seller: string
}

interface ReqContext {
  account: string
  workspace: string
  authToken: string
  region: string
  production: boolean
  userAgent: string
}

interface Logger {
  log(
    content: string,
    level: LogLevel,
    details?: Record<string, unknown>
  ): PromiseLike<void>
}

interface OperationState {
  orderFormId: string
  ctx: ReqContext
  data?: OperationData
  logger: Logger
}

interface OperationData {
  orderForm?: any
  userProfileId: string
  cookie: string
}

type ProcessPaymentStep = (
  state: OperationState,
  next: () => Promise<void>
) => Promise<void>

type LogLevel = 'info' | 'error' | 'warning'

interface Timings {
  [middleware: string]: [number, number]
}

declare module '*.json' {
  const value: any
  export default value
}

interface OrderFormConfiguration {
  paymentConfiguration?: PaymentConfiguration
  taxConfiguration?: TaxConfiguration
  minimumQuantityAccumulatedForItems?: number
  decimalDigitsPrecision?: number
  minimumValueAccumulated?: number
  apps?: [App]
  allowMultipleDeliveries?: boolean
  allowManualPrice?: boolean
  maxIntOfWhiteLabelSellers?: number
  maskFirstPurchaseData?: boolean
  recaptchaValidation?: boolean
}

interface Settings {
  adminSetup: {
    cartLifeSpan: number
    allowManualPrice: boolean
    hasCron?: boolean
    cronExpression?: string
    cronWorkspace?: string
    quotesManagedBy?: string
  }
  schemaVersion: string
  templateHash: string | null
}
