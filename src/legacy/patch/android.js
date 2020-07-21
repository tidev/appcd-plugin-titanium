/* eslint-disable promise/no-callback-in-promise */

import tunnel from '../tunnel';
import * as version from '../../lib/version';
import { snooplogg } from 'cli-kit';

const { alert } = snooplogg.styles;

/**
 * Detects Android development environment by calling the `android` appcd plugin and translating
 * the results into a Titanium SDK compatible structure.
 *
 * @param {Object} config - The Titanium CLI config object.
 * @param {Object} opts - Various options.
 * @param {Object} opts.packageJson - The Android platform-specific `package.json`.
 * @param {Function} callback - A function to call with the detection results. Note that this
 * function receives a single argument with the info. Any errors must be silenced.
 */
export function detect(config = {}, { packageJson } = {}, callback) {
	tunnel.call('/android/2.x/info')
		.then(({ response: info }) => {
			const { vendorDependencies } = packageJson;
			const results = {
				avds:               info.emulators,
				devices:            info.devices,
				issues:             [],
				ndk:                processNDK(info.ndks),
				sdk:                processSDK(info.sdks, config, vendorDependencies),
				targets:            {},
				vendorDependencies: vendorDependencies || {}
			};

			processTargets(results, info.sdks, vendorDependencies);

			if (!results.ndk) {
				results.issues.push({
					id: 'ANDROID_NDK_NOT_FOUND',
					type: 'warning',
					message: `Unable to locate an Android NDK.
Without the NDK, you will not be able to build native Android Titanium modules.
To install the Android NDK, use Android Studio's SDK Manager.
If you have already installed the Android NDK, configure the location by running: appcd config push android.ndk.searchPaths /path/to/android-ndk`
				});
			}

			if (results.sdk) {
				const appendInfo = msg => {
					return `${msg}

Current installed Android SDK tools:
  Android SDK Tools:          ${results.sdk.tools.version || 'not installed'}  (Supported: ${vendorDependencies['android tools']})
  Android SDK Platform Tools: ${results.sdk.platformTools.version || 'not installed'}  (Supported: ${vendorDependencies['android platform tools']})
  Android SDK Build Tools:    ${results.sdk.buildTools.version || 'not installed'}  (Supported: ${vendorDependencies['android build tools']})

Make sure you have the latest Android SDK Tools, Platform Tools, and Build Tools installed.`;
				};

				if (!results.sdk.buildTools.supported) {
					results.issues.push({
						id: 'ANDROID_BUILD_TOOLS_NOT_SUPPORTED',
						type: 'error',
						message: appendInfo(`Android Build Tools ${results.sdk.buildTools.version} are not supported by Titanium`)
					});
				}

				if (results.sdk.buildTools.notInstalled) {
					const preferred = config.get('titanium.android.buildTools.selectedVersion');
					results.issues.push({
						id: 'ANDROID_BUILD_TOOLS_CONFIG_SETTING_NOT_INSTALLED',
						type: 'error',
						message: appendInfo(`The selected version of Android SDK Build Tools (${preferred}) are not installed.
Please either install this version of the build tools or remove this setting by running:
  ti config delete android.buildTools.selectedVersion
and
  appcd config delete titanium.android.buildTools.selectedVersion`)
					});
				}

				// check if the sdk is missing any commands
				var missing = [ 'adb', 'emulator', 'mksdcard', 'zipalign', 'aapt', 'aidl', 'dx' ].filter(cmd => !results.sdk.executables[cmd]);
				if (missing.length && results.sdk.buildTools.supported) {
					results.issues.push({
						id: 'ANDROID_SDK_MISSING_PROGRAMS',
						type: 'error',
						message: appendInfo(`Missing required Android SDK tool${missing.length !== 1 ? 's' : ''}: ${missing.join(', ')}`)
					});
				}
			} else {
				results.issues.push({
					id: 'ANDROID_SDK_NOT_FOUND',
					type: 'error',
					message: `Unable to locate an Android SDK.
To install the Android SDK, use Android Studio's SDK Manager.
If you have already installed the Android SDK, configure the location by running: appcd config push android.sdk.searchPaths /path/to/android-sdk`
				});
			}

			callback(results);
		})
		.catch(err => {
			tunnel.log(alert(err.stack));
			callback({
				issues: [],
				sdk: null
			});
		});
}

