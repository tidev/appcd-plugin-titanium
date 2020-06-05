// istanbul ignore if
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

// import fs from 'fs-extra';
import gawk from 'gawk';
import CLIService from './cli/cli-service';
import ModuleService from './module/module-service';
import ProjectService from './project/project-service';
import SDKService from './sdk/sdk-service';

import { debounce, get } from 'appcd-util';
import { modules, options, sdk } from 'titaniumlib';

const cliSvc     = new CLIService();
const moduleSvc  = new ModuleService();
const projectSvc = new ProjectService();
const sdkSvc     = new SDKService();

/**
 * Wires up plugin services.
 *
 * @param {Object} cfg - An Appc Daemon config object
 * @returns {Promise}
 */
export async function activate(cfg) {
	// set titaniumlib's network settings
	const { APPCD_NETWORK_CA_FILE, APPCD_NETWORK_PROXY, APPCD_NETWORK_STRICT_SSL } = process.env;
	const { network } = options;
	const applySettings = () => {
		Object.assign(network, cfg.network);
		if (APPCD_NETWORK_CA_FILE) {
			network.caFile = APPCD_NETWORK_CA_FILE;
		}
		if (APPCD_NETWORK_PROXY) {
			network.httpProxy = network.httpsProxy = APPCD_NETWORK_PROXY;
		}
		if (APPCD_NETWORK_STRICT_SSL !== undefined && APPCD_NETWORK_STRICT_SSL !== 'false') {
			network.strictSSL = true;
		}
	};
	applySettings();
	gawk.watch(cfg, [ 'network' ], debounce(applySettings));

	options.searchPaths = get(cfg, 'titanium.searchPaths');

	gawk.watch(cfg, [ 'titanium', 'searchPaths' ], debounce(value => {
		options.searchPaths = value;
		moduleSvc.detectEngine.paths = modules.getPaths();
		sdkSvc.detectEngine.paths = sdk.getPaths();
	}));

	await cliSvc.activate(cfg);
	appcd.register('/cli', cliSvc);

	await moduleSvc.activate(cfg);
	appcd.register([ '/module', '/modules' ], moduleSvc);

	await projectSvc.activate();
	appcd.register('/project', projectSvc);

	await sdkSvc.activate(cfg);
	appcd.register('/sdk', sdkSvc);
}

/**
 * Shuts down plugin services.
 *
 * @returns {Promise}
 */
export async function deactivate() {
	await Promise.all([
		cliSvc.deactivate(),
		moduleSvc.deactivate(),
		projectSvc.deactivate(),
		sdkSvc.deactivate()
	]);
}
