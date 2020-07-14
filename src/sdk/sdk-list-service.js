import DetectEngine from 'appcd-detect';
import gawk from 'gawk';
import semver from 'semver';

import { compare } from '../lib/version';
import { DataServiceDispatcher } from 'appcd-dispatcher';
import { debounce, get } from 'appcd-util';
import { options, sdk } from 'titaniumlib';

/**
 * Detects installed Titanium SDKs.
 */
export default class SDKListService extends DataServiceDispatcher {
	/**
	 * Starts detecting Titanium SDKs.
	 *
	 * @param {Object} cfg - The Appc Daemon config object.
	 * @returns {Promise}
	 * @access public
	 */
	async activate(cfg) {
		this.data = gawk([]);

		options.sdk.searchPaths = get(cfg, 'titanium.sdk.searchPaths');

		this.detectEngine = new DetectEngine({
			checkDir(dir) {
				try {
					return new sdk.TitaniumSDK(dir);
				} catch (e) {
					// 'dir' is not a Titanium SDK
				}
			},
			depth:    1,
			multiple: true,
			name:     'titanium:sdks',
			paths:    sdk.getPaths(),
			processResults(results) {
				results.sort((a, b) => {
					const av = a.manifest?.version;
					const bv = b.manifest?.version;
					return av && bv ? compare(av, bv) : 0;
				});
			},
			recursive:           true,
			recursiveWatchDepth: 0,
			redetect:            true,
			watch:               true
		});

		this.detectEngine.on('results', results => gawk.set(this.data, results));

		gawk.watch(cfg, [ 'titanium', 'sdk', 'searchPaths' ], debounce(value => {
			options.sdk.searchPaths = value;
			this.detectEngine.paths = sdk.getPaths();
		}));

		await this.detectEngine.start();
	}

	/**
	 * Stops the detect engine.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async deactivate() {
		if (this.detectEngine) {
			await this.detectEngine.stop();
			this.detectEngine = null;
		}
	}

	/**
	 * Finds an SDK by name (or version) or by `latest`.
	 *
	 * @param [name='latest'] - The SDK name or version to search for.
	 * @returns {Object}
	 */
	find(name) {
		let result;
		if (!name || name === 'latest') {
			// get the latest installed
			for (const sdk of this.data) {
				if (!result || (sdk.manifest && result.manifest && semver.gt(sdk.manifest.version, result.manifest.version))) {
					result = sdk;
				}
			}
		} else {
			result = this.data.find(s => s.name === name);
			if (!result) {
				// maybe name is a version?
				result = this.data.find(s => s.manifest?.version === name);
			}
		}
		return result;
	}
}