function processNDK(ndks) {
	if (!ndks.length) {
		return {};
	}
	return ndks.length > 1 && ndks.find(ndk => ndk.default) || ndks[0];
}

function processSDK(sdks, config, vendorDependencies = {}) {
	if (!sdks.length) {
		return null;
	}

	const sdk = sdks.length > 1 && sdks.find(sdk => sdk.default) || sdks[0];

	const results = {
		path:             sdk.path,
		executables: {
			adb:          null,
			android:      null,
			emulator:     null,
			mksdcard:     null,
			zipalign:     null,
			aapt:         null,
			aidl:         null,
			dx:           null,
			apksigner:    null
		},
		dx:               null,
		proguard:         null,
		tools: {
			path:         null,
			supported:    null,
			version:      null
		},
		platformTools: {
			path:         null,
			supported:    null,
			version:      null
		},
		buildTools: {
			maxSupported: null,
			notInstalled: false,
			path:         null,
			supported:    null,
			version:      null
		}
	};

	if (sdk.platformTools) {
		results.executables.adb = sdk.platformTools.executables.adb;
	}

	if (sdk.tools) {
		results.executables.emulator = sdk.tools.executables.emulator;
	}

	if (sdk.buildTools) {
		const supportedRange = vendorDependencies['android build tools'];
		const min = supportedRange && version.parseMin(supportedRange);
		const preferred = config.get('titanium.android.buildTools.selectedVersion');
		const installedBuildTools = sdk.buildTools
			.map(b => {
				b.supported = supportedRange && version.satisfies(b.version, supportedRange) ? true : min && version.lt(b.version, min) ? false : 'maybe';
				return b;
			})
			.sort((a, b) => version.compare(a.version, b.version));

		let buildTools;
		if (preferred) {
			buildTools = installedBuildTools.find(bt => version.eq(bt.version, preferred));
			results.buildTools.notInstalled = !buildTools;
		} else {
			buildTools = installedBuildTools[0];
			results.buildTools.notInstalled = false;
		}

		if (buildTools) {
			results.buildTools.path         = buildTools.path;
			results.buildTools.version      = buildTools.version;
			results.buildTools.supported    = buildTools.supported;
			if (supportedRange) {
				results.buildTools.maxSupported = version.parseMax(supportedRange);
			}
			results.dx = buildTools.dx;
			Object.assign(results.executables, buildTools.executables);
		}
	}

	return results;
}

function processTargets(results, sdks, vendorDependencies) {
	let idx = 1;
	let valid = 0;

	for (const sdk of sdks) {
		for (const platform of sdk.platforms) {
			const supported = !~~platform.apiLevel || version.satisfies(platform.apiLevel, vendorDependencies['android sdk']);

			if (supported) {
				valid++;
			} else {
				results.issues.push({
					id: 'ANDROID_API_TOO_OLD',
					type: 'warning',
					message: `Android API ${platform.name} (${platform.id}) is too old.
The minimum supported Android SDK platform API level API level ${version.parseMin(vendorDependencies['android sdk'])}.`
				});
			}

			results.targets[String(idx++)] = {
				abis:        platform.abis,
				aidl:        platform.aidl,
				androidJar:  platform.androidJar,
				'api-level': platform.apiLevel,
				id:          platform.sdk,
				name:        platform.name,
				path:        platform.path,
				revision:    platform.revision,
				sdk:         platform.apiLevel,
				skins:       platform.skins,
				supported,
				type:        'platform',
				version:     platform.version
			};
		}
	}

	if (idx === 1) {
		results.issues.push({
			id: 'ANDROID_NO_APIS',
			type: 'error',
			message: 'No Android APIs found.\nRun \'Android Studio\' to install the latest Android APIs.'
		});
	} else if (!valid) {
		results.issues.push({
			id: 'ANDROID_NO_VALID_APIS',
			type: 'warning',
			message: 'No supported Android APIs found\nRun \'Android Studio\' to install the latest Android APIs.'
		});
	}
}
