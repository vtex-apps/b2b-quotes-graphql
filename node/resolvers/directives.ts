import { WithPermissions } from './directives/withPermissions'
import { WithSession } from './directives/withSession'
import { WithSegment } from './directives/withSegment'

export const schemaDirectives = {
  withPermissions: WithPermissions as any,
  withSession: WithSession as any,
  withSegment: WithSegment as any,
}
