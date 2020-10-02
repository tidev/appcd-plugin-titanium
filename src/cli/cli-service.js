import CLI from 'cli-kit';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs';
import getPort from 'get-port';
import path from 'path';

import { isFile } from 'appcd-fs';
import { loadOptions } from './run-legacy';
import { parseVersion } from '../lib/util';
// import { Tiapp } from 'titaniumlib';

const { log } = appcd.logger('cli-service');
const { highlight } = appcd.logger.styles;

/**
 * Defines a service endpoint for defining, processing, and dispatching Titanium CLI commands.
 */
export default class CLIService extends Dispatcher {
	/**
	 * Registers all of the endpoints.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async activate() {
		const pluginVersion = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json'))).version;

		const cli = new CLI({
			banner({ data }) {
				return `${highlight('Titanium CLI')}, version ${parseVersion(data.userAgent)} (plugin ${pluginVersion})\nCopyright (c) 2012-2020, Axway, Inc. All Rights Reserved.`;
			},
			commands: `${__dirname}/commands`,
			help: true,
			helpExitCode: 2,
			name: 'titanium',
			options: {
				'--no-prompt': 'Disable interactive prompting'
			},
			styles: {
				subheading(s) {
					return `\n${String(s).toUpperCase()}`;
				}
			},
			version: ({ data }) => parseVersion(data.userAgent)
		});

		// inject the titanium config into the command data object before parsing starts so that
		// it's available to the command callback
		cli.on('parse', ({ data }) => {
			data.config = appcd.config.get('titanium');
			data.pluginVersion = pluginVersion;
		});

		// we need to add platform specific options for the build/run help, so first we listen for
		// the help command, then we add in the options before the help is generated
		cli.on('exec', async ({ cmd, contexts, data }) => {
			// we need the help command, the build/run command, and a cwd containing a tiapp
			cmd = data?.cwd && cmd?.name === 'help' && contexts[1];

			if (!cmd || (cmd.name !== 'build' && cmd.name !== 'run')) {
				return;
			}

			const tiappFile = path.resolve(data.cwd, 'tiapp.xml');
			if (!isFile(tiappFile)) {
				return;
			}

			cmd.on('generateHelp', async ctx => {
				const sdk = '9.0.3.GA'; // data.tiapp.get('sdk-version');
				await loadOptions({ config: data.config, ctx, sdk });
			});
		});

		// find an available port to listen on
		const port = await getPort({
			port: appcd.config.get('port', 1733)
		});

		// start the cli-kit server
		this.server = await cli.listen({ port });

		// register the discovery endpoint for the cli-kit server
		this.register('/', () => {
			log(`Returning CLI server URL: ${highlight(`ws://127.0.0.1:${port}`)}`);
			return {
				url: `ws://127.0.0.1:${port}`
			};
		});

		this.register('/schema', ({ headers }) => cli.schema({
			data: {
				userAgent: headers && headers['user-agent'] || null
			}
		}));
	}

	/**
	 * Stop the CLI server.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async deactivate() {
		await new Promise(resolve => this.server.close(resolve));
	}
}
