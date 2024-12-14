export async function processSellerItems({
  ctx,
  quoteBySeller,
  referenceName,
  note,
  sendToSalesRep,
  items,
  index = 0,
}: {
  ctx: Context
  quoteBySeller: Record<string, SellerQuoteInput>
  referenceName: string
  note: string
  sendToSalesRep: boolean
  items: QuoteItem[]
  index?: number
}): Promise<void> {
  if (index >= items.length) return

  const item = items[index]
  const { seller } = item

  const next = async () =>
    processSellerItems({
      ctx,
      quoteBySeller,
      referenceName,
      note,
      sendToSalesRep,
      items,
      index: index + 1,
    })

  const verifyResponse = await ctx.clients.sellerQuotes
    .verifyQuoteSettings(seller)
    .catch(() => null)

  if (!verifyResponse?.receiveQuotes) {
    await next()

    return
  }

  if (!quoteBySeller[seller]) {
    quoteBySeller[seller] = {
      items: [],
      referenceName,
      note,
      sendToSalesRep,
      subtotal: 0,
    }
  }

  quoteBySeller[seller].items.push(item)
  quoteBySeller[seller].subtotal += item.sellingPrice * item.quantity

  await next()
}

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
