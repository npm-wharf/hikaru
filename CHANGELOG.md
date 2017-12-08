# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="1.6.0"></a>
# [1.6.0](https://github.com/npm-wharf/hikaru/compare/v1.5.6...v1.6.0) (2017-12-08)


### Features

* default alias cache to /tmp if no $HOME ([#4](https://github.com/npm-wharf/hikaru/issues/4)) ([67dfbe4](https://github.com/npm-wharf/hikaru/commit/67dfbe4))



<a name="1.5.6"></a>
## [1.5.6](https://github.com/npm-wharf/hikaru/compare/v1.5.1...v1.5.6) (2017-11-30)


### Bug Fixes

* added deletes param to createStatefulSet ([4d26589](https://github.com/npm-wharf/hikaru/commit/4d26589))
* change to how daemonset status checks are implemented ([227bd8a](https://github.com/npm-wharf/hikaru/commit/227bd8a))
* correct import of mcgonagall in HTTP server to use new org name ([fb12510](https://github.com/npm-wharf/hikaru/commit/fb12510))



<a name="1.5.5"></a>
## [1.5.5](https://github.com/npm-wharf/hikaru/compare/v1.5.1...v1.5.5) (2017-11-29)


### Bug Fixes

* added deletes param to createStatefulSet ([4d26589](https://github.com/npm-wharf/hikaru/commit/4d26589))
* correct import of mcgonagall in HTTP server to use new org name ([fb12510](https://github.com/npm-wharf/hikaru/commit/fb12510))



<a name="1.5.4"></a>
## [1.5.4](https://github.com/npm-wharf/hikaru/compare/v1.5.1...v1.5.4) (2017-11-29)


### Bug Fixes

* added deletes param to createStatefulSet ([4d26589](https://github.com/npm-wharf/hikaru/commit/4d26589))
* correct import of mcgonagall in HTTP server to use new org name ([fb12510](https://github.com/npm-wharf/hikaru/commit/fb12510))



<a name="1.5.3"></a>
## [1.5.3](https://github.com/npm-wharf/hikaru/compare/v1.5.2...v1.5.3) (2017-11-27)


### Bug Fixes

* correct import of mcgonagall in HTTP server to use new org name ([eb476f1](https://github.com/npm-wharf/hikaru/commit/eb476f1))



<a name="1.5.2"></a>
## [1.5.2](https://github.com/npm-wharf/hikaru/compare/v1.5.1...v1.5.2) (2017-11-27)



<a name="1.5.1"></a>
## [1.5.1](https://github.com/npm-wharf/hikaru/compare/v1.5.0...v1.5.1) (2017-11-27)


### Bug Fixes

* enable service updates by including clusterIP when available in the original ([d927d93](https://github.com/npm-wharf/hikaru/commit/d927d93))



<a name="1.5.0"></a>
# [1.5.0](https://github.com/npm-wharf/hikaru/compare/v1.4.3...v1.5.0) (2017-11-27)


### Bug Fixes

* adding deployment api group versioning to deployment commands ([cb3393a](https://github.com/npm-wharf/hikaru/commit/cb3393a))
* correct anonymous manifest status check approach ([ebe7e5e](https://github.com/npm-wharf/hikaru/commit/ebe7e5e))
* correct namespaces for daemonset, delete when replace is unavailable on all resources, update mcgonagall version ([f33020a](https://github.com/npm-wharf/hikaru/commit/f33020a))


### Features

* add alias command ([e149484](https://github.com/npm-wharf/hikaru/commit/e149484))
* add scale flag to support scale factoring ([56bd61f](https://github.com/npm-wharf/hikaru/commit/56bd61f))



<a name="1.4.3"></a>
## [1.4.3](https://github.com/npm-wharf/hikaru/compare/v1.4.2...v1.4.3) (2017-11-21)


### Bug Fixes

* prevent timer backoff on status checks from growing unbound ([27e1f6d](https://github.com/npm-wharf/hikaru/commit/27e1f6d))



<a name="1.4.2"></a>
## [1.4.2](https://github.com/npm-wharf/hikaru/compare/v1.4.1...v1.4.2) (2017-11-12)


### Bug Fixes

* solve issue preventing ability to use data files for some tokens and collect missing tokens from CLI via prompts ([8350769](https://github.com/npm-wharf/hikaru/commit/8350769))



<a name="1.4.1"></a>
## [1.4.1](https://github.com/arobson/hikaru/compare/v1.4.0...v1.4.1) (2017-11-06)


### Bug Fixes

* correct problems with health checks for custom manifest types ([caa8af9](https://github.com/arobson/hikaru/commit/caa8af9))



<a name="1.4.0"></a>
# [1.4.0](https://github.com/arobson/hikaru/compare/v1.3.4...v1.4.0) (2017-11-06)


### Bug Fixes

* add missing token file argument to remove command ([61ecb3c](https://github.com/arobson/hikaru/commit/61ecb3c))
* create resource services for job and cron jobs before creating container ([ac58c35](https://github.com/arobson/hikaru/commit/ac58c35))


### Features

* support one-off manifest types ([33ab25e](https://github.com/arobson/hikaru/commit/33ab25e))



<a name="1.3.4"></a>
## [1.3.4](https://github.com/arobson/hikaru/compare/v1.3.3...v1.3.4) (2017-11-01)


### Bug Fixes

* allow token to be read from secret file in kubernetes ([e73f0ee](https://github.com/arobson/hikaru/commit/e73f0ee))
* correct job and cron job's update and replace logic to use delete and create as a fallback ([5e43a04](https://github.com/arobson/hikaru/commit/5e43a04))
* improve diff to allow more update vs. replacements, force remove and create when ClusterIP changes on services ([b7fa3c9](https://github.com/arobson/hikaru/commit/b7fa3c9))



<a name="1.3.3"></a>
## [1.3.3](https://github.com/arobson/hikaru/compare/v1.3.2...v1.3.3) (2017-10-27)



<a name="1.3.2"></a>
## [1.3.2](https://github.com/arobson/hikaru/compare/v1.3.1...v1.3.2) (2017-10-26)



<a name="1.3.1"></a>
## [1.3.1](https://github.com/arobson/hikaru/compare/v1.3.0...v1.3.1) (2017-10-26)


### Bug Fixes

* remove console log statements from k8s module ([3a2bb6c](https://github.com/arobson/hikaru/commit/3a2bb6c))



<a name="1.3.0"></a>
# [1.3.0](https://github.com/arobson/hikaru/compare/v1.2.2...v1.3.0) (2017-10-25)


### Bug Fixes

* improvements to diff and detection of patch vs. replacements ([63aed69](https://github.com/arobson/hikaru/commit/63aed69))


### Features

* add function to list load balancers and connect method to top level to simplify custom module use cases ([d82d0b3](https://github.com/arobson/hikaru/commit/d82d0b3))



<a name="1.2.3"></a>
## [1.2.3](https://github.com/arobson/hikaru/compare/v1.2.2...v1.2.3) (2017-10-25)


### Bug Fixes

* improvements to diff and detection of patch vs. replacements ([63aed69](https://github.com/arobson/hikaru/commit/63aed69))



<a name="1.2.2"></a>
## [1.2.2](https://github.com/arobson/hikaru/compare/v1.2.1...v1.2.2) (2017-10-24)


### Bug Fixes

* resolve issues with diffs during create process ([2bd9150](https://github.com/arobson/hikaru/commit/2bd9150))



<a name="1.2.1"></a>
## [1.2.1](https://github.com/arobson/hikaru/compare/v1.2.0...v1.2.1) (2017-10-23)


### Bug Fixes

* adding scope for module name ([d7ec573](https://github.com/arobson/hikaru/commit/d7ec573))



<a name="1.2.0"></a>
# 1.2.0 (2017-10-23)


### Bug Fixes

* add dockyard install command to travis ([ca88d5f](https://github.com/arobson/hikaru/commit/ca88d5f))
* add missing standard-version dependency ([db468c5](https://github.com/arobson/hikaru/commit/db468c5))
* change mcgonagall dependency from file path ([c6564ee](https://github.com/arobson/hikaru/commit/c6564ee))
* correct baseline Docker image name ([cfabb00](https://github.com/arobson/hikaru/commit/cfabb00))
* standard lint errors ([9d0ee7f](https://github.com/arobson/hikaru/commit/9d0ee7f))
* use node 8 in build and Docker image (required by dependency's package file) ([e3fe2d8](https://github.com/arobson/hikaru/commit/e3fe2d8))


### Features

* add CLI and lib support, redesign implementation for broader cluster control ([11c99fc](https://github.com/arobson/hikaru/commit/11c99fc))
* add docker to build and update README with build and coverage badges ([83458c0](https://github.com/arobson/hikaru/commit/83458c0))
* add filtering based on manifest metadata for upgrade control ([f304e31](https://github.com/arobson/hikaru/commit/f304e31))
* add HTTP API ([f21a210](https://github.com/arobson/hikaru/commit/f21a210))
* add image parsing and comparison with test coverage ([f5e26cb](https://github.com/arobson/hikaru/commit/f5e26cb))
