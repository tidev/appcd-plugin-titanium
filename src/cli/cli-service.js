import CLI, { Terminal } from 'cli-kit';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs';
import path from 'path';

import { Transform } from 'stream';

class OutputTransformer extends Transform {
	constructor(type) {
		super({ objectMode: true });
		this.type = type;
	}

	_transform(chunk, encoding, callback) {
		callback(null, {
			type: this.type,
			message: chunk
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

		const { version } = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json')));

		this.cli = new CLI({
			banner: `Titanium CLI, version ${version}\nCopyright (c) 2012-2019, Axway, Inc. All Rights Reserved.`,
			commands: `${__dirname}/commands`,
			help: true,
			helpExitCode: 2,
			version
		});

		this.register('/', async ({ headers, request, response }) => {
			const stdout = new OutputTransformer('stdout');
			const stderr = new OutputTransformer('stderr');

			stdout.pipe(response);
			stderr.pipe(response);

			await this.cli.exec(request.data.argv, {
				data: {
					config,
					userAgent: headers && headers['user-agent'] || null,
					version
				},
				terminal: new Terminal({
					stdout,
					stderr
				})
			});

			response.end();
		});

		this.register('/schema', () => this.cli.schema);
	}

	/**
	 * ?
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async deactivate() {
		//
	}
}
