/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-params */
import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import atob from 'atob'

export class WithSegment extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field

    field.resolve = async (root: any, args: any, context: any, info: any) => {
      const {
        clients: { segment },
        vtex: { segmentToken },
      } = context

      context.vtex.segmentData = segmentToken
        ? JSON.parse(atob(segmentToken))
        : await segment.getSegment()

      return resolve(root, args, context, info)
    }
  }
}
