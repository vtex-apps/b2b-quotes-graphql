import { NotFoundError } from '@vtex/api'
import pLimit from 'p-limit'

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
  constructor(
    private readonly ctx: Context | EventBroadcastContext,
    private readonly seller?: string
  ) {}

  private async getSellerQuotes({
    page = 1,
    pageSize = 1,
    where = '',
    sort = '',
  }: GetQuotesArgs) {
    return this.ctx.clients.masterdata.searchDocumentsWithPaginationInfo<Quote>(
      {
        dataEntity: QUOTE_DATA_ENTITY,
        fields: QUOTE_FIELDS,
        schema: SCHEMA_VERSION,
        pagination: { page, pageSize },
        where: `seller=${this.seller} AND (${where})`,
        sort,
      }
    )
  }

  private async getSellerQuote(id: string) {
    const { data } = await this.getSellerQuotes({ where: `id=${id}` })
    const [quote] = data

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

  public async getAllChildrenQuotes(
    parentQuote: string,
    sortOrder = 'DESC',
    sortedBy = 'lastUpdate'
  ) {
    const result: Quote[] = []

    const getQuotes = async (page = 1) => {
      const quotes = await this.ctx.clients.masterdata.searchDocuments<Quote>({
        dataEntity: QUOTE_DATA_ENTITY,
        schema: SCHEMA_VERSION,
        pagination: { page, pageSize: 100 },
        fields: QUOTE_FIELDS,
        where: `parentQuote=${parentQuote}`,
        sort: `${sortedBy} ${sortOrder}`,
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

  public async getSellerQuotesPaginated({
    page,
    pageSize,
    where,
    sort = 'lastUpdate DESC',
  }: {
    page: number
    pageSize: number
    where?: string
    sort?: string
  }) {
    const { data, pagination } = await this.getSellerQuotes({
      page,
      pageSize,
      where,
      sort,
    })

    const limit = pLimit(15)
    const enrichedQuotes = await Promise.all(
      data.map((quote) =>
        limit(async () => {
          const {
            organizationName,
            costCenterName,
          } = await this.getOrganizationData(quote)

          return { ...quote, organizationName, costCenterName }
        })
      )
    )

    return {
      data: enrichedQuotes,
      pagination,
    }
  }

  public async handleParentQuoteSubtotalAndStatus(parentQuote: string) {
    const childrenQuotes = await this.getAllChildrenQuotes(parentQuote)

    if (!childrenQuotes?.length) return

    const sumSubtotal = childrenQuotes.reduce(
      (acc, quote) => acc + quote.subtotal,
      0
    )

    const isEverySameStatus = childrenQuotes.every(
      (quote) => quote.status === childrenQuotes[0].status
    )

    const quotesExceptDeclined = childrenQuotes.filter(
      (quote) => quote.status !== 'declined'
    )

    const isEverySameStatusExceptDeclined =
      !!quotesExceptDeclined.length &&
      quotesExceptDeclined.every(
        (quote) => quote.status === quotesExceptDeclined[0].status
      )

    const isSomeRevised = childrenQuotes.some(
      (quote) => quote.status === 'revised'
    )

    const isSomePending = childrenQuotes.some(
      (quote) => quote.status === 'pending'
    )

    let status: string | undefined

    if (isEverySameStatus) {
      status = childrenQuotes[0].status
    } else if (isEverySameStatusExceptDeclined) {
      status = quotesExceptDeclined[0].status
    } else if (isSomePending) {
      status = 'pending'
    } else if (isSomeRevised) {
      status = 'revised'
    }

    const lastUpdate = new Date().toISOString()

    this.ctx.clients.masterdata.updatePartialDocument({
      dataEntity: QUOTE_DATA_ENTITY,
      schema: SCHEMA_VERSION,
      fields: { subtotal: sumSubtotal, status, lastUpdate },
      id: parentQuote,
    })
  }

  public async saveSellerQuote(id: string, fields: Partial<Quote>) {
    await this.ctx.clients.masterdata.updatePartialDocument({
      dataEntity: QUOTE_DATA_ENTITY,
      schema: SCHEMA_VERSION,
      fields,
      id,
    })

    const { parentQuote } = fields

    if (parentQuote) {
      this.handleParentQuoteSubtotalAndStatus(parentQuote)
    }
  }
}
