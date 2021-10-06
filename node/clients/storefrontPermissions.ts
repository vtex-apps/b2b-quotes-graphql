import type { InstanceOptions, IOContext } from '@vtex/api'
import { AppGraphQLClient } from '@vtex/api'

export default class StorefrontPermissions extends AppGraphQLClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super('vtex.storefront-permissions@1.x', ctx, options)
  }

  public checkUserPermission = async (): Promise<any> => {
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
      {}
    )
  }
}
