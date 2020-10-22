# v2.0.0

 * BREAKING CHANGE(config): `config` command no longer returns status as apart of JSON output.
 * BREAKING CHANGE(config): `config` command does not return current value when doing a `set`,
   `push`, or `unshift`.
 * BREAKING CHANGE(config): `config list` command no longer supports filtering, use `config get`
   instead.
 * BREAKING CHANGE(config): Write operations such as `set` return `"OK"` instead of `"Saved"`.
 * BREAKING CHANGE: Dropped support for appcd plugin API version 1.0 and require API version 2.0,
   which was initially introduced in `appcd@4.0.0`.
 * feat(info): Added `filter` argument to `ti info`.
 * feat(project): Project service with endpoints for `new`, `build`, `run`, `clean`, and info.
   [(DAEMON-26)](https://jira.appcelerator.org/browse/DAEMON-26)
   [(DAEMON-21)](https://jira.appcelerator.org/browse/DAEMON-21)
 * feat(cli): Added `new` command. [(DAEMON-301)](https://jira.appcelerator.org/browse/DAEMON-301)
 * feat(cli): Added `clean` command.
   [(DAEMON-327)](https://jira.appcelerator.org/browse/DAEMON-327)
 * feat(cli): Added `build` and `run` commands.
   [(DAEMON-16)](https://jira.appcelerator.org/browse/DAEMON-16)
 * feat(cli): Added auth commands `login`, `logout`, `whoami`, and `switch`.
   [(DAEMON-300)](https://jira.appcelerator.org/browse/DAEMON-300)
 * feat(legacy): Legacy Titanium CLI bootstrap for loading a Titanium SDK and running a `build` or
   `clean` command. For differences between this and Titanium CLI v5, see the
   [readme](https://github.com/appcelerator/appcd-plugin-titanium/blob/master/src/legacy/README.md).
 * feat(legacy): Added support for remote encryption.
 * feat(cli:sdk): Added aliases to sdk commands (i, ls, rm).
 * feat(sdk): Added `find` endpoint to SDK service to get info about an installed Titanium SDK.
 * feat(sdk): Added progress bars during SDK installation.
 * feat(module): Added `/module/check-downloads` endpoint.
 * feat(module): Added `/module/install` endpoint.
 * feat(module): Added automatic checking of new Titanium module downloads.
 * feat: Support for Titanium-specific telemetry.
 * feat: Added HTTP proxy support.
 * feat: Adopted appcd 4.x new `appcd.config.*`.
 * feat(cli): Added `register` command to replace old --import flag.
 * feat(project): Added `/project/register` endpoint.
 * feat(amplify): Upgraded from AMPLIFY appcd plugin v1.x to v2.x.
 * refactor: Updated to latest cli-kit with support for the new client/server architecture.
 * refactor: Updated `config` command actions to be subcommands with improved help output.
 * fix(legacy): Improved logging of uncaught exceptions and rejections.
 * chore: Removed `source-map-support` as `appcd-plugin` already hooks it up.
 * chore: Added plugin API version 2.x.
 * chore: Transpile for Node 10 instead of Node 8. Not a breaking change as appcd has always
   guaranteed Node 10 or newer.
 * chore: Updated dependencies.

# v1.8.1 (Jan 15, 2020)

 * chore: Updated outdated readme.

# v1.8.0 (Jan 14, 2020)

 * feat: Formatted `info` command output.
 * feat: Added `sdk` command implementation.
 * chore: Updated copyright in banner.
 * chore: Verbiage cleanup.
 * chore: Updated dependencies.

# v1.7.0 (Jan 13, 2020)

 * feat(sdk): Added support for progress tracking during SDK install.
 * feat: Wired up live configuration changes.
   [(DAEMON-198)](https://jira.appcelerator.org/browse/DAEMON-198)
 * fix(sdk): Fixed incorrect `uninstall()` argument.
 * fix(cli): Fixed `info` command to not require `--output` and `--types`.
 * fix(util): Fixed user agent parsing to allow null user agent strings.
 * fix(module): Fixed filesystem watcher depth for modules directory.
 * chore(module): Removed debug logging.
 * fix(module): Initialize module type buckets so bucket exists regardless if any modules of that
   type are found.
 * chore: Switched to new `appcd.apiVersion`.
   [(DAEMON-309)](https://jira.appcelerator.org/browse/DAEMON-309)
 * chore: Updated links in `package.json`.
 * chore: Updated dependencies.

# v1.6.0 (Aug 15, 2019)

 * chore: Added Appc Daemon v3 to list of compatible appcd versions.
 * chore: Update dependencies.

# v1.5.0 (Jun 6, 2019)

 * fix: Updated config to remove redundant `titanium` namespace.
 * fix: Fixed version in banner.
 * fix: Fixed version returned by `--version`.
 * feat: Added appcd debug logger and plugin version to exec() data payload.
 * feat: Added the `config` command implementation.
 * feat: Added the `info` command implementation.
 * chore: Updated dependencies.
 * chore: Switched `prepare` script to `prepack`.

# v1.4.0 (Mar 29, 2019)

 * chore: Renamed package from `appcd-plugin-titanium-sdk` to `@appcd/plugin-titanium`.
 * refactor: Moved SDK install related functions to
   [titaniumlib](https://www.npmjs.com/package/titaniumlib)
 * chore: Upgraded to Gulp 4.
 * chore: Update dependencies
 * feat: Added `CLIService` for handling Titanium CLI requests.
 * feat: Wired up real-time config changes.
 * chore: Removed unused `BuildService`.
 * feat: Added alias for `/module` to `/modules`.
 * fix: Module list results now returns `android`, `commonjs`, `ios`, and `windows` properties
   regardless if any modules are found.
 * fix: Module list properly recursively scans module paths where it used to stop at the version
   directory instead of descending one additional level.
 * refactor: Moved `/modules/list/locations` to `/modules/locations`.
 * chore: Removed `/sdk/list/installed` endpoint.
 * refactor: Moved `/sdk/list/ci-branches` to `/sdk/branches`.
 * refactor: Moved `/sdk/list/ci-builds` to `/sdk/builds`.
 * refactor: Moved `/sdk/list/locations` to `/sdk/locations`.
 * refactor: Moved `/sdk/list/releases` to `/sdk/releases`.

# v1.3.0 (Oct 25, 2018)

 * chore: Moved to `@appcd` scope
 * chore: Update dependencies
 * feat: Add Daemon 2.x support

# v1.2.0 (Apr 11, 2018)

 * feat: Added service endpoints for listing releases CI branches, CI builds, installing SDKs, and
   uninstalling SDKs.
   [(DAEMON-247)](https://jira.appcelerator.org/browse/DAEMON-247)
 * chore: Updated dependencies.
 * fix: Split the info service 'sdk' and 'module' detection into separate endpoints.
   [(DAEMON-246)](https://jira.appcelerator.org/browse/DAEMON-246)
 * chore: Updated dependencies.

# v1.1.0

 * oops: Skipped release.

# v1.0.1 (Jan 10, 2018)

 * fix: Fixed structure of detected modules.
 * chore: Updated dependencies.

# v1.0.0 (Jan 9, 2018)

 * Initial release.
