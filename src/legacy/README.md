# Legacy Titanium CLI

This is a stripped down version of the Titanium CLI v5. Several things such as argument parsing and
internationalization have been removed as they are not needed and speed is critical.

The Titanium SDK contains commands such as `build` and `clean`. These commands are tightly coupled
with the Titanium CLI v5 and older. In order to be able to execute these commands, we need to shim
the bare minimum APIs and features of the Titanium CLI v5.

While this legacy CLI attempts to maintain backwards compatibility, the following APIs and
features are no longer supported.

#### `cli.version`

The Titanium CLI version is set to `5.999.0` as we don't want to break compatibility with Titanium
CLI plugins, but we also want to signify that this is not the real Titanium CLI v5.

#### CLI argument parser

The legacy CLI no longer parses raw CLI arguments. It expects the `argv` values to be passed in as
a JSON object.

#### i18n - Internationalization

Locale is no longer detected and the locale is forced to `en-US`. We have very little translated
strings that users are not going to notice.

#### Selected Titanium SDK and forking correct Titanium SDK

The entire selected Titanium SDK system of the Titanium CLI has been removed. The `<sdk-version>`
in the `tiapp.xml` is the source of truth.

Because this legacy CLI will only ever be invoked with a valid Titanium SDK, various APIs are no
longer needed. See `cli.argv` below.

#### `cli.argv._`, `cli.argv.$`, `cli.argv.$_`, `cli.argv.$0`

`cli.argv` contained the raw CLI arguments and process name as well as the parsed arguments. While
the `cli.argv` will continue to contain the parsed arguments (passed in as a JSON object), the
raw arguments are no longer supported. These properties were intended to be internal only.

Note that node-titanium-sdk's `validateCorrectSDK()` does reference these variables when preparing
to fork using the correct `--sdk` from the app's `tiapp.xml`, however it's a non-issue being that
the correct SDK version will always be set.

#### `cli.on('cli:command-not-found')`

This event was emitted when the specified command was not found so that the Titanium CLI could
check if there were any Titanium SDKs installed and if you happened to misspell the command.

Since this legacy CLI will only ever be called with the either the `build` or `clean` command,
it is impossible for the command to not exist.

#### #Built-in Titanium CLI hook plugins

This legacy CLI does not contain any built-in CLI hook plugins such as `hooks/tisdk3fixes.js`.

#### Config changes

The configuration no longer contains settings for environment detection such as Android, iOS,
JDK, etc. Those config settings are in their respective appcd plugin config files and the Appc
Daemon user config file.

This legacy Titanium CLI will not read or write the original Titanium CLI config file.

#### Log changes

The `--log-level` option has been dropped. There is no log message filtering effectively setting
the log level to `"trace"`.

#### Prompting

The legacy Titanium CLI does not prompt for missing or invalid values. It will throw an exception
containing the vital information required to do the prompting.

The `build` command, and the platform-specific implementations, in the Titanium SDK define several
options that have prompt metadata, however it is unused. Depsite this, the `fields` library has
been mocked to be a noop.

#### Android Detection

When an Android app is being built, it needs to query the Android development environment. This
functionality is now performed by the `android` appcd plugin which does not validate the Java/JDK
and thus will not report any issues with Java being misconfigured.
