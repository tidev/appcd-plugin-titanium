import path from 'path';
import tunnel from '../tunnel';
import * as version from '../../lib/version';

import { CLI_VERSION } from './version';
import { INVALID_ARGUMENT } from './error';
import { isFile } from 'appcd-fs';
import { snooplogg } from 'cli-kit';

const { highlight } = snooplogg.styles;

/**
 * Command specific data including the command module and configuration.
 */
export default class Context {
	/**
	 * A legacy Titanium CLI version.
	 * @type {String}
	 */
	cliVersion = CLI_VERSION;

	/**
	 * A reference to the associated platform-specific context. This is only used for the `build`
	 * command.
	 * @type {Context}
	 */
	platform = null;

	/**
	 * Initializes the context and validates that the command JS file exists.
	 *
	 * @param {Object} opts - Various options.
	 * @param {CLI} opts.cli - A reference to the main CLI instance.
	 * @param {Object} [opts.conf] - The command's configuration. This is used when the `build`
	 * command initializes a platform-specific context.
	 * @param {String} opts.name - The command name.
	 * @param {Context} [opts.parent] - A reference to the parent context. This is used to
	 * associate a platform-specific context with the `build` command context.
	 * @param {String} opts.path - The path to the command JS file.
	 * @access public
	 */
	constructor({ cli, conf, name, parent, path }) {
		this.cli    = cli;
		this.conf   = conf || {};
		this.name   = name;
		this.parent = parent;
		this.path   = path;

		if (!isFile(this.path)) {
			throw new Error(`Command file not found: ${path}`);
		}
	}

	/**
	 * Loads a command JS file and if the command is the `build` command, it also initializes the
	 * platform-specific context.
	 *
	 * @param {Boolean} [checkPlatform] - When `true` and this is the `build` command, then
	 * validate the platform argument.
	 * @returns {Promise<Context>}
	 * @access public
	 */
	async load(checkPlatform) {
		tunnel.log(`Loading command file: ${highlight(this.path)}`);
		// eslint-disable-next-line security/detect-non-literal-require
		this.module = require(this.path);

		if (this.module.cliVersion && !version.satisfies(this.cliVersion, this.module.cliVersion)) {
			throw new Error(`Command "${this.name}" is incompatible with this version of the Titanium CLI`);
		}

		if (typeof this.module.run !== 'function') {
			throw new Error(`Command "${this.name}" does not contain a valid run function`);
		}

		this.conf = typeof this.module.config === 'function' ? this.module.config(this.cli.logger, this.cli.config, this.cli) : {};
		if (typeof this.conf === 'function') {
			this.conf = await new Promise(resolve => this.conf(r => resolve(r)));
		}

		if (!checkPlatform || this.name !== 'build') {
			return;
		}

		// the `build` command `--platform` option was hard wired into the CLI context, so
		// unfortunately we need to do a bunch of `build` specific logic to load the platform
		// specific command
		const { platform } = this.cli.argv;
		if (!platform) {
			throw INVALID_ARGUMENT({
				msg: 'Missing required "platform"',
				code: 'EPLATFORM',
				prompt: {
					choices:  this.conf.options.platform.values.map(platform => ({ value: platform })),
					message:  'For which platform do you want to build?',
					name:     'platform',
					required: true,
					type:     'select'
				}
			});
		}

		// `this.conf.platforms` is an object of platform names to platform-specific options
		if (this.conf.platforms && Object.prototype.hasOwnProperty.call(this.conf.platforms, platform)) {
			const platformConf = this.conf.platforms[platform];

			this.platform = new Context({
				conf:   platformConf,
				name:   platform,
				parent: this,
				path:   path.join(this.cli.sdk.path, platform)
			});

			this.platforms = {
				[this.platform.name]: this.platform
			};

			this.cli.argv.platform = this.platform.name; // I think this is to normalize `iphone` to `ios`
			this.cli.argv.$platform = platform;

			// find all platform hooks
			this.cli.scanHooks(path.join(this.cli.sdk.path, this.platform.name, 'cli', 'hooks'));
		}
	}
}
