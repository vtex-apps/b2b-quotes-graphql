import type { InstanceOptions, IOContext } from '@vtex/api'
import { AppClient, GraphQLClient } from '@vtex/api'

export default class Organizations extends AppClient {
  protected graphql: GraphQLClient

  constructor(ctx: IOContext, options?: InstanceOptions) {
    super('vtex.graphql-server@1.x', ctx, options)
    this.graphql = new GraphQLClient(this.http)
  }

  public getOrganizationIDs = async (search: string): Promise<any> => {
    const graphQLQuery = `query GetOrganizations($search: String!) {
      getOrganizations(search: $search) {
          data {
              id
          }
        }
      }`

    return this.graphql.query(
      {
        query: graphQLQuery,
        variables: {
          search,
        },
        extensions: {
          persistedQuery: {
            provider: 'vtex.b2b-organizations-graphql@0.x',
            sender: 'vtex.orderquote@1.x',
          },
        },
      },
      { url: '/graphql' }
    )
  }

  public getOrganizationById = async (id: string): Promise<any> => {
    const graphQLQuery = `query GetOrganizationById($id: ID!) {
        getOrganizationById(id: $id) {
            name
        }
      }
      `

    return this.graphql.query(
      {
        query: graphQLQuery,
        variables: {
          id,
        },
        extensions: {
          persistedQuery: {
            provider: 'vtex.b2b-organizations-graphql@0.x',
            sender: 'vtex.orderquote@1.x',
          },
        },
      },
      { url: '/graphql' }
    )
  }

  public getCostCenterIDs = async (search: string): Promise<any> => {
    const graphQLQuery = `query GetCostCenters($search: String!) {
      getCostCenters(search: $search) {
          data {
              id
          }
        }
      }`

    return this.graphql.query(
      {
        query: graphQLQuery,
        variables: {
          search,
        },
        extensions: {
          persistedQuery: {
            provider: 'vtex.b2b-organizations-graphql@0.x',
            sender: 'vtex.orderquote@1.x',
          },
        },
      },
      { url: '/graphql' }
    )
  }

  public getCostCenterById = async (id: string): Promise<any> => {
    const graphQLQuery = `query GetCostCenterById($id: ID!) {
        getCostCenterById(id: $id) {
            name
        }
      }
      `

    return this.graphql.query(
      {
        query: graphQLQuery,
        variables: {
          id,
        },
        extensions: {
          persistedQuery: {
            provider: 'vtex.b2b-organizations-graphql@0.x',
            sender: 'vtex.orderquote@1.x',
          },
        },
      },
      { url: '/graphql' }
    )
  }
}
