import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { AuthenticationError, ForbiddenError } from '@vtex/api'

const validateUser = async (ctx: Context) => {
  const {
    vtex: { adminUserAuthToken, logger },
    clients: { identity },
  } = ctx

  if (!adminUserAuthToken) {
    throw new AuthenticationError('No Token Was Provided')
  }

  try {
    await identity.validateToken(adminUserAuthToken)
  } catch (error) {
    logger.warn({
      error,
      message: 'checkAdminAccess-UnauthorizedAccess',
    })

    throw new ForbiddenError('Unauthorized Access')
  }
}

export class CheckAdminAccess extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field

    field.resolve = async (
      root: any,
      args: any,
      context: Context,
      info: any
    ) => {
      await validateUser(context)

      return resolve(root, args, context, info)
    }
  }
}
