import type { InstanceOptions, IOContext } from '@vtex/api'
import { AppClient, GraphQLClient } from '@vtex/api'

export default class StorefrontPermissions extends AppClient {
  protected graphql: GraphQLClient

  constructor(ctx: IOContext, options?: InstanceOptions) {
    super('vtex.storefront-permissions@1.x', ctx, options)
    this.graphql = new GraphQLClient(this.http)
  }

  public checkUserPermission = async (headers: any): Promise<any> => {
    const graphQLQuery = `query GetPermissions {
        checkUserPermission {
          role {
            id
            name
            slug
          }
          permissions
        }
      }
      `

    return this.graphql.query(
      {
        query: graphQLQuery,
        variables: {},
        extensions: {
          persistedQuery: {
            provider: 'vtex.storefront-permissions@1.x',
            sender: 'vtex.b2b-quotes@0.x',
          },
        },
      },
      {
        headers,
        url: '/_v/graphql',
      }
    )
  }
}
