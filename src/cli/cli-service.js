import CLI, { snooplogg } from 'cli-kit';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs';
import getPort from 'get-port';
import path from 'path';

import { get } from 'appcd-util';
import { parseVersion } from '../lib/util';

const { highlight } = snooplogg.styles;

/**
 * Defines a service endpoint for defining, processing, and dispatching Titanium CLI commands.
 */
export default class CLIService extends Dispatcher {
	/**
	 * Registers all of the endpoints.
	 *
	 * @param {Object} cfg - The Appc Daemon config object.
	 * @returns {Promise}
	 * @access public
	 */
	async activate(cfg) {
		const pluginVersion = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json'))).version;

		const cli = new CLI({
			banner({ data }) {
				return `${highlight('Titanium CLI')}, version ${parseVersion(data.userAgent)} (plugin ${pluginVersion})\nCopyright (c) 2012-2020, Axway, Inc. All Rights Reserved.`;
			},
			commands: `${__dirname}/commands`,
			help: true,
			helpExitCode: 2,
			name: 'titanium',
			version: ({ data }) => parseVersion(data.userAgent)
		});

		const port = await getPort({
			port: get(cfg, 'port', 1733)
		});

		this.server = await cli.listen({ port });

		this.register('/', () => ({
			url: `ws://127.0.0.1:${port}`
		}));

		this.register('/schema', ({ headers }) => cli.schema({
			data: {
				userAgent: headers && headers['user-agent'] || null
			}
		}));
	}

	/**
	 * Perform any necessary cleanup.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async deactivate() {
		await new Promise(resolve => this.server.close(resolve));
	}
}
