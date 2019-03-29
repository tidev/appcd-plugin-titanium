# v1.4.0 (Mar 29, 2019)

 * Renamed package from `appcd-plugin-titanium-sdk` to `@appcd/plugin-titanium`.
 * Moved SDK install related functions to [titaniumlib](https://www.npmjs.com/package/titaniumlib)
 * Upgraded to Gulp 4.
 * Update dependencies
 * Added `CLIService` for handling Titanium CLI requests.
 * Wired up real-time config changes.
 * Removed unused `BuildService`.
 * Added alias for `/module` to `/modules`.
 * Module list results now returns `android`, `commonjs`, `ios`, and `windows` properties
   regardless if any modules are found.
 * Module list properly recursively scans module paths where it used to stop at the version
   directory instead of descending one additional level.
 * Moved `/modules/list/locations` to `/modules/locations`.
 * Removed `/sdk/list/installed` endpoint.
 * Moved `/sdk/list/ci-branches` to `/sdk/branches`.
 * Moved `/sdk/list/ci-builds` to `/sdk/builds`.
 * Moved `/sdk/list/locations` to `/sdk/locations`.
 * Moved `/sdk/list/releases` to `/sdk/releases`.

# v1.3.0 (Oct 25, 2018)

 * Moved to `@appcd` scope
 * Update dependencies
 * Add Daemon 2.x support

# v1.2.0 (Apr 11, 2018)

 * Added service endpoints for listing releases CI branches, CI builds, installing SDKs, and
   uninstalling SDKs.
   [(DAEMON-247)](https://jira.appcelerator.org/browse/DAEMON-247)
 * Updated npm dependencies.
 * Split the info service 'sdk' and 'module' detection into separate endpoints.
   [(DAEMON-246)](https://jira.appcelerator.org/browse/DAEMON-246)
 * Updated npm dependencies.

# v1.1.0

 * Skipped release.

# v1.0.1 (Jan 10, 2018)

 * Fixed structure of detected modules.
 * Updated npm dependencies.

# v1.0.0 (Jan 9, 2018)

 * Initial release.
