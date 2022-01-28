# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
