import { AuditAccess } from './directives/auditAccess'
import { ValidateAdminUserAccess } from './directives/validateAdminUserAccess'
import { ValidateStoreUserAccess } from './directives/validateStoreUserAccess'
import { WithPermissions } from './directives/withPermissions'
import { WithSegment } from './directives/withSegment'
import { WithSession } from './directives/withSession'

export const schemaDirectives = {
  withPermissions: WithPermissions as any,
  withSession: WithSession as any,
  withSegment: WithSegment as any,
  validateAdminUserAccess: ValidateAdminUserAccess as any,
  validateStoreUserAccess: ValidateStoreUserAccess as any,
  auditAccess: AuditAccess as any,
}
