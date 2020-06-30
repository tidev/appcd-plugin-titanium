# v2.0.0

 * BREAKING CHANGE(config): `config` command no longer returns status as apart of JSON output.
 * BREAKING CHANGE(config): `config` command does not return current value when doing a `set`,
   `push`, or `unshift`.
 * BREAKING CHANGE(config): `config list` command no longer supports filtering, use `config get`
   instead.
 * BREAKING CHANGE(config): Write operations such as `set` return `"OK"` instead of `"Saved"`.
 * feat(info): Added `filter` argument to `ti info`.
 * feat(project): Added project service handler.
   [(DAEMON-26)](https://jira.appcelerator.org/browse/DAEMON-26)
 * feat(cli): Added `new` command. [(DAEMON-321)](https://jira.appcelerator.org/browse/DAEMON-321)
 * feat(cli): Added auth commands `login`, `logout`, `whoami`, and `switch`.
   [(DAEMON-300)](https://jira.appcelerator.org/browse/DAEMON-300)
 * feat(cli:sdk): Added aliases to sdk commands (i, ls, rm).
 * feat(sdk): Added `find` endpoint to SDK service to get info about an installed Titanium SDK.
 * feat(sdk): Added progress bars during SDK installation.
 * feat(project): Added legacy Titanium CLI command bootstrap.
 * refactor: Updated to cli-kit@0.14.0 adding support for the new client/server architecture.
 * refactor: Updated `config` command actions to be subcommands with improved help output.
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
