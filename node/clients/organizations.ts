import type { InstanceOptions, IOContext } from '@vtex/api'
import { AppGraphQLClient } from '@vtex/api'

import { getTokenToHeader } from './index'

export default class Organizations extends AppGraphQLClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super('vtex.b2b-organizations-graphql@0.x', ctx, options)
  }

  public getOrganizationById = async (id: string): Promise<any> => {
    const graphQLQuery = `query GetOrganizationById($id: ID!) {
        getOrganizationById(id: $id) {
            name
        }
      }
      `

    return this.query({
      extensions: this.getPersistedQuery(),
      query: graphQLQuery,
      variables: {
        id,
      },
    })
  }

  public getCostCenterById = async (id: string): Promise<any> => {
    const graphQLQuery = `query GetCostCenterById($id: ID!) {
        getCostCenterById(id: $id) {
            name
        }
      }
      `

    return this.query({
      extensions: this.getPersistedQuery(),
      query: graphQLQuery,
      variables: {
        id,
      },
    })
  }

  private readonly getPersistedQuery = () => {
    return {
      persistedQuery: {
        provider: 'vtex.b2b-organizations-graphql@0.x',
        sender: 'vtex.b2b-quotes@0.x',
      },
    }
  }

  private readonly query = async (param: {
    query: string
    variables: any
    extensions: any
  }): Promise<any> => {
    const { query, variables, extensions } = param

    return this.graphql.query(
      {
        extensions,
        query,
        variables,
      },
      {
        headers: getTokenToHeader(this.context),
        params: {
          locale: this.context.locale,
        },
      }
    )
  }
}
