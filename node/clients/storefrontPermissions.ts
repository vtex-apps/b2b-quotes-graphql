import type { InstanceOptions, IOContext } from '@vtex/api'
import { AppGraphQLClient } from '@vtex/api'

export const QUERIES = {
  getPermission: `query permissions {
    checkUserPermission {
      role {
        id
        name
        slug
      }
      permissions
    }
  }`,
  listUsers: `query users($organizationId: ID, $costCenterId: ID, $roleId: ID) {
    listUsers(organizationId: $organizationId, costCenterId: $costCenterId, roleId: $roleId) {
      id
      roleId
      userId
      clId
      orgId
      costId
      name
      email
      canImpersonate
    }
  }`,
  listRoles: `query roles {
    listRoles {
      id
      name
      slug
    }
  }`,
  getUser: `query user($id: ID!) {
    getUser(id: $id) {
      id
      roleId
      userId
      clId
      orgId
      costId
      name
      email
      canImpersonate
    }
  }`,
  getRole: `query role($id: ID!) {
    getRole(id: $id) {
      id
      name
      slug
    }
  }`,
}

export default class StorefrontPermissions extends AppGraphQLClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super('vtex.storefront-permissions@1.x', ctx, options)
  }

  public checkUserPermission = async (): Promise<any> => {
    return this.graphql.query(
      {
        query: QUERIES.getPermission,
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

  public listRoles = async (): Promise<any> => {
    return this.graphql.query(
      {
        query: QUERIES.listRoles,
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

  public listUsers = async ({
    roleId,
    organizationId,
  }: {
    roleId: string
    organizationId?: string
  }): Promise<any> => {
    return this.graphql.query(
      {
        query: QUERIES.listUsers,
        variables: {
          roleId,
          ...(organizationId && { organizationId }),
        },
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
