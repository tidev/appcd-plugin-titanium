import CLIService from './cli/cli-service';
import ModuleService from './module/module-service';
import ProjectService from './project/project-service';
import SDKService from './sdk/sdk-service';
import { debounce } from 'appcd-util';
import { modules, options, sdk } from 'titaniumlib';

const cliSvc     = new CLIService();
const moduleSvc  = new ModuleService();
const projectSvc = new ProjectService();
const sdkSvc     = new SDKService();

/**
 * Wires up plugin services.
 *
 * @returns {Promise}
 */
export async function activate() {
	// set titaniumlib's network settings
	Object.assign(options.network, appcd.config.get('network'));
	appcd.config.watch('network', debounce(network => Object.assign(options.network, network)));

	options.searchPaths = appcd.config.get('titanium.searchPaths');
	appcd.config.watch('titanium.searchPaths', debounce(value => {
		options.searchPaths = value;
		moduleSvc.detectEngine.paths = modules.getPaths();
		sdkSvc.detectEngine.paths = sdk.getPaths();
	}));

	await cliSvc.activate();
	appcd.register('/cli', cliSvc);

	await moduleSvc.activate();
	appcd.register([ '/module', '/modules' ], moduleSvc);

	await projectSvc.activate();
	appcd.register('/project', projectSvc);

	await sdkSvc.activate();
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
