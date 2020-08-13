import CLI from 'cli-kit';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs';
import getPort from 'get-port';
import path from 'path';

import { get } from 'appcd-util';
import { isFile } from 'appcd-fs';
import { capitalize, parseVersion } from '../lib/util';
import { spawnLegacyCLI } from '../legacy';
// import { Tiapp } from 'titaniumlib';

const { log } = appcd.logger('cli-service');
const { highlight } = appcd.logger.styles;

/**
 * A cache of platform specific build options by Titanium SDK path.
 * @type {Object}
 */
const buildOptionsCache = {};

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

		// we need to add platform specific options for the build/run help, so first we listen for
		// the help command, then we add in the options before the help is generated
		cli.on('exec', async ({ cmd, data, contexts }) => {
			// inject the titanium config into the command data object
			data.config = cfg.titanium;

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
				// FIX ME!
				// const tiapp = new Tiapp({ file: tiappFile });
				// const sdk = tiapp.get('sdk-version');
				const sdk = '9.0.3.GA';
				const sdkInfo = (await appcd.call('/sdk/find', { data: { name: sdk } })).response;

				let buildOptions = buildOptionsCache[sdkInfo.path];

				if (!Array.isArray(buildOptions)) {
					// load the Android and iOS options directly from the SDK
					const config = await spawnLegacyCLI({
						data: {
							command: 'build',
							sdkPath: sdkInfo.path,
							type:    'help'
						}
					});

					// copy the platform-specific options into a cli-kit friendly format
					buildOptions = [];

					const lv = {};
					const lvRegExp = /^liveview/;

					for (const key of Object.keys(config)) {
						if (key === 'flags' || key === 'options') {
							// we skip the top level build flags/options because they are either
							// already defined in the command or are unsupported
						} else if (key === 'platforms') {
							for (const conf of Object.values(config[key])) {
								const options = {};

								for (const [ name, flag ] of Object.entries(conf.flags)) {
									if (!flag.hidden) {
										(lvRegExp.test(name) ? lv : options)[`--${name}`] = { desc: capitalize(flag.desc) };
									}
								}

								for (const [ name, option ] of Object.entries(conf.options)) {
									if (!option.hidden) {
										let format = option.abbr ? `-${option.abbr}, ` : '';
										format += `--${name} ${option.required ? '<' : '['}${option.hint || 'value'}${option.required ? '>' : ']'}`;
										(lvRegExp.test(name) ? lv : options)[format] = { desc: capitalize(option.desc) };
									}
								}

								if (Object.keys(options).length) {
									buildOptions.push(`${conf.title} build options`, options);
								}
							}
						} else if (Array.isArray(config[key])) {
							buildOptions.push.apply(buildOptions, config[key]);
						}
					}

					if (Object.keys(lv).length) {
						buildOptions.push('LiveView Options', lv);
					}

					buildOptionsCache[sdkInfo.path] = buildOptions;
				}

				if (buildOptions.length) {
					ctx.option(buildOptions);
				}
			});
		});

		// find an available port to listen on
		const port = await getPort({
			port: get(cfg, 'port', 1733)
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
