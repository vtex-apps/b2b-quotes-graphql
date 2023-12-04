/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-params */
import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

export class WithSession extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field

    field.resolve = async (root: any, args: any, context: any, info: any) => {
      const {
        clients: { session, vtexId },
        vtex: { sessionToken },
      } = context

      const token = context.request.header?.vtexidclientauthcookie

      if (sessionToken) {
        context.vtex.sessionData = await session
          .getSession(sessionToken as string, ['*'])
          .then((currentSession: any) => {
            return currentSession.sessionData
          })
          .catch(() => null)
      } else if (token) {
        const authenticatedUser = await vtexId.getAuthenticatedUser(token)

        if (authenticatedUser?.userId) {
          context.vtex.authenticatedUser = {
            ...authenticatedUser,
            token,
          }
        }
      }

      return resolve(root, args, context, info)
    }
  }
}
