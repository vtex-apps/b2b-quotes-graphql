import { NotFoundError } from '@vtex/api'

import {
  QUOTE_DATA_ENTITY,
  QUOTE_FIELDS,
  SCHEMA_VERSION,
} from '../../constants'
import {
  costCenterName as getCostCenterName,
  organizationName as getOrganizationName,
} from '../fieldResolvers'

type GetQuotesArgs = {
  page?: number
  pageSize?: number
  where?: string
  sort?: string
}

export default class SellerQuotesController {
  constructor(private readonly ctx: Context, private readonly seller: string) {}

  private async getSellerQuotes({
    page = 1,
    pageSize = 1,
    where,
    sort,
  }: GetQuotesArgs) {
    return this.ctx.clients.masterdata.searchDocuments<Quote>({
      dataEntity: QUOTE_DATA_ENTITY,
      fields: QUOTE_FIELDS,
      schema: SCHEMA_VERSION,
      pagination: { page, pageSize },
      where: `seller=${this.seller} AND (${where})`,
      sort,
    })
  }

  private async getSellerQuote(id: string) {
    const [quote] = await this.getSellerQuotes({ where: `id=${id}` })

    if (!quote) {
      throw new NotFoundError('seller-quote-not-found')
    }

    return quote
  }

  private async getOrganizationData(quote: Quote) {
    const [organizationName, costCenterName] = await Promise.all([
      getOrganizationName({ organization: quote.organization }, null, this.ctx),
      getCostCenterName({ costCenter: quote.costCenter }, null, this.ctx),
    ])

    return { organizationName, costCenterName }
  }

  private async getAllChildrenQuotes(parentQuote: string) {
    const result: Quote[] = []

    const getQuotes = async (page = 1) => {
      const quotes = await this.ctx.clients.masterdata.searchDocuments<Quote>({
        dataEntity: QUOTE_DATA_ENTITY,
        schema: SCHEMA_VERSION,
        pagination: { page, pageSize: 100 },
        fields: ['subtotal'],
        where: `parentQuote=${parentQuote}`,
      })

      if (quotes.length) {
        result.push(...quotes)

        await getQuotes(page + 1)
      }
    }

    await getQuotes()

    return result
  }

  public async getFullSellerQuote(id: string) {
    const quote = await this.getSellerQuote(id)
    const { organizationName, costCenterName } = await this.getOrganizationData(
      quote
    )

    return { ...quote, organizationName, costCenterName }
  }

  public async saveSellerQuote(id: string, fields: Partial<Quote>) {
    const currentQuote = await this.getSellerQuote(id)

    await this.ctx.clients.masterdata.updatePartialDocument({
      dataEntity: QUOTE_DATA_ENTITY,
      schema: SCHEMA_VERSION,
      fields,
      id,
    })

    const { subtotal } = currentQuote
    const subtotalDelta = (fields?.subtotal ?? subtotal) - subtotal
    const { parentQuote } = fields

    if (!subtotalDelta || !parentQuote) return

    /**
     * The seller can update the subtotal of your quote changing items
     * prices. Therefore, it is necessary to update the subtotal of the
     * parent quote. The call below is asynchronous as there is no need
     * to stop the flow because of this operation.
     */
    this.getAllChildrenQuotes(parentQuote)
      .then((childrenQuotes) => {
        const sumSubtotal = childrenQuotes.reduce(
          (acc, quote) => acc + quote.subtotal,
          0
        )

        this.ctx.clients.masterdata.updatePartialDocument({
          dataEntity: QUOTE_DATA_ENTITY,
          schema: SCHEMA_VERSION,
          fields: { subtotal: sumSubtotal },
          id: parentQuote,
        })
      })
      .catch(() => null)
  }
}
