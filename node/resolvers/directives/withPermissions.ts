/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-params */
import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

export class WithPermissions extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field

    field.resolve = async (root: any, args: any, context: any, info: any) => {
      const {
        clients: { storefrontPermissions },
        vtex: { logger },
      } = context

      context.vtex.storefrontPermissions = await storefrontPermissions
        .checkUserPermission()
        .then((result: any) => {
          return result.data.checkUserPermission
        })
        .catch((error: any) => {
          logger.error({
            error,
            message: 'getPermissionsError',
          })
        })

      return resolve(root, args, context, info)
    }
  }
}
