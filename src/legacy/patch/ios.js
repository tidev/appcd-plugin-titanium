/* eslint-disable promise/no-callback-in-promise */

import tunnel from '../tunnel';
import * as version from '../../lib/version';
import { snooplogg } from 'cli-kit';

const { alert } = snooplogg.styles;

let cache;

export function detect(opts = {}, callback) {
	if (cache) {
		return callback(null, cache);
	}

	tunnel.call('/ios/2.x/info')
		.then(({ response: info }) => {
			const results = {
				certs:         {},
				devices:       info.devices,
				iosSDKtoXcode: {},
				issues:        [],
				provisioning:  {},
				selectedXcode: null,
				simulators:    info.simulators,
				teams:         Object.entries(info.teams).map(([ id, name ]) => ({ id, name })),
				xcode:         {}
			};

			processCerts(info, results);
			processProvisioning(info, results);
			processXcodes(info, results, opts);

			cache = results;
			callback(null, results);
		})
		.catch(err => {
			tunnel.log(alert(err.stack));
			callback(err);
		});
}

function processCerts(info, results) {
	const keychains = {};
	results.certs = { keychains, wwdr: info.certs.wwdr };

	for (const type of [ 'developer', 'distribution' ]) {
		for (const cert of info.certs[type]) {
			if (!keychains[cert.keychain]) {
				keychains[cert.keychain] = {
					developer: [],
					distribution: []
				};
			}
			keychains[cert.keychain][type].push(cert);
		}
	}

	if (!results.certs.wwdr) {
		results.issues.push({
			id: 'IOS_NO_WWDR_CERT_FOUND',
			type: 'error',
			message: 'Apple’s World Wide Developer Relations (WWDR) intermediate certificate is not installed.\nThis will prevent you from building apps for iOS devices or package for distribution.'
		});
	}

	if (!Object.keys(keychains).length) {
		results.issues.push({
			id: 'IOS_NO_KEYCHAINS_FOUND',
			type: 'warning',
			message: 'Unable to find any keychains found.'
		});
	}

	let validDevCerts = 0;
	let validDistCerts = 0;

	for (const keychain of Object.keys(keychains)) {
		validDevCerts += (results.certs.keychains[keychain].developer || []).filter(c => !c.invalid).length;
		validDistCerts += (results.certs.keychains[keychain].distribution || []).filter(c => !c.invalid).length;
	}

	if (!validDevCerts) {
		results.issues.push({
			id: 'IOS_NO_VALID_DEV_CERTS_FOUND',
			type: 'warning',
			message: 'Unable to find any valid iOS developer certificates.\nThis will prevent you from building apps for iOS devices.'
		});
	}

	if (!validDistCerts) {
		results.issues.push({
			id: 'IOS_NO_VALID_DIST_CERTS_FOUND',
			type: 'warning',
			message: 'Unable to find any valid iOS production distribution certificates.\nThis will prevent you from packaging apps for distribution.'
		});
	}
}

function processProvisioning(info, results) {
	results.provisioning = info.provisioning;

	const valid = {
		development: 0,
		adhoc: 0,
		enterprise: 0,
		distribution: 0
	};

	for (const type of Object.keys(results.provisioning)) {
		for (const profile of Object.keys(results.provisioning[type])) {
			if (!profile.expired) {
				valid[type]++;
			}
		}
	}

	if (!results.provisioning.development.length || !valid.development) {
		results.issues.push({
			id: 'IOS_NO_VALID_DEVELOPMENT_PROVISIONING_PROFILES',
			type: 'warning',
			message: 'Unable to find any valid iOS development provisioning profiles.\nThis will prevent you from building apps for testing on iOS devices.'
		});
	}

	if (!results.provisioning.adhoc.length || !valid.adhoc) {
		results.issues.push({
			id: 'IOS_NO_VALID_ADHOC_PROVISIONING_PROFILES',
			type: 'warning',
			message: 'Unable to find any valid iOS adhoc provisioning profiles.\nThis will prevent you from packaging apps for adhoc distribution.'
		});
	}

	if (!results.provisioning.distribution.length || !valid.distribution) {
		results.issues.push({
			id: 'IOS_NO_VALID_DISTRIBUTION_PROVISIONING_PROFILES',
			type: 'warning',
			message: 'Unable to find any valid iOS distribution provisioning profiles.\nThis will prevent you from packaging apps for AppStore distribution.'
		});
	}
}

function processXcodes(info, results, opts) {
	results.xcode = info.xcode;

	const eulaNotAccepted = [];
	const { minIosVersion, supportedVersions } = opts;
	const xcodes = Object.entries(info.xcode);
	let validXcodes = 0;
	let sdkCounter = 0;

	results.iosSDKtoXcode = {};

	if (xcodes.length) {
		for (const [ xcodeId, xcode ] of xcodes) {
			if (xcode.default) {
				results.selectedXcode = xcode;
			}

			xcode.supported = supportedVersions ? version.satisfies(xcode.version, supportedVersions) : true;
			if (xcode.supported) {
				validXcodes++;
			} else {
				const min = version.parseMin(supportedVersions);
				results.issues.push({
					id: 'IOS_XCODE_TOO_OLD',
					type: 'warning',
					message: `Xcode ${xcode.version} is too old and is no longer supported.\nThe minimum supported Xcode version is Xcode ${min}.`,
					xcodeVer: xcode.version,
					minSupportedVer: min
				});
			}

			if (!xcode.eulaAccepted) {
				eulaNotAccepted.push(xcode);
			}

			if (minIosVersion) {
				xcode.sdks.ios = xcode.sdks.ios.filter(ver => version.gte(ver, minIosVersion));
			}

			xcode.sdks = xcode.sdks.ios;

			for (const sdk of xcode.sdks) {
				if (xcode.default || !results.iosSDKtoXcode[sdk]) {
					results.iosSDKtoXcode[sdk] = xcodeId;
				}
			}

			xcode.sims = Object.values(xcode.simRuntimes).map(r => r.version);

			sdkCounter += xcode.sdks.length;
		}

		if (eulaNotAccepted.length) {
			results.issues.push({
				id: 'IOS_XCODE_EULA_NOT_ACCEPTED',
				type: 'warning',
				message: eulaNotAccepted.length === 1
					? 'Xcode EULA has not been accepted.\nLaunch Xcode and accept the license.'
					: `Multiple Xcode versions have not had their EULA accepted:\n${eulaNotAccepted.map(xc => `  ${xc.version} (${xc.xcodeapp})`).join('\n')}\nLaunch each Xcode and accept the license.`
			});
		}

		if (supportedVersions && !validXcodes) {
			results.issues.push({
				id: 'IOS_NO_SUPPORTED_XCODE_FOUND',
				type: 'warning',
				message: 'There are no supported Xcode installations found.'
			});
		}

		if (!sdkCounter) {
			results.issues.push({
				id: 'IOS_NO_IOS_SDKS',
				type: 'error',
				message: 'There are no iOS SDKs found\nLaunch Xcode and download the mobile support packages.'
			});
		}
	} else {
		results.issues.push({
			id: 'IOS_XCODE_NOT_INSTALLED',
			type: 'error',
			message: 'No Xcode installations found.\nYou can download it from the App Store or from https://developer.apple.com/xcode/.'
		});
	}
}
