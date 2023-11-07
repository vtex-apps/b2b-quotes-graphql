import { WithPermissions } from './directives/withPermissions'
import { WithSession } from './directives/withSession'
import { WithSegment } from './directives/withSegment'
import { CheckAdminAccess } from './directives/checkAdminAccess'
import { AuditAccess } from './directives/auditAccess'

export const schemaDirectives = {
  withPermissions: WithPermissions as any,
  withSession: WithSession as any,
  withSegment: WithSegment as any,
  checkAdminAccess: CheckAdminAccess as any,
  auditAccess: AuditAccess as any,
}
