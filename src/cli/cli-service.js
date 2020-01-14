import CLI, { snooplogg, Terminal } from 'cli-kit';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs';
import path from 'path';

import { Transform } from 'stream';
import { parseVersion } from '../lib/util';

const { highlight } = snooplogg.styles;

/**
 * A stream transform that wraps stdout/stderr output in an object.
 */
class OutputTransformer extends Transform {
	/**
	 * Initializes the output transformer in object mode.
	 *
	 * @param {String} type - The output stream name such as "stdout" or "stderr".
	 * @access public
	 */
	constructor(type) {
		super({ objectMode: true });
		this.type = type;
	}

	/**
	 * Wraps a message into an stdio envelope for the Titanium CLI bridge.
	 *
	 * @param {String} message - The message. It is always a string.
	 * @param {String} encoding - The message encoding. This is not used.
	 * @param {Function} callback - A function to call with the transformed message.
	 * @access private
	 */
	_transform(message, encoding, callback) {
		callback(null, {
			type: this.type,
			message
		});
	}
}

/**
 * Defines a service endpoint for defining, processing, and dispatching Titanium CLI commands.
 */
export default class CLIService extends Dispatcher {
	/**
	 * Registers all of the endpoints.
	 *
	 * @param {Object} config - The Appc Daemon config object.
	 * @returns {Promise}
	 * @access public
	 */
	async activate(config) {
		this.config = config;

		const pluginVersion = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json'))).version;

		this.cli = new CLI({
			banner({ data }) {
				return `${highlight('Titanium CLI')}, version ${parseVersion(data.userAgent)} (plugin ${pluginVersion})\nCopyright (c) 2012-2020, Axway, Inc. All Rights Reserved.`;
			},
			commands: `${__dirname}/commands`,
			help: true,
			helpExitCode: 2,
			version({ data }) {
				return parseVersion(data.userAgent);
			}
		});

		this.register('/', ({ headers, request, response }) => {
			const stdout = new OutputTransformer('stdout');
			const stderr = new OutputTransformer('stderr');

			stdout.pipe(response);
			stderr.pipe(response);

			const argv = request.data && request.data.argv || [];
			console.log(`Executing CLI: ${argv}`);

			this.cli.exec(argv, {
				data: {
					config,
					debug: console,
					userAgent: headers && headers['user-agent'] || null,
					pluginVersion
				},
				terminal: new Terminal({
					stdout,
					stderr
				})
			}).catch(err => {
				stderr.write(JSON.stringify({
					exitCode: err.exitCode || 1,
					error: err.toString(),
					stack: err.stack,
					type: 'error'
				}, null, 2));
			}).finally(() => {
				stdout.end();
				stderr.end();
			});
		});

		this.register('/schema', ({ headers }) => this.cli.schema({
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
		//
	}
}
