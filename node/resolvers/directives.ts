import { AuditAccess } from './directives/auditAccess'
import { CheckAdminAccess } from './directives/checkAdminAccess'
import { CheckUserAccess } from './directives/checkUserAccess'
import { WithPermissions } from './directives/withPermissions'
import { WithSegment } from './directives/withSegment'
import { WithSession } from './directives/withSession'

export const schemaDirectives = {
  withPermissions: WithPermissions as any,
  withSession: WithSession as any,
  withSegment: WithSegment as any,
  checkAdminAccess: CheckAdminAccess as any,
  auditAccess: AuditAccess as any,
  checkUserAccess: CheckUserAccess as any,
}
