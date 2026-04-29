# Changelog

## 0.2.2 (2026-04-29)

Full Changelog: [v0.2.1...v0.2.2](https://github.com/dedalus-labs/dedalus-cli/compare/v0.2.1...v0.2.2)

### Chores

* drop stale dedalus-go v0.1.0 custom-code pin ([f6646d2](https://github.com/dedalus-labs/dedalus-cli/commit/f6646d2614ca8eb8bea5f7a2da8bbb77b48681ae))

## 0.2.1 (2026-04-29)

Full Changelog: [v0.2.0...v0.2.1](https://github.com/dedalus-labs/dedalus-cli/compare/v0.2.0...v0.2.1)

### Bug Fixes

* **cli:** correctly load zsh autocompletion ([53e9ec6](https://github.com/dedalus-labs/dedalus-cli/commit/53e9ec62582857ca55d3c7d14fb68caf8812f76a))

## 0.2.0 (2026-04-22)

Full Changelog: [v0.1.0...v0.2.0](https://github.com/dedalus-labs/dedalus-cli/compare/v0.1.0...v0.2.0)

### Features

* allow `-` as value representing stdin to binary-only file parameters in CLIs ([7da15e2](https://github.com/dedalus-labs/dedalus-cli/commit/7da15e2f6c1d715fc55e26fa2bd7be95eba5ff0e))
* better error message if scheme forgotten in CLI `*_BASE_URL`/`--base-url` ([5edec04](https://github.com/dedalus-labs/dedalus-cli/commit/5edec044b3dda53824fa2981ffe94b557fc3ce65))
* binary-only parameters become CLI flags that take filenames only ([0875d6c](https://github.com/dedalus-labs/dedalus-cli/commit/0875d6c6e2426509185f56022f763b2927b07af2))
* **cli:** add `--raw-output`/`-r` option to print raw (non-JSON) strings ([d7201c6](https://github.com/dedalus-labs/dedalus-cli/commit/d7201c60f8794ec1c0fe6fcfdd85ece68996c7f9))
* **cli:** alias parameters in data with `x-stainless-cli-data-alias` ([5a62637](https://github.com/dedalus-labs/dedalus-cli/commit/5a6263723604bb1a35fbc53c5f99e7fd7fd0463a))
* **cli:** send filename and content type when reading input from files ([21ec6dd](https://github.com/dedalus-labs/dedalus-cli/commit/21ec6dd8f92d9feafd9e43abd08f9f9fddddf64a))


### Bug Fixes

* fall back to main branch if linking fails in CI ([87613ec](https://github.com/dedalus-labs/dedalus-cli/commit/87613ecfe5030a1a76be6dcfdb29161ff58a2550))
* fix for failing to drop invalid module replace in link script ([547c3e1](https://github.com/dedalus-labs/dedalus-cli/commit/547c3e146cf035cee1b466a85a06529c0117edf2))
* fix quoting typo ([575418c](https://github.com/dedalus-labs/dedalus-cli/commit/575418c4b4a58aa2496fef880d038c59da9e7fb8))


### Chores

* add documentation for ./scripts/link ([6d33e1a](https://github.com/dedalus-labs/dedalus-cli/commit/6d33e1af76dc27b3c70c252b1d28894050b0a7dc))
* add install.ps1 for Windows ([#14](https://github.com/dedalus-labs/dedalus-cli/issues/14)) ([bcc4657](https://github.com/dedalus-labs/dedalus-cli/commit/bcc46570a2f7da106880f864936e0e95bf0cb52b))
* **ci:** add github env support for goreleaser ([158e705](https://github.com/dedalus-labs/dedalus-cli/commit/158e705d900c2cda1e52b8984e821044a7ac38fe))
* **ci:** remove release-doctor workflow ([2a1a9d8](https://github.com/dedalus-labs/dedalus-cli/commit/2a1a9d8c0b94a6c06c2ab828c1c8a6fbf1382f39))
* **ci:** support manually triggering release workflow ([cf0bd76](https://github.com/dedalus-labs/dedalus-cli/commit/cf0bd764b2563d4ab838a99c6ebbf1c45b7ae3e3))
* **cli:** additional test cases for `ShowJSONIterator` ([c64d07c](https://github.com/dedalus-labs/dedalus-cli/commit/c64d07ce2e2819b489ee60e500379bb3d3b4fc67))
* **cli:** default to jsonl format ([4a34328](https://github.com/dedalus-labs/dedalus-cli/commit/4a3432861ff1ba54f4d1b13d7481d9bef18ceb49))
* **cli:** fall back to JSON when using default "explore" with non-TTY ([3b62e8d](https://github.com/dedalus-labs/dedalus-cli/commit/3b62e8d1b6b6305b4cb36aec45abf4f88d3b6a2c))
* **cli:** let `--format raw` be used in conjunction with `--transform` ([c913d27](https://github.com/dedalus-labs/dedalus-cli/commit/c913d2739ca2f58b5498e7aea3b644b4068a1fe8))
* **cli:** switch long lists of positional args over to param structs ([86bdc85](https://github.com/dedalus-labs/dedalus-cli/commit/86bdc85c82d6f81d2d0614cb7e705b55ece80fe7))
* **cli:** use `ShowJSONOpts` as argument to `formatJSON` instead of many positionals ([a19782c](https://github.com/dedalus-labs/dedalus-cli/commit/a19782cd7fed5d41883ed7800b6d2c4c0bde7ced))
* **internal:** more robust bootstrap script ([6fbf8f5](https://github.com/dedalus-labs/dedalus-cli/commit/6fbf8f509d44d42ad50ccc7cb59b62d443ff6a7e))
* mark all CLI-related tests in Go with `t.Parallel()` ([7d1a565](https://github.com/dedalus-labs/dedalus-cli/commit/7d1a565862ae3190b48e40ff892073eca20a5480))
* modify CLI tests to inject stdout so mutating `os.Stdout` isn't necessary ([6073189](https://github.com/dedalus-labs/dedalus-cli/commit/6073189d85a64ac3d53c0f8b08899a2b617740b8))
* switch some CLI Go tests from `os.Chdir` to `t.Chdir` ([ba52bbe](https://github.com/dedalus-labs/dedalus-cli/commit/ba52bbea1667ea208f169c8b1b768e714ad3eeb7))
* **tests:** bump steady to v0.22.1 ([544f575](https://github.com/dedalus-labs/dedalus-cli/commit/544f575622b41ceb09a9491a1c28898e09142757))

## 0.1.0 (2026-04-02)

Full Changelog: [v0.0.4...v0.1.0](https://github.com/dedalus-labs/dedalus-cli/compare/v0.0.4...v0.1.0)

### Features

* **api:** add sleep & wake methods ([1fac358](https://github.com/dedalus-labs/dedalus-cli/commit/1fac358baa8165f7f27ee2de287c5d40f6b34149))


### Chores

* **deps:** bump dedalus-go to v0.1.0 ([#12](https://github.com/dedalus-labs/dedalus-cli/issues/12)) ([e167131](https://github.com/dedalus-labs/dedalus-cli/commit/e167131e75828424fd144682754314b3731d13c5))

## 0.0.4 (2026-04-01)

Full Changelog: [v0.0.3...v0.0.4](https://github.com/dedalus-labs/dedalus-cli/compare/v0.0.3...v0.0.4)

### Features

* set CLI flag constant values automatically where `x-stainless-const` is set ([d1a4106](https://github.com/dedalus-labs/dedalus-cli/commit/d1a4106fd2f001b4c178a49050a30504528c74ee))


### Bug Fixes

* fix for off-by-one error in pagination logic ([2eec67c](https://github.com/dedalus-labs/dedalus-cli/commit/2eec67c81e2d195c52e97c2d885d57bb3456ccdc))
* handle empty data set using `--format explore` ([bfa5c16](https://github.com/dedalus-labs/dedalus-cli/commit/bfa5c16f7fadd9c6e85818815780ab9dac2fcc7b))
* **ssh:** update ssh command for workspace-to-machine rename ([#10](https://github.com/dedalus-labs/dedalus-cli/issues/10)) ([7de7907](https://github.com/dedalus-labs/dedalus-cli/commit/7de7907e81bd678226d2b717ca684d632ce8db02))
* use `RawJSON` when iterating items with `--format explore` in the CLI ([2963002](https://github.com/dedalus-labs/dedalus-cli/commit/296300221e8cf98a27bc927f044aacff4d73f5d9))


### Chores

* **api:** refresh codegen ([2b89c22](https://github.com/dedalus-labs/dedalus-cli/commit/2b89c22a7da48e6def715c9c3e273d9aea9fbb19))
* **api:** rename workspaces to machines ([837411d](https://github.com/dedalus-labs/dedalus-cli/commit/837411d95bc147f00eb5e42f99f420e506752e6b))
* **internal:** update multipart form array serialization ([a9a88ea](https://github.com/dedalus-labs/dedalus-cli/commit/a9a88ead67668ed1c2fdbb4b523dac9597a71d67))
* omit full usage information when missing required CLI parameters ([8f88284](https://github.com/dedalus-labs/dedalus-cli/commit/8f88284f411c79bed22083d8322a3b9ef5d5faf0))
* **tests:** bump steady to v0.20.1 ([d4a2e39](https://github.com/dedalus-labs/dedalus-cli/commit/d4a2e3908e4ec8e7bcca15b68d258dc692a178ee))
* **tests:** bump steady to v0.20.2 ([1aa9e71](https://github.com/dedalus-labs/dedalus-cli/commit/1aa9e718c5d1ab377ed240d15d3027393880feec))

## 0.0.3 (2026-03-25)

Full Changelog: [v0.0.2...v0.0.3](https://github.com/dedalus-labs/dedalus-cli/compare/v0.0.2...v0.0.3)

### Bug Fixes

* **api:** remove ssh command, rename stream-status to watch, drop wake-if-needed ([6c435f3](https://github.com/dedalus-labs/dedalus-cli/commit/6c435f3110f58e2b00f88a4618af66e19f4655ea))
* **ssh:** remove deprecated wake_if_needed field, tidy deps ([982a108](https://github.com/dedalus-labs/dedalus-cli/commit/982a108033a4bee055187538c7f660db0246d7ef))


### Chores

* **ci:** skip lint on metadata-only changes ([421e8ad](https://github.com/dedalus-labs/dedalus-cli/commit/421e8ad850603793988df632dbb69db695894d56))
* **internal:** codegen related update ([40bf2f7](https://github.com/dedalus-labs/dedalus-cli/commit/40bf2f75287c9661956079d19d99d9df152a6260))
* **tests:** bump steady to v0.19.7 ([b60170b](https://github.com/dedalus-labs/dedalus-cli/commit/b60170b9f684e1ca711164495ebc302228336954))

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
