export async function splitItemsBySeller({
  ctx,
  items,
  quoteBySeller = {},
  index = 0,
}: {
  ctx: Context
  items: QuoteItem[]
  quoteBySeller?: SellerQuoteMap
  index?: number
}): Promise<SellerQuoteMap> {
  if (index >= items.length) return quoteBySeller

  const item = items[index]
  const { seller } = item

  const next = async () =>
    splitItemsBySeller({
      ctx,
      items,
      quoteBySeller,
      index: index + 1,
    })

  // The ternary check is to not request again from the same seller
  const verifyResponse = quoteBySeller[seller]
    ? { receiveQuotes: true }
    : await ctx.clients.sellerQuotes
        .verifyQuoteSettings(seller)
        .catch(() => null)

  if (!verifyResponse?.receiveQuotes) {
    await next()

    return quoteBySeller
  }

  if (!quoteBySeller[seller]) {
    const sellerData = await ctx.clients.seller.getSeller(seller)

    quoteBySeller[seller] = {
      items: [],
      subtotal: 0,
      seller,
      sellerName: sellerData?.name,
    }
  }

  quoteBySeller[seller].items.push(item)
  quoteBySeller[seller].subtotal += item.sellingPrice * item.quantity

  await next()

  return quoteBySeller
}

export function createItemComparator<T extends QuoteItem>(item: T) {
  return ({ id, seller }: T) => item.id === id && item.seller === seller
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
  sellerName,
  parentQuote,
  hasChildren,
  sellerQuotesQuantity,
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
  sellerName?: string
  parentQuote?: string | null
  hasChildren?: boolean | null
  sellerQuotesQuantity?: number
}): Omit<Quote, 'id'> => {
  const { email, firstName, lastName } = sessionData.namespaces.profile
  const { value: creatorEmail } = email
  const creatorName = `${firstName?.value ?? ''}${
    lastName?.value ? ` ${lastName.value}` : ''
  }`.trim()

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

  const isSellerQuote = seller && seller !== '1'
  const status =
    sendToSalesRep || isSellerQuote || (!seller && sellerQuotesQuantity)
      ? 'pending'
      : 'ready'

  const lastUpdate = nowISO
  const updateHistory = [
    {
      date: nowISO,
      email: creatorEmail,
      note,
      role: slug,
      status,
    },
  ]

  const salesChannel: string = segmentData?.channel ?? ''

  return {
    costCenter: costCenterId,
    creationDate: nowISO,
    creatorEmail,
    creatorName,
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
    sellerName,
    parentQuote,
    hasChildren,
  }
}
