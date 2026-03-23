# Changelog

## 0.0.2 (2026-03-23)

Full Changelog: [v0.0.2...v0.0.2](https://github.com/dedalus-labs/dedalus-cli/compare/v0.0.2...v0.0.2)

### Features

* add default description for enum CLI flags without an explicit description ([c1794a0](https://github.com/dedalus-labs/dedalus-cli/commit/c1794a04c9d918b68a9c7f9d1c2226e0ce806830))
* **api:** stable beta ([6e60912](https://github.com/dedalus-labs/dedalus-cli/commit/6e60912f712588b7e92f697809423b93d47cc8c2))
* **ssh:** add ephemeral certificate SSH helper ([80069fa](https://github.com/dedalus-labs/dedalus-cli/commit/80069fad14b33673812488a8bc10e3f9a2bf08e6))


### Bug Fixes

* **api:** add stream-status to workspaces, remove ssh, migrate to steady ([47e0da2](https://github.com/dedalus-labs/dedalus-cli/commit/47e0da24a8f412ef57a0f2e048fbe7ec3569734f))
* **api:** update flags ([52f718e](https://github.com/dedalus-labs/dedalus-cli/commit/52f718e5fa572db767c8697d8e7ababe6992ffc5))
* avoid reading from stdin unless request body is form encoded or json ([522880b](https://github.com/dedalus-labs/dedalus-cli/commit/522880bc900f99d3be158f708491a517af46e81b))
* better support passing client args in any position ([bb63352](https://github.com/dedalus-labs/dedalus-cli/commit/bb633524509e083e78807bf1b652280528bb41b5))
* cli no longer hangs when stdin is attached to a pipe with empty input ([2407337](https://github.com/dedalus-labs/dedalus-cli/commit/2407337d6735e5745f4b418090109d4b80b46fc9))
* improve linking behavior when developing on a branch not in the Go SDK ([69e4687](https://github.com/dedalus-labs/dedalus-cli/commit/69e468741b4d3abe8e710e047fb08633157ffdd2))
* improved workflow for developing on branches ([9b81964](https://github.com/dedalus-labs/dedalus-cli/commit/9b81964097fab54a63bdf1b46a4bd3f556d6b8d3))
* no longer require an API key when building on production repos ([02e3fa0](https://github.com/dedalus-labs/dedalus-cli/commit/02e3fa04b9c2d6229a0dee3218e5900b6cf4ae33))
* **ssh:** add ephemeral certificate SSH helper ([#2](https://github.com/dedalus-labs/dedalus-cli/issues/2)) ([ce03f86](https://github.com/dedalus-labs/dedalus-cli/commit/ce03f86f59032c24a916fc47c102f5d8ce9500ec))
* **ssh:** align types with dedalus-go SDK ([#4](https://github.com/dedalus-labs/dedalus-cli/issues/4)) ([75391d4](https://github.com/dedalus-labs/dedalus-cli/commit/75391d43a3f9491a2bff328f4b1ae5d5ce390e60))


### Chores

* add curl install script ([#6](https://github.com/dedalus-labs/dedalus-cli/issues/6)) ([2059194](https://github.com/dedalus-labs/dedalus-cli/commit/2059194992347690c1800282de0cc9730cf5c3dc))
* **api:** update homebrew tap and code samples ([654e2de](https://github.com/dedalus-labs/dedalus-cli/commit/654e2de50b0f85b285b4932e0238a95d48d07d1a))
* **internal:** tweak CI branches ([e8ef06a](https://github.com/dedalus-labs/dedalus-cli/commit/e8ef06ad15bcd56236656eae8b6f54587a989025))
* **internal:** update gitignore ([596fc86](https://github.com/dedalus-labs/dedalus-cli/commit/596fc86aa50ed8f8746315a9fb6bba13c033ad93))
* **tests:** bump steady to v0.19.4 ([a0028a5](https://github.com/dedalus-labs/dedalus-cli/commit/a0028a5b8d86175fe0e27c8944d9a3c79a26a71b))
* **tests:** bump steady to v0.19.5 ([938cce6](https://github.com/dedalus-labs/dedalus-cli/commit/938cce6410f6c941751494d770726a9d8d581e72))
* **tests:** bump steady to v0.19.6 ([4049dfc](https://github.com/dedalus-labs/dedalus-cli/commit/4049dfcd751f49d72966efcc3c42869a6a63d857))


### Refactors

* **tests:** switch from prism to steady ([a5a9877](https://github.com/dedalus-labs/dedalus-cli/commit/a5a98771bd92763cf690d2e737a52350029fc257))

## 0.0.2 (2026-03-18)

Full Changelog: [v0.0.1...v0.0.2](https://github.com/dedalus-labs/dedalus-cli/compare/v0.0.1...v0.0.2)

### Bug Fixes

* improve linking behavior when developing on a branch not in the Go SDK ([69e4687](https://github.com/dedalus-labs/dedalus-cli/commit/69e468741b4d3abe8e710e047fb08633157ffdd2))
* **ssh:** align types with dedalus-go SDK ([#4](https://github.com/dedalus-labs/dedalus-cli/issues/4)) ([75391d4](https://github.com/dedalus-labs/dedalus-cli/commit/75391d43a3f9491a2bff328f4b1ae5d5ce390e60))


### Chores

* **api:** update homebrew tap and code samples ([654e2de](https://github.com/dedalus-labs/dedalus-cli/commit/654e2de50b0f85b285b4932e0238a95d48d07d1a))

## 0.0.1 (2026-03-18)

Full Changelog: [v0.0.1...v0.0.1](https://github.com/dedalus-labs/dedalus-cli/compare/v0.0.1...v0.0.1)

### Features

* **api:** stable beta ([6e60912](https://github.com/dedalus-labs/dedalus-cli/commit/6e60912f712588b7e92f697809423b93d47cc8c2))
* **ssh:** add ephemeral certificate SSH helper ([80069fa](https://github.com/dedalus-labs/dedalus-cli/commit/80069fad14b33673812488a8bc10e3f9a2bf08e6))


### Bug Fixes

* **api:** update flags ([52f718e](https://github.com/dedalus-labs/dedalus-cli/commit/52f718e5fa572db767c8697d8e7ababe6992ffc5))
* avoid reading from stdin unless request body is form encoded or json ([522880b](https://github.com/dedalus-labs/dedalus-cli/commit/522880bc900f99d3be158f708491a517af46e81b))
* better support passing client args in any position ([bb63352](https://github.com/dedalus-labs/dedalus-cli/commit/bb633524509e083e78807bf1b652280528bb41b5))
* improved workflow for developing on branches ([9b81964](https://github.com/dedalus-labs/dedalus-cli/commit/9b81964097fab54a63bdf1b46a4bd3f556d6b8d3))
* no longer require an API key when building on production repos ([02e3fa0](https://github.com/dedalus-labs/dedalus-cli/commit/02e3fa04b9c2d6229a0dee3218e5900b6cf4ae33))
* **ssh:** add ephemeral certificate SSH helper ([#2](https://github.com/dedalus-labs/dedalus-cli/issues/2)) ([ce03f86](https://github.com/dedalus-labs/dedalus-cli/commit/ce03f86f59032c24a916fc47c102f5d8ce9500ec))


### Chores

* **internal:** tweak CI branches ([e8ef06a](https://github.com/dedalus-labs/dedalus-cli/commit/e8ef06ad15bcd56236656eae8b6f54587a989025))
