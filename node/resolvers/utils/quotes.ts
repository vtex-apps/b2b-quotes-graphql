export const createQuoteObject = ({
  sessionData,
  storefrontPermissions,
  segmentData,
  settings,
  items,
  referenceName,
  subtotal,
  note,
  sendToSalesRep,
  seller,
  approvedBySeller,
  parentQuote,
  hasChildren,
}: {
  sessionData: SessionData
  storefrontPermissions: { role: { slug: string } }
  segmentData?: { channel?: string }
  settings?: Settings | null
  items: QuoteItem[]
  referenceName: string
  subtotal: number
  note: string
  sendToSalesRep: boolean
  seller?: string
  approvedBySeller?: boolean | null
  parentQuote?: string | null
  hasChildren?: boolean | null
}): Omit<Quote, 'id'> => {
  const email = sessionData.namespaces.profile.email.value

  const {
    role: { slug },
  } = storefrontPermissions

  const {
    organization: { value: organizationId },
    costcenter: { value: costCenterId },
  } = sessionData.namespaces['storefront-permissions']

  const now = new Date()
  const nowISO = now.toISOString()
  const expirationDate = new Date()

  expirationDate.setDate(
    expirationDate.getDate() + (settings?.adminSetup?.cartLifeSpan ?? 30)
  )
  const expirationDateISO = expirationDate.toISOString()

  const status = sendToSalesRep ? 'pending' : 'ready'
  const lastUpdate = nowISO
  const updateHistory = [
    {
      date: nowISO,
      email,
      note,
      role: slug,
      status,
    },
  ]

  const salesChannel: string = segmentData?.channel ?? ''

  return {
    costCenter: costCenterId,
    creationDate: nowISO,
    creatorEmail: email,
    creatorRole: slug,
    expirationDate: expirationDateISO,
    items,
    lastUpdate,
    organization: organizationId,
    referenceName,
    status,
    subtotal,
    updateHistory,
    viewedByCustomer: !!sendToSalesRep,
    viewedBySales: !sendToSalesRep,
    salesChannel,
    seller,
    approvedBySeller,
    parentQuote,
    hasChildren,
  }
}
