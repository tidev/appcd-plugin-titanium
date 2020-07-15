/* eslint-disable promise/no-callback-in-promise */

import tunnel from '../tunnel';
import * as version from '../../../lib/version';

export function detect(config = {}, opts = {}, callback) {
	tunnel.call('/android/1.x/info')
		.then(info => {
			const results = {
				devices:            info.devices,
				emulators:          info.emulators,
				issues:             [],
				ndk:                processNDK(info.ndk),
				sdk:                processSDK(info.sdk, config, opts.vendorDependencies),
				targets:            results.targets,
				vendorDependencies: opts.vendorDependencies || {}
			};

			// TODO: issues

			callback(results);
		})
		.catch(err => {
			console.error(err);
			callback();
		});
}

function processNDK(ndks) {
	// TODO
	return null;
}

function processSDK(sdks, config, vendorDependencies = {}) {
	const sdk = sdks.sort(a => (a.default ? -1 : 1))[0];
	if (!sdk) {
		return null;
	}

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
			path:         null,
			supported:    null,
			version:      null,
			maxSupported: null
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
		const preferred = config.get('android.buildTools.selectedVersion');
		const buildTools = sdk.buildTools
			.map(b => {
				b.supported = supportedRange && version.satisfies(b.version, supportedRange) ? true : min && version.lt(b.version, min) ? false : 'maybe';
				return b;
			})
			.sort((a, b) => {
				return preferred && version.eq(a.version, preferred) ? -1 : a.supported && b.supported ? 0 : a.supported ? -1 : b.supported ? 1 : version.compare(a.version, b.version);
			})[0];

		if (buildTools) {
			results.buildTools.path = buildTools.path;
			results.buildTools.version = buildTools.version;
			results.buildTools.supported = buildTools.supported;
			if (supportedRange) {
				results.buildTools.maxSupported = version.parseMax(supportedRange);
			}
			results.dx = buildTools.dx;
			Object.assign(results.executables, buildTools.executables);
		}
	}

	return results;
}
