import { WithPermissions } from './directives/withPermissions'
import { WithSession } from './directives/withSession'

export const schemaDirectives = {
  withPermissions: WithPermissions as any,
  withSession: WithSession as any,
}
