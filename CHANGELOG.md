# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
