# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.9.3] - 2025-02-26
### Fixed
- Prevent identical lastUpdate at expiration quotes queue


## [2.9.2] - 2025-02-24

### Added

- Add GraphQL API documentation
- Prevent identical lastUpdate at expiration quotes queue

## [2.9.1] - 2025-02-06
### Fixed
- Fix getOrgSalesAdminEmail

## [2.9.0] - 2025-01-23

### Fixed
- Changed some members to readonly to fix SonarCloud's code smells.

## [2.8.1] - 2025-01-23

### Added

- Add fields creatorName, sellerName and childrenQuantity on quote entity
- Saving masterdata schema hash in settings to update when it changes
- Create a new quote to marketplace responsibility for remaining items when splitting a quote
- Create a new query to check sellers quotes on frontend

### Changed

- Handle parent quote status and subtotal when updating splitted quotes
- Get all children quotes ordered by lastUpdate DESC once on getChildrenQuotes

## [2.8.0] - 2025-01-13

### Added

- Provides a route for seller get paginated list of quotes at marketplace
- Provides a route for seller save a quote at marketplace
- Provides a route for get splited quotes based on parentID

## [2.7.0] - 2025-01-09

### Added

- Add field quotesManagedBy on appSettings to handle splitting quotes
- Process splitting quote by seller if it accepts to manage quotes
- Notify seller with quote reference data as payload
- Provides a route for seller get a quote by id at marketplace


## [2.6.4] - 2024-10-31

### Fixed

- Only update Status, LastUpdate and UpdateHistory, in expired quotes

## [2.6.3] - 2024-10-30

### Fixed

- Set viewedByCustomer value False when value is null

## [2.6.2] - 2024-10-02

### Added

- Add audit access metrics to all graphql APIs

## [2.6.1] - 2024-09-09

### Fixed

- Set viewedByCustomer value corectly on quote creation

## [2.6.0] - 2024-09-04

### Added

- Add getQuoteEnabledForUser query to be used by the b2b-quotes app

## [2.5.4] - 2024-08-20

### Fixed

- Use listUsersPaginated internally instead of deprecated listUsers

## [2.5.3] - 2024-06-10

### Fixed

- Provide correct tokens to clients

## [2.5.2] - 2024-02-05

### Fixed

- Adjust the policies to allow getAuthenticatedUser

## [2.5.1] - 2024-01-31

### Fixed

- Adjust the auth token and policies to update the order form when using the quote.

## [2.5.0] - 2023-12-15

### Added

- Add token validation in graphql operations and token to call storefront-permission and b2b-organization

## [2.4.1] - 2023-11-09

### Fixed

- Remove get permissions from access audit metrics

## [2.4.0] - 2023-11-07

### Added

- add an authentication metric to check if the access is authenticated

## [2.3.1] - 2023-09-13

### Fixed

- Use the account to get the token in the header and send it to clear the cart and order

## [2.3.0] - 2023-08-14

### Added

- Send metrics to Analytics (Create Quote and Send Message events)
- Send use quote metrics to Analytics

### Removed

- [ENGINEERS-1247] - Disable cypress tests in PR level

### Changed

- Run schedule job only on saturday

## [2.2.4] - 2023-03-20

### Removed

- Crowdin configuration file, as this app has no translatable messages.

## [2.2.3] - 2023-02-03

### Added

- `ListOrders` policy

## [2.2.2] - 2023-01-10

### Fixed

- Bug fixed on updating the quote by passing the schema version

## [2.2.1] - 2022-11-11

### Changed

- Cypress improvements

### Changed

- Record video in cypress

### Fixed

- Bump minimist version to fix critial vulnerabilities

### Changed

- Split bindings testcase into two files

### Updated

- Update GitHub reusable workflow to version 2

## [2.2.0] - 2022-09-08

### Added

- App review and added admin navigation permissions

## [2.1.0] - 2022-08-25

### Added

- Store sales channel information in Quotes
- Apply stored sales channel in cart when using Quotes
- Consider permission to view Quotes according to stored sales channel

## [2.0.2] - 2022-08-03

### Fixed

- Bug fixed on decline quote

## [2.0.1] - 2022-05-19

### Changed

- `getQuotes` now expects `organization` and `costCenter` variables to be arrays of IDs rather than names

## [2.0.0] - 2022-04-12

### Changed

- Store app settings in vbase to allow `vtex.b2b-quotes` to function as dependency app
- Reorganize `node/resolvers` folder structure

## [1.5.0] - 2022-04-01

### Added

- Added a EventHandler to handle the events from order, changing the quote status to placed when the order has been created
- Improved the async calls to the mail service
- Added a handler to send an email when the quote is placed
- eslint sorted alphabetically

## [1.4.2] - 2022-03-22

### Fixed

adminSetup object creation when it tries to save the hasCron flag

## [1.4.1] - 2022-03-14

### Fixed

- Search list of quotes by reference name or creator email and filter by cost center name

## [1.4.0] - 2022-03-10

### Added

- Scheduler running twice a day changing the quotes status to expired when it needs
- Send email to users who have interacted with a quote when it expires

## [1.3.0] - 2022-03-10

### Added

- backend support to B2BQUOTES-28 updating the expirationDate field

## [1.2.0] - 2022-02-18

### Added

- All Sales Admin users are notified via email when a new quote is requested
- All users who have interacted with a quote are notified via email when the quote is updated
- Default `QuoteCreated` and `QuoteUpdated` email templates to support the above

## [1.1.0] - 2022-01-28

### Added

- Added on getQuote/getQuote a checker if the property b2b-quote-graphQL exists in the orderForm if not then it creates a new property there.

## [1.0.3] - 2022-01-06

## [1.0.2] - 2021-12-23

### Fixed

- Move app settings to `vtex.b2b-quotes` so that this app can function as a dependency app without being explicitly installed in a workspace

### Deprecated

- unused `getSetupConfig` GraphQL query

## [1.0.1] - 2021-12-17

### Fixed

- Enable immediate indexing in MD schema

## [1.0.0] - 2021-10-06

### Removed

- Billing options

## [0.0.1] - 2021-10-06

### Added

- Initial release
