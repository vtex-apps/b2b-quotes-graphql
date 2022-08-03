import GraphQLError from '../../utils/GraphQLError'

export const checkSession = (sessionData: any) => {
  if (!sessionData?.namespaces['storefront-permissions']) {
    throw new GraphQLError('organization-data-not-found')
  }

  if (!sessionData?.namespaces?.profile?.email?.value) {
    throw new GraphQLError('email-not-found')
  }
}

export const checkPermissionsForUpdateQuote = ({
  permissions,
  itemsChanged,
  decline,
}: {
  permissions: string[]
  itemsChanged: boolean
  decline: boolean
}) => {
  if (
    (itemsChanged &&
      !permissions.some((permission: string) =>
        permission.includes('edit-quotes')
      )) ||
    (!itemsChanged &&
      !permissions.some((permission: string) =>
        permission.includes('access-quotes')
      )) ||
    (decline && !permissions.includes('decline-quotes'))
  ) {
    throw new GraphQLError('operation-not-permitted')
  }
}

export const checkQuoteStatus = (existingQuote: Quote) => {
  if (!existingQuote) {
    throw new GraphQLError('quote-not-found')
  }

  if (
    existingQuote.status === 'expired' ||
    existingQuote.status === 'declined'
  ) {
    throw new GraphQLError('quote-cannot-be-updated-or-used')
  }
}

const checkIfOrgMatches = ({
  permissions,
  existingQuote,
  itemsOrExpirationChanged,
  neitherItemsNorExpirationChanged,
  userOrganizationId,
}: {
  permissions: string[]
  itemsOrExpirationChanged: boolean
  neitherItemsNorExpirationChanged: boolean
  existingQuote: Quote
  userOrganizationId: string
}) => {
  // if user only has permission to edit their organization's quotes, check that the org matches

  if (
    (itemsOrExpirationChanged &&
      !permissions.includes('edit-quotes-all') &&
      permissions.includes('edit-quotes-organization')) ||
    (neitherItemsNorExpirationChanged &&
      !permissions.includes('access-quotes-all') &&
      permissions.includes('access-quotes-organization'))
  ) {
    if (userOrganizationId !== existingQuote.organization) {
      throw new GraphQLError('operation-not-permitted')
    }
  }
}

const checkIfCostCenterMatches = ({
  permissions,
  existingQuote,
  itemsOrExpirationChanged,
  neitherItemsNorExpirationChanged,
  userCostCenterId,
}: {
  permissions: string[]
  itemsOrExpirationChanged: boolean
  neitherItemsNorExpirationChanged: boolean
  existingQuote: Quote
  userCostCenterId: string
}) => {
  // if user only has permission to edit their organization's quotes, check that the org matches

  if (
    (itemsOrExpirationChanged &&
      !permissions.includes('edit-quotes-all') &&
      !permissions.includes('edit-quotes-organization')) ||
    (neitherItemsNorExpirationChanged &&
      !permissions.includes('access-quotes-all') &&
      !permissions.includes('access-quotes-organization'))
  ) {
    if (userCostCenterId !== existingQuote.costCenter) {
      throw new GraphQLError('operation-not-permitted')
    }
  }
}

export const checkOperationsForUpdateQuote = ({
  permissions,
  expirationChanged,
  itemsChanged,
  existingQuote,
  userOrganizationId,
  userCostCenterId,
  declineQuote,
}: {
  permissions: string[]
  expirationChanged: boolean
  itemsChanged: boolean
  existingQuote: Quote
  userOrganizationId: string
  userCostCenterId: string
  declineQuote: boolean
}) => {
  const itemsOrExpirationChanged = itemsChanged || expirationChanged
  const neitherItemsNorExpirationChanged = !itemsChanged && !expirationChanged

  if (
    expirationChanged &&
    !declineQuote &&
    !permissions.some((permission: string) =>
      permission.includes('edit-quotes')
    )
  ) {
    throw new GraphQLError('operation-not-permitted')
  }

  checkIfOrgMatches({
    permissions,
    existingQuote,
    itemsOrExpirationChanged,
    neitherItemsNorExpirationChanged,
    userOrganizationId,
  })

  checkIfCostCenterMatches({
    permissions,
    existingQuote,
    itemsOrExpirationChanged,
    neitherItemsNorExpirationChanged,
    userCostCenterId,
  })

  // if user only has permission to edit their cost center's quotes, check that the cost center matches
}
