import DetectEngine from 'appcd-detect';
import gawk from 'gawk';
import sortObject from 'sort-object-keys';

import { compare } from '../lib/version';
import { DataServiceDispatcher } from 'appcd-dispatcher';
import { debounce, get } from 'appcd-util';
import { modules, options } from 'titaniumlib';

/**
 * Defines a service endpoint for listing Titanium modules.
 */
export default class ModuleListService extends DataServiceDispatcher {
	/**
	 * Starts detecting Titanium SDKs and modules.
	 *
	 * @param {Object} cfg - An Appc Daemon config object.
	 * @returns {Promise}
	 * @access public
	 */
	async activate(cfg) {
		this.data = gawk({
			android:  {},
			commonjs: {},
			ios:      {},
			windows:  {}
		});

		options.module.searchPaths = get(cfg, 'titanium.module.searchPaths');

		this.detectEngine = new DetectEngine({
			checkDir(dir) {
				try {
					return new modules.TitaniumModule(dir);
				} catch (e) {
					// 'dir' is not a Titanium module
				}
			},
			depth:               4, // modules -> platform -> module_name -> version
			multiple:            true,
			name:                'titanium-sdk:modules',
			paths:               modules.getPaths(),
			recursive:           true,
			recursiveWatchDepth: 3, // platform -> module_name -> version
			redetect:            true,
			watch:               true
		});

		this.detectEngine.on('results', results => {
			let modules = {
				android:  {},
				commonjs: {},
				ios:      {},
				windows:  {}
			};

			// convert the list of modules into buckets by platform and version
			for (const module of results) {
				if (!modules[module.platform]) {
					modules[module.platform] = {};
				}
				if (!modules[module.platform][module.moduleid]) {
					modules[module.platform][module.moduleid] = {};
				}
				modules[module.platform][module.moduleid][module.version] = module;
			}

			// sort the platforms and versions
			modules = sortObject(modules);
			for (const platform of Object.keys(modules)) {
				modules[platform] = sortObject(modules[platform]);
				for (const id of Object.keys(modules[platform])) {
					modules[platform][id] = sortObject(modules[platform][id], compare);
				}
			}

			gawk.set(this.data, modules);
		});

		gawk.watch(cfg, [ 'titanium', 'module', 'searchPaths' ], debounce(value => {
			options.module.searchPaths = value;
			this.detectEngine.paths = modules.getPaths();
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
}
