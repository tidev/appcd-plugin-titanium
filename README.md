# @appcd/plugin-titanium

Titanium SDK services for the Appc Daemon.

> This plugin requires appcd plugin API version 2.x which was introduced in appcd@4.0.0 and the
> AMPLIFY appcd plugin v2.x.

## Services

 * [SDKs](#SDKs)
   - [`/sdk/list/installed`](#sdklistinstalled)
   - [`/sdk/list/locations`](#sdklistlocations)
   - [`/sdk/list/releases`](#sdklistreleases)
   - [`/sdk/list/branches`](#sdklistbranches)
   - [`/sdk/list/builds/:branch?`](#sdklistbuildsbranch)
   - [`/sdk/install/:name?`](#sdkinstallname)
   - [`/sdk/uninstall/:name?`](#sdkuninstallname)
 * [Modules](#Modules)
   - [`/modules/list/locations`](#moduleslistlocations)
   - [`/modules/list/installed`](#moduleslistinstalled)
 * [CLI](#CLI)
   - [`/cli`](#cli)
   - [`/cli/schema`](#clischema)

## SDKs

The `/sdk` service provides Titanium SDK information and management.

### `/sdk/list/installed`

Returns a list of installed Titanium SDKs across all installation locations. This endpoint supports
subscriptions.

> :bulb: Note: `/sdk` and `/sdk/list` forward to `/sdk/list/installed`.

#### API Usage

```js
const { response } = await appcd.call('/titanium/latest/sdk/list/installed');
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /titanium/latest/sdk/list/installed
{
  "status": 200,
  "message": [
    {
      "name": "7.0.1.GA",
      "path": "/Users/jeff/Library/Application Support/Titanium/mobilesdk/osx/7.0.1.GA",
      "manifest": {
        "name": "7.0.1.v20171218104141",
        "version": "7.0.1",
        "timestamp": "12/18/2017 18:48",
        "githash": "f5ae7e5",
        "moduleAPIVersion": {
          "iphone": "2",
          "android": "4",
          "windows": "4"
        },
        "platforms": [
          "iphone",
          "android"
        ]
      }
    },
    {
      "name": "7.1.0.GA",
      "path": "/Users/jeff/Library/Application Support/Titanium/mobilesdk/osx/7.1.0.GA",
      "manifest": {
        "name": "7.1.0.v20180314133955",
        "version": "7.1.0",
        "timestamp": "3/14/2018 20:46",
        "githash": "df92fbf",
        "moduleAPIVersion": {
          "iphone": "2",
          "android": "4",
          "windows": "4"
        },
        "platforms": [
          "iphone",
          "android"
        ]
      }
    }
  ]
}
```

To listen for changes, pass in the `--subscribe` flag:

```sh
$ appcd exec /titanium/latest/sdk/list/installed --subscribe
```

### `/sdk/list/releases`

Returns a list of all available Titanium SDK GA releases.

#### API Usage

```js
const { response } = await appcd.call('/titanium/latest/sdk/list/releases');
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /titanium/latest/sdk/list/releases
{
  "status": 200,
  "message": {
    "7.1.0.GA": {
      "version": "7.1.0",
      "url": "http://builds.appcelerator.com/mobile-releases/7.1.0/mobilesdk-7.1.0.GA-osx.zip"
    },
    "7.0.2.GA": {
      "version": "7.0.2",
      "url": "http://builds.appcelerator.com/mobile-releases/7.0.2/mobilesdk-7.0.2.GA-osx.zip"
    },
    "7.0.1.GA": {
      "version": "7.0.1",
      "url": "http://builds.appcelerator.com/mobile-releases/7.0.1/mobilesdk-7.0.1.GA-osx.zip"
    },
    "7.0.0.GA": {
      "version": "7.0.0",
      "url": "http://builds.appcelerator.com/mobile-releases/7.0.0/mobilesdk-7.0.0.GA-osx.zip"
    },
    <snip>
  }
}
```

### `/sdk/find/:name?`

Returns information about the specified installed SDK.

#### CLI Usage

```sh
$ appcd exec /titanium/latest/sdk/find
```

```sh
$ appcd exec /titanium/latest/sdk/find/latest
```

```sh
$ appcd exec /titanium/latest/sdk/find/9.0.0.GA
```

### `/sdk/list/branches`

Returns a list of continuous integration branches and which one is the default.

#### API Usage

```js
const { response } = await appcd.call('/titanium/latest/sdk/list/branches');
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /titanium/latest/sdk/list/ci-branches
{
  "status": 200,
  "message": {
    "defaultBranch": "master",
    "branches": [
      "master",
      "3_5_X",
      "4_0_X",
      "4_1_X",
      "5_0_X",
      "5_1_X",
      "5_1_1",
      "5_2_X",
      "5_3_X",
      "5_4_X",
      "5_5_X",
      "6_0_X",
      "6_1_X",
      "6_2_X",
      "6_2_1",
      "6_3_X",
      "7_0_X",
      "7_1_X"
    ]
  }
}
```

### `/sdk/list/builds/:branch?`

Returns a map of continuous integration builds for the `master` branch or a specific branch.

#### API Usage

```js
let { response } = await appcd.call('/titanium/latest/sdk/list/builds');
console.log(response);

({ response } = await appcd.call('/titanium/latest/sdk/list/builds/master'));
console.log(response);

({ response } = await appcd.call('/titanium/latest/sdk/list/builds/7_1_X'));
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /titanium/latest/sdk/list/branches/7_1_X
{
  "status": 200,
  "message": {
    <snip>
    "7.1.1.v20180404110450": {
      "version": "7.1.1",
      "ts": "20180404110450",
      "githash": "32d9e223b920d6ea868bf4167493d9bd0c5fcde5",
      "date": "2018-04-04T16:04:50.000Z",
      "url": "http://builds.appcelerator.com/mobile/7_1_X/mobilesdk-7.1.1.v20180404110450-osx.zip"
    },
    "7.1.1.v20180404140210": {
      "version": "7.1.1",
      "ts": "20180404140210",
      "githash": "32d9e223b920d6ea868bf4167493d9bd0c5fcde5",
      "date": "2018-04-04T19:02:10.000Z",
      "url": "http://builds.appcelerator.com/mobile/7_1_X/mobilesdk-7.1.1.v20180404140210-osx.zip"
    }
  }
}
```

### `/sdk/install/:name?`

Installs the latest Titanium SDK GA release or a specific release, CI build, CI branch build, URL,
or local `.zip` file.

The `/sdk/install` endpoint returns a streamed response that emits the `data`, `end`, and `error` events.

#### CLI Usage

Installing the latest GA release:

```js
const { response } = await appcd.call('/titanium/latest/sdk/install');

response.on('data', evt => {
  console.log(evt);
});
```

```sh
$ appcd exec /titanium/latest/sdk/install
```

```sh
$ appcd exec /titanium/latest/sdk/install/latest
```

```sh
$ appcd exec /titanium/latest/sdk/install '{ "uri": "latest" }'
```

#### API Usage

Installing the latest GA release with progress events:

```js
const { response } = await appcd.call('/titanium/latest/sdk/install', {
  data: {
    progress: true
  }
});

response.on('data', evt => {
  console.log(evt);
});
```

```sh
$ appcd exec /titanium/latest/sdk/install '{ "progress": true }'
```

```sh
$ appcd exec /titanium/latest/sdk/install/latest '{ "progress": true }'
```

```sh
$ appcd exec /titanium/latest/sdk/install '{ "progress": true, "uri": "latest" }'
```

Installing a specific GA release:

```sh
$ appcd exec /titanium/latest/sdk/install/7.0.2
```

```sh
$ appcd exec /titanium/latest/sdk/install '{ "uri": "7.0.2" }'
```

```sh
$ appcd exec /titanium/latest/sdk/install/7.0.2.GA
```

```sh
$ appcd exec /titanium/latest/sdk/install '{ "uri": "7.0.2.GA" }'
```

Installing an SDK from a remote URL:

```sh
$ appcd exec /titanium/latest/sdk/install '{ "uri": "http://builds.appcelerator.com/mobile-releases/7.1.0/mobilesdk-7.1.0.GA-osx.zip" }'
```

Installing the latest CI build for a given branch:

```sh
$ appcd exec /titanium/latest/sdk/install/master
```

```sh
$ appcd exec /titanium/latest/sdk/install '{ "uri": "master" }'
```

```sh
$ appcd exec /titanium/latest/sdk/install/7_0_X
```

```sh
$ appcd exec /titanium/latest/sdk/install '{ "uri": "7_0_X" }'
```

Installing a specific CI build by name or by branch+name:

```sh
$ appcd exec /titanium/latest/sdk/install/7.2.0.v20180403153400
```

```sh
$ appcd exec /titanium/latest/sdk/install '{ "uri": "7.2.0.v20180403153400"}'
```

```sh
$ appcd exec /titanium/latest/sdk/install/master:7.2.0.v20180403153400
```

```sh
$ appcd exec /titanium/latest/sdk/install '{ "uri": "master:7.2.0.v20180403153400" }'
```

Installing a specific CI build by git hash:

```sh
$ appcd exec /titanium/latest/sdk/install '{ "uri": "f9819892048c1056e4dafde22ccd1d59afae8941" }'
```

Installing from a local archive:

```sh
$ appcd exec /titanium/latest/sdk/install '{ "uri": "/path/to/some/titanium-dist.zip" }'
```

```sh
$ appcd exec /titanium/latest/sdk/install '{ "uri": "file:///path/to/some/titanium-dist.zip" }'
```

### `/sdk/uninstall/:name?`

Uninstalls a specific Titanium SDK.

```js
const { response } = await appcd.call('/titanium/latest/sdk/uninstall/7.0.0.GA');
console.log(response);
```

```js
const { response } = await appcd.call('/titanium/latest/sdk/uninstall', { uri: '7.0.0.GA' });
console.log(response);
```

```js
const { response } = await appcd.call('/titanium/latest/sdk/uninstall', { uri: '/path/to/7.0.0.GA' });
console.log(response);
```

```sh
$ appcd exec /titanium/latest/sdk/uninstall/7.0.0.GA
```

```sh
$ appcd exec /titanium/latest/sdk/uninstall '{"uri": "7.0.0.GA"}'
```

```sh
$ appcd exec /titanium/latest/sdk/uninstall '{"uri": "/path/to/7.0.0.GA"}'
```

## Modules

The `/modules` service provides information about native Titanium Modules.

### `/modules/list/locations`

Returns a list of all directories where Titanium Modules may be installed. The first path is the
default location.

#### API Usage

```js
const { response } = await appcd.call('/titanium/latest/modules/list/locations');
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /titanium/latest/modules/list/locations
{
  "status": 200,
  "message": [
    "/Users/jeff/Library/Application Support/Titanium/modules",
    "/Library/Application Support/Titanium/modules"
  ]
}
```

### `/modules/list/installed`

Returns a list of installed Titanium Modules across all installation locations. This endpoint
supports subscriptions.

> :bulb: Note: `/modules` and `/modules/list` forward to `/modules/list/installed`.

#### API Usage

```js
const { response } = await appcd.call('/titanium/latest/modules/list/installed');
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /titanium/latest/modules/list/installed
{
  "status": 200,
  "message": {
    "ios": {
      "hyperloop": {
        "3.0.3": {
          "path": "/Users/jeff/Library/Application Support/Titanium/modules/windows/hyperloop/3.0.3",
          "platform": "windows",
          "version": "3.0.3",
          "apiversion": 4,
          "architectures": "ARM x86",
          "description": "hyperloop",
          "author": "Appcelerator",
          "license": "Appcelerator Commercial License",
          "copyright": "Copyright (c) 2016-Present Appcelerator, Inc.",
          "name": "hyperloop",
          "moduleid": "hyperloop",
          "moduleIdAsIdentifier": "Hyperloop",
          "classname": "HyperloopModule",
          "guid": "bdaca69f-b316-4ce6-9065-7a61e1dafa39",
          "minsdk": "7.0.0"
        }
      }
    }
  }
}
```

To listen for changes, pass in the `--subscribe` flag:

```sh
$ appcd exec /titanium/latest/module/list/installed --subscribe
```

## CLI

The `/cli` service process requests from the Titanium CLI.

### `/cli`

Returns the CLI session server URL.

#### API Usage

Display the help:

```js
const { response } = await appcd.call('/titanium/latest/cli');

response.on('data', ({ url }) => {
  console.log(`Next, open a WebSocket to ${url}`);
});
```

### `/cli/schema`

Returns a JSON object describing the available Titanium CLI commands and options.

#### API Usage

```js
const { response } = await appcd.call('/titanium/latest/cli/schema');
console.log(response);
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appcd-plugin-titanium/blob/master/LICENSE
