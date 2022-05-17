/* eslint-disable promise/no-callback-in-promise */

import path from 'path';
import tunnel from '../tunnel';
import * as version from '../../lib/version';
import { snooplogg } from 'cli-kit';

const { alert } = snooplogg.styles;

export function patch({ load, request, parent, isMain }) {
	let cache;

	const ioslib = load(request, parent, isMain);
	const { SimHandle } = ioslib.simulator;

	ioslib.detect = (opts = {}, callback) => {
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
					simulators:    processSimulators(info.simulators),
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
	};

	/**
	 * Finds a iOS Simulator and/or Watch Simulator as well as the supported Xcode based on the specified options.
	 *
	 * @param {Object} [options] - An object containing various settings.
	 * @param {String} [options.appBeingInstalled] - The path to the iOS app to install after launching the iOS Simulator.
	 * @param {Boolean} [options.bypassCache=false] - When true, re-detects Xcode and all simulators.
	 * @param {Function} [options.logger] - A function to log debug messages to.
	 * @param {String} [options.iosVersion] - The iOS version of the app so that ioslib picks the appropriate Xcode.
	 * @param {String} [options.minIosVersion] - The minimum iOS SDK to detect.
	 * @param {String} [options.minWatchosVersion] - The minimum watchOS SDK to detect.
	 * @param {String|Array<String>} [options.searchPath] - One or more path to scan for Xcode installations.
	 * @param {String|SimHandle} [options.simHandleOrUDID] - A iOS sim handle or the UDID of the iOS Simulator to launch or null if you want ioslib to pick one.
	 * @param {String} [options.simType=iphone] - The type of simulator to launch. Must be either "iphone" or "ipad". Only applicable when udid is not specified.
	 * @param {String} [options.simVersion] - The iOS version to boot. Defaults to the most recent version.
	 * @param {String} [options.supportedVersions] - A string with a version number or range to check if an Xcode install is supported.
	 * @param {Boolean} [options.watchAppBeingInstalled] - The id of the watch app. Required in order to find a watch simulator.
	 * @param {String} [options.watchHandleOrUDID] - A watch sim handle or UDID of the Watch Simulator to launch or null if your app has a watch app and you want ioslib to pick one.
	 * @param {String} [options.watchMinOSVersion] - The min Watch OS version supported by the specified watch app id.
	 * @param {Function} callback(err, simHandle, watchSimHandle, selectedXcode, simInfo, xcodeInfo) - A function to call with the simulators found.
	 */
	ioslib.simulator.findSimulators = (options, callback) => {
		if (typeof options === 'function') {
			callback = options;
			options = {};
		} else if (typeof options !== 'object') {
			options = {};
		}
		if (typeof callback !== 'function') {
			callback = () => {};
		}

		const logger = typeof options.logger === 'function' ? options.logger : () => {};
		logger('Running patched legacy ioslib findSimulators()');

		ioslib.detect(options, (err, results) => {
			if (err) {
				return callback(err);
			}

			const simInfo = { simulators: results.simulators };
			const xcodeInfo = { xcode: results.xcode };

			const compareXcodes = (a, b) => {
				var v1 = xcodeInfo.xcode[a].version;
				var v2 = xcodeInfo.xcode[b].version;
				if (options.iosVersion && version.eq(options.iosVersion, v1)) {
					return -1;
				}
				if (options.iosVersion && version.eq(options.iosVersion, v2)) {
					return 1;
				}
				if (xcodeInfo.xcode[a].selected) {
					return -1;
				}
				if (xcodeInfo.xcode[b].selected) {
					return 1;
				}
				return version.gt(v1, v2) ? -1 : version.eq(v1, v2) ? 0 : 1;
			};

			const compareSims = (a, b) => {
				return a.model < b.model ? -1 : a.model > b.model ? 1 : 0;
			};

			// find an Xcode installation that matches the iOS SDK or fall back to the selected Xcode or the latest
			const xcodeIds = Object
				.keys(xcodeInfo.xcode)
				.filter(id => {
					if (!xcodeInfo.xcode[id].supported) {
						return false;
					}
					if (!options.iosVersion) {
						return true;
					}
					return xcodeInfo.xcode[id].sdks.some(ver => version.eq(ver, options.iosVersion));
				})
				.sort(compareXcodes);

			if (!xcodeIds.length) {
				if (options.iosVersion) {
					return callback(new Error(`Unable to find any Xcode installations that supports iOS SDK ${options.iosVersion}.`));
				} else {
					return callback(new Error('Unable to find any supported Xcode installations. Please install the latest Xcode.'));
				}
			}

			const xcodeId = xcodeIds[0];
			let selectedXcode = xcodeInfo.xcode[xcodeId];
			let simHandle = options.simHandleOrUDID instanceof SimHandle ? options.simHandleOrUDID : null;
			let watchSimHandle = options.watchHandleOrUDID instanceof SimHandle ? options.watchHandleOrUDID : null;
			const findWatchSimHandle = watchUDID => {
				const sim = Object.values(simInfo.simulators.watchos).find(({ udid }) => udid === watchUDID);
				if (sim) {
					logger(`Found Watch Simulator UDID ${watchUDID}`);
					return new SimHandle(sim);
				}
			};

			if (options.simHandleOrUDID) {
				// validate the udid
				if (!(options.simHandleOrUDID instanceof SimHandle)) {
					const vers = Object.keys(simInfo.simulators.ios);

					logger(`Validating iOS Simulator UDID ${options.simHandleOrUDID}`);

					for (let i = 0, l = vers.length; !simHandle && i < l; i++) {
						const sims = simInfo.simulators.ios[vers[i]];
						for (var j = 0, k = sims.length; j < k; j++) {
							if (sims[j].udid === options.simHandleOrUDID) {
								logger(`Found iOS Simulator UDID ${options.simHandleOrUDID}`);
								simHandle = new SimHandle(sims[j]);
								break;
							}
						}
					}

					if (!simHandle) {
						return callback(new Error(`Unable to find an iOS Simulator with the UDID "${options.simHandleOrUDID}".`));
					}
				}

				if (options.minIosVersion && version.lt(simHandle.version, options.minIosVersion)) {
					return callback(new Error(`The selected iOS ${simHandle.version} Simulator is less than the minimum iOS version ${options.minIosVersion}.`));
				}

				if (options.watchAppBeingInstalled) {
					const watchXcodeId = Object
						.keys(simHandle.watchCompanion)
						.filter(xcodeId => xcodeInfo.xcode[xcodeId].supported)
						.sort(compareXcodes)
						.pop();

					if (!watchXcodeId) {
						return callback(new Error(`Unable to find any Watch Simulators that can be paired with the specified iOS Simulator ${simHandle.udid}.`));
					}

					if (!options.watchHandleOrUDID) {
						logger('Watch app present, autoselecting a Watch Simulator');

						const companions = simHandle.watchCompanion[watchXcodeId];
						const companionUDID = Object.keys(companions)
							.sort((a, b) => companions[a].model.localeCompare(companions[b].model))
							.pop();

						watchSimHandle = new SimHandle(companions[companionUDID]);

						if (!watchSimHandle) {
							return callback(new Error(`Specified iOS Simulator "${options.simHandleOrUDID}" does not support Watch apps.`));
						}
					} else if (!(options.watchHandleOrUDID instanceof SimHandle)) {
						logger(`Watch app present, validating Watch Simulator UDID ${options.watchHandleOrUDID}`);
						watchSimHandle = findWatchSimHandle(options.watchHandleOrUDID);
						if (!watchSimHandle) {
							return callback(new Error(`Unable to find a Watch Simulator with the UDID "${options.watchHandleOrUDID}".`));
						}
					}

					// double check
					if (watchSimHandle && !simHandle.watchCompanion[watchXcodeId][watchSimHandle.udid]) {
						return callback(new Error(`Specified Watch Simulator "${watchSimHandle.udid}" is not compatible with iOS Simulator "${simHandle.udid}".`));
					}
				}

				if (options.watchAppBeingInstalled && !options.watchHandleOrUDID && !watchSimHandle) {
					if (options.watchMinOSVersion) {
						return callback(new Error(`Unable to find a Watch Simulator that supports watchOS ${options.watchMinOSVersion}.`));
					}
					return callback(new Error('Unable to find a Watch Simulator.'));
				}

				logger(`Selected iOS Simulator: ${simHandle.name}`);
				logger(`  UDID    = ${simHandle.udid}`);
				logger(`  iOS     = ${simHandle.version}`);
				if (watchSimHandle) {
					if (options.watchAppBeingInstalled && options.watchHandleOrUDID) {
						logger(`Selected watchOS Simulator: ${watchSimHandle.name}`);
					} else {
						logger(`Autoselected watchOS Simulator: ${watchSimHandle.name}`);
					}
					logger(`  UDID    = ${watchSimHandle.udid}`);
					logger(`  watchOS = ${watchSimHandle.version}`);
				}
				logger(`Autoselected Xcode: ${selectedXcode.version}`);
			} else {
				logger('No iOS Simulator UDID specified, searching for best match');

				if (options.watchAppBeingInstalled && options.watchHandleOrUDID) {
					logger(`Validating Watch Simulator UDID ${options.watchHandleOrUDID}`);
					watchSimHandle = findWatchSimHandle(options.watchHandleOrUDID);
					if (!watchSimHandle) {
						return callback(new Error(`Unable to find a Watch Simulator with the UDID "${options.watchHandleOrUDID}".`));
					}
				}

				// pick one
				logger(`Scanning Xcodes: ${xcodeIds.join(' ')}`);

				// loop through xcodes
				for (let i = 0; !simHandle && i < xcodeIds.length; i++) {
					const xc = xcodeInfo.xcode[xcodeIds[i]];
					const simVersMap = {};
					for (const ver of Object.keys(simInfo.simulators.ios)) {
						for (const iosRange of Object.keys(xc.simDevicePairs)) {
							if (version.satisfies(ver, iosRange)) {
								simVersMap[ver] = xc.simDevicePairs[iosRange];
								break;
							}
						}
					}
					const simVers = Object.keys(simVersMap).sort(version.rcompare);

					logger(`Scanning Xcode ${xcodeIds[i]} sims: ${simVers.join(', ')}`);

					// loop through each xcode simulators
					for (let j = 0; !simHandle && j < simVers.length; j++) {
						if (!options.minIosVersion || version.gte(simVers[j], options.minIosVersion)) {
							const sims = simInfo.simulators.ios[simVers[j]];

							sims.sort(compareSims).reverse();

							// loop through each simulator
							for (let k = 0; !simHandle && k < sims.length; k++) {
								if (options.simType && sims[k].family !== options.simType) {
									continue;
								}

								// if we're installing a watch extension, make sure we pick a simulator that supports the watch
								if (options.watchAppBeingInstalled) {
									if (watchSimHandle) {
										for (const xcodeVer of Object.keys(sims[k].supportsWatch)) {
											if (watchSimHandle.supportsXcode[xcodeVer]) {
												selectedXcode = xcodeInfo.xcode[xcodeVer];
												simHandle = new SimHandle(sims[k]);
												break;
											}
										}
									} else if (sims[k].supportsWatch[xcodeIds[i]]) {
										// make sure this version of Xcode has a watch simulator that supports the watch app version
										for (const watchosVer of Object.keys(simInfo.simulators.watchos)) {
											for (const watchosRange of Object.keys(simVersMap[simVers[j]])) { // 4.x, 5.x, etc
												if (version.satisfies(watchosVer, watchosRange) && version.gte(watchosVer, options.watchMinOSVersion)) {
													simHandle = new SimHandle(sims[k]);
													selectedXcode = xcodeInfo.xcode[xcodeIds[i]];
													const watchSim = simInfo.simulators.watchos[watchosVer].sort(compareSims).reverse()[0];
													watchSimHandle = new SimHandle(watchSim);
													break;
												}
											}
											if (watchSimHandle) {
												break;
											}
										}
									}
								} else {
									// no watch app
									logger('No watch app being installed, so picking first Simulator');
									simHandle = new SimHandle(sims[k]);

									// fallback to the newest supported Xcode version
									for (const id of xcodeIds) {
										if (simHandle.supportsXcode[id]) {
											selectedXcode = xcodeInfo.xcode[id];
											break;
										}
									}
								}
							}
						}
					}
				}

				if (!simHandle) {
					// user experience!
					if (options.simVersion) {
						return callback(new Error(`Unable to find an iOS Simulator running iOS ${options.simVersion}`));
					} else {
						return callback(new Error('Unable to find an iOS Simulator.'));
					}
				} else if (options.watchAppBeingInstalled && !watchSimHandle) {
					return callback(new Error(`Unable to find a watchOS Simulator that supports watchOS ${options.watchMinOSVersion}.`));
				}

				logger(`Autoselected iOS Simulator: ${simHandle.name}`);
				logger(`  UDID    = ${simHandle.udid}`);
				logger(`  iOS     = ${simHandle.version}`);
				if (watchSimHandle) {
					if (options.watchAppBeingInstalled && options.watchHandleOrUDID) {
						logger(`Selected watchOS Simulator: ${watchSimHandle.name}`);
					} else {
						logger(`Autoselected watchOS Simulator: ${watchSimHandle.name}`);
					}
					logger(`  UDID    = ${watchSimHandle.udid}`);
					logger(`  watchOS = ${watchSimHandle.version}`);
				}
				logger(`Autoselected Xcode: ${selectedXcode.version}`);
			}

			callback(null, simHandle, watchSimHandle, selectedXcode, simInfo, xcodeInfo);
		});
	};

	return ioslib;
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
			cert.pem = cert.cert;
			delete cert.cert;
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
	results.provisioning = {};
	for (const [ type, profiles ] of Object.entries(info.provisioning)) {
		results.provisioning[type] = profiles.map(p => {
			p.appId        = (p.entitlements['application-identifier'] || '').replace(/^\w+\./, '');
			p.appPrefix    = p.teamId;
			p.certs        = Object.values(p.certs);
			p.getTaskAllow = !!p.entitlements['get-task-allow'];
			p.team         = p.teamIds;
			return p;
		});
	}

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

function processSimulators(simulators) {
	for (const vers of Object.values(simulators)) {
		for (const sims of Object.values(vers)) {
			for (const sim of sims) {
				sim.dataDir = path.join(sim.deviceDir, 'data');
			}
		}
	}
	return simulators;
}
