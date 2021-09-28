# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.2] - 2021-03-16

### Changed

- Changed cart items table in create quote and view quote to display `name` instead of `skuName`

### Added
- New css handles `itemNameContainer`, `itemName` and `itemSkuName`

### Fixed

- Create quote, remove unwanted error toast message

## [1.5.1] - 2021-03-15

### Changed

- Loading Quotes based on the logged user, not from the orderForm
## [1.5.0] - 2021-02-24

## [1.4.0] - 2021-02-03

### Added

- Tax information to the Quote list, Creation Summary and View Quote
- Romanian translation
- List column names are now translated

### Fixed

- Reference Code at the Quote Creation page

## [1.3.0] - 2021-01-14

### Added

- Description and Status to the quote

### Updated

- Changing schema subtotal data type from `float` to `number`

## [1.2.4] - 2021-01-12

### Changed

- Make cart subtotal data type from `integer` to `float`
- Updated graphql schema version

## [1.2.3] - 2020-12-29

### Fixed

- Compatibility adjustment migrating from an older major version

## [1.2.2] - 2020-12-11

### Fixed

- Hide logo when url is `/`
- Add sku refId when saving the quote

## [1.2.1] - 2020-11-26

### Fixed

- Error on `Use` option was blocking the functionality when the store has deactivated `allowManualPrice`

## [1.2.0] - 2020-11-23

### Added

- Refresh button to the listing page
- New css handles `refreshButton` and `refreshLoading`

### Fixed

- Discount multiplier

### Removed

- CSS Handle `createButton`
- `underscore` dependency
- pvt routes

## [1.1.7] - 2020-10-14

## [1.1.6] - 2020-10-14

### Fixed

- Documentation review and update

## [1.1.5] - 2020-08-26

### Added

- New metadada folder structure
- License files
- Localization file

## [1.1.4] - 2020-08-21

### Changed

- Remove setup instructions from app store descriptions
- App icon revision

## [1.1.3] - 2020-08-18

### Fixed

- Add billingOptions type and availableCountries

## [1.1.1] - 2020-08-12

### Changed

- App store description

### Fixed

- Additional credential to create schemas

## [1.1.0] - 2020-08-05

- Code refactoring

## [1.0.0] - 2020-07-20

### Updated

- APP's icon update
- Documentation

### Added

- `billingOptions` to the `manifest.json`

## [0.2.2] - 2020-07-16

### Updated

- App's icon

## [0.2.1] - 2020-06-23

### Fixed

- Totalizers for listing and detail page

## [0.2.0] - 2020-04-28

### Added

- Save/Recover CustomData values from the order

### Removed

- Callcenter Operator credential requirement

## [0.1.2] - 2020-03-28

### Added

- Validating if user is authenticated before allowing it to save a quotation
- Added new error message to the translation files

### Changed

- Configuration section of the README file

## [0.1.1] - 2020-03-27

### Added

- Translation files for Spanish and Portuguese
- Updating semantic for the translation files and reference key

## [0.1.0] - 2020-03-27

### Added

- Intial release.
- Create/List/Delete/Use Cart
