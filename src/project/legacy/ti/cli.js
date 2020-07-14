import fs from 'fs-extra';
import getOSInfo from '../../../lib/os';
import path from 'path';
import tunnel from '../tunnel';
import vm from 'vm';
import * as version from '../../../lib/version';

import { expandPath } from 'appcd-path';
import { format } from 'util';
import { get, mergeDeep, set, unique } from 'appcd-util';
import { isFile } from 'appcd-fs';
import { sdk } from 'titaniumlib';
import { snooplogg } from 'cli-kit';

const { highlight, gray, green, magenta, red, yellow } = snooplogg.styles;

const CLI_VERSION = '5.999.0';

/**
 * The Titanium CLI v5 requires the `--sdk <version>` to equal the `<sdk-version>` in the
 * tiapp.xml. If they don't match, node-titanium-sdk's `ti.validateCorrectSDK()` will spawn a new
 * Titanium CLI process with the correct `--sdk`. Due to the design of the Titanium CLI, this
 * `GracefullyShutdown` error was thrown as an easy way to stop validating and skip executing the
 * command.
 *
 * Since this Titanium CLI shim will ALWAYS match the `<sdk-version>` in the tiapp.xml, this really
 * isn't used, but just in case, we'll define it and set it on the `CLI` instance.
 */
class GracefulShutdown extends Error {}

/**
 * Command specific data including the command module and configuration.
 */
class Context {
	cliVersion = CLI_VERSION;

	platform = null;

	constructor({ conf, name, parent, path }) {
		this.conf   = conf || {};
		this.name   = name;
		this.parent = parent;
		this.path   = path;

		if (!isFile(this.path)) {
			throw new Error(`Command file not found: ${path}`);
		}
	}

	async load(cli) {
		tunnel.log(`Loading command file: ${highlight(this.path)}`);
		this.module = require(this.path);

		if (this.module.cliVersion && !version.satisfies(this.cliVersion, this.module.cliVersion)) {
			throw new Error(`Command "${this.name}" is incompatible with this version of the Titanium CLI`);
		}

		if (typeof this.module.run !== 'function') {
			throw new Error(`Command "${this.name}" does not contain a valid run function`);
		}

		this.conf = typeof this.module.config === 'function' ? this.module.config(cli.logger, cli.config, cli) : {};
		if (typeof this.conf === 'function') {
			this.conf = await new Promise(resolve => this.conf(resolve));
		}

		if (this.name !== 'build') {
			return;
		}

		// the `build` command `--platform` option was hard wired into the CLI context, so
		// unfortunately we need to do a bunch of `build` specific logic to load the platform
		// specific command
		const { platform } = cli.argv;
		if (!platform) {
			const err = new TypeError('Missing required "platform"');
			err.code = 'EPLATFORM';
			err.prompt = {
				choices: this.conf.options.platform.values.map(platform => ({ value: platform })),
				message: 'For which platform do you want to build?',
				name: 'platform',
				required: true,
				type: 'select'
			};
			throw err;
		}

		// `this.conf.platforms` is an object of platform names to platform-specific options
		if (this.conf.platforms && Object.prototype.hasOwnProperty.call(this.conf.platforms, platform)) {
			const platformConf = this.conf.platforms[platform];

			this.platform = new Context({
				conf:   platformConf,
				name:   platform,
				parent: this,
				path:   path.join(cli.sdk.path, platform)
			});

			this.platforms = {
				[this.platform.name]: this.platform
			};

			cli.argv.platform = this.platform.name; // I think this is to normalize `iphone` to `ios`
			cli.argv.$platform = platform;

			// find all platform hooks
			cli.scanHooks(path.join(cli.sdk.path, this.platform.name, 'cli', 'hooks'));
		}
	}
}

/**
 * Controls the state and flow for running legacy Titanium SDK CLI commands such as `build` and
 * `clean`.
 */
export default class CLI {
	/**
	 * The hook priority used to sort hook callbacks.
	 * @type {Number}
	 */
	static HOOK_PRIORITY_DEFAULT = 1000;

	/**
	 * The Titanium CLI version. Since this legacy shim is intended to simulate the Titanium CLI
	 * v5, we keep the major as `5`, but set the minor to something high that will never exist.
	 * @type {String}
	 */
	version = CLI_VERSION;

	/**
	 * A map of command names to command descriptors.
	 * @type {Object}
	 */
	cmds = {};

	/**
	 * Export of the graceful shutdown error.
	 * @type {Function}
	 */
	GracefulShutdown = GracefulShutdown;

	/**
	 * The hook system state.
	 * @type {Object}
	 */
	hooks = {
		erroredFilenames: [],
		errors: {},
		ids: {},
		incompatibleFilenames: [],
		loadedFilenames: [],
		post: {},
		pre: {},
		scannedPaths: {}
	};

	/**
	 * The logger object.
	 * @type {Object}
	 */
	logger = {
		debug: (msg, ...args) => console.log(`${magenta('[DEBUG]')} ${format(msg, ...args)}`),
		error: (msg, ...args) => console.error(red(`[ERROR] ${format(msg, ...args)}`)),
		info:  (msg, ...args) => console.info(`${green('[INFO] ')} ${format(msg, ...args)}`),
		log:   console.log,
		trace: (msg, ...args) => console.log(`${gray('[TRACE]')} ${format(msg, ...args)}`),
		warn:  (msg, ...args) => console.warn(yellow(`[WARN]  ${format(msg, ...args)}`)),

		levels: {
			trace: {},
			debug: {},
			info: {},
			warn: {},
			error: {}
		},

		banner() {
			// noop
		},

		getLevels() {
			return Object.keys(this.levels);
		},

		setLevel() {
			// noop
		}
	};

	/**
	 * The time that executing the command starts. This value is set after validation and prompting
	 * has occurred.
	 * @type {Number}
	 */
	startTime = null;

	/**
	 * Initializes the CLI state by validating the Titanium SDK, initializing the config, and
	 * detecting plugins.
	 *
	 * @param {Object} opts - Various options.
	 * @param {Object} opts.argv - The command arguments.
	 * @param {String} opts.command - The name of the command to execute.
	 * @param {Object} [opts.config] - User-defined Titanium CLI config settings from appcd's user
	 * config.
	 * @param {String} opts.sdkPath - The path to the Titanium SDK.
	 * @access public
	 */
	constructor(opts) {
		if (!opts || typeof opts !== 'object') {
			throw new TypeError('Expected options to be an object');
		}

		this.config = this.initConfig(opts.config);

		// validate the sdk path
		this.sdk = new sdk.TitaniumSDK(opts.sdkPath);

		// initialize the CLI argument values
		this.argv = {
			$command: opts.command,
		};
		for (const [ key, value ] of Object.entries(opts.argv)) {
			this.argv[key] = this.argv[key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)] = value;
		}

		// initialize the legacy environment info
		const installPath = path.resolve(this.sdk.path, '..', '..', '..');
		this.env = {
			// used by the Titanium SDK commands to display the system info in the output before
			// the command is executed
			getOSInfo: cb => {
				const info = getOSInfo();
				cb({
					os:     info.name,
					osver:  info.version,
					ostype: info.arch,
					oscpu:  info.numcpus,
					memory: info.memory,
					node:   process.versions.node,
					npm:    '?' // unimportant
				});
			},

			// used by node-titanium-sdk's `loadPlugins()` to scan the global Titanium SDK install
			// path for Titanium CLI plugins that are explicitly enabled in the app's `tiapp.xml`,
			// which is probably not used anymore
			installPath,

			os: {
				sdkPaths: [ installPath ]
			},

			sdks: {
				[this.sdk.manifest.version]: this.sdk
			}
		};

		// initialize the commands
		const cmd = opts.command;
		if (cmd !== 'build' && cmd !== 'clean') {
			throw new Error(`Invalid command "${cmd}"`);
		}
		this.command = this.cmds[cmd] = new Context({
			name: cmd,
			path: path.join(this.sdk.path, 'cli', 'commands', `${cmd}.js`)
		});

		// initialize the hooks
		unique(this.config.paths.hooks).forEach(this.scanHooks.bind(this));
		this.scanHooks(path.join(this.sdk.path, 'cli', 'hooks'));
	}

	/**
	 * Logs a telemetry event.
	 *
	 * @param {String} event - The name of the event.
	 * @param {Object} data - An object containing any data associated with the event.
	 * @param {String} type - The event type, however this is only ever passed in for the
	 * `ti.apiusage` event, which coincidentally has had the incorrect event name since 2014.
	 * @access public
	 */
	addAnalyticsEvent(event, data, type) {
		tunnel.call('/telemetry', { event: type === 'ti.apiusage' ? type : event, ...data });
	}

	addHook(...args) {
		return this.on(...args);
	}

	createHook(name, ctx, fn) {
		let dataPayload = {};

		if (typeof ctx === 'function') {
			fn = ctx;
			ctx = null;
		} else if (ctx && typeof ctx === 'object' && !fn) {
			dataPayload = ctx;
			ctx = null;
		}

		return (...args) => {
			const callback = args.length && typeof args[args.length - 1] === 'function' ? args.pop() : null;
			let data = Object.assign(dataPayload, {
				type: name,
				args,
				callback,
				fn: fn,
				ctx: ctx
			});
			const pres = this.hooks.pre[name] || [];
			const posts = this.hooks.post[name] || [];

			Promise.resolve()
				.then(async () => {
					// call all pre filters
					await pres
						.reduce((promise, pre) => {
							return promise.then(() => new Promise((resolve, reject) => {
								if (pre.length >= 2) {
									pre.call(ctx, data, (err, newData) => {
										if (err) {
											return reject(err);
										} else if (newData) {
											data = newData;
										}
										resolve();
									});
								} else {
									pre.call(ctx, data);
									resolve();
								}
							}));
						}, Promise.resolve());

					if (data.fn) {
						data.result = await new Promise((resolve, reject) => {
							// call the function
							data.args.push((err, data) => {
								err ? reject(err) : resolve(data);
							});
							data.fn.apply(data.ctx, data.args);
						});
					}

					// call all post filters
					await posts
						.reduce((promise, post) => promise.then(() => new Promise((resolve, reject) => {
							if (post.length >= 2) {
								post.call(ctx, data, (err, newData) => {
									if (err) {
										return reject(err);
									} else if (newData && typeof newData === 'object' && newData.type) {
										data = newData;
									}
									resolve();
								});
							} else {
								post.call(ctx, data);
								resolve();
							}
						})), Promise.resolve());

					const { callback } = data;
					if (typeof callback === 'function') {
						data.callback = null;
						if (callback.length > 1) {
							callback.call(data, null, data.result);
						} else {
							// this is because the original hook system was bad and didn't handle
							// errors correctly :(
							callback.call(data, data.result);
						}
					}
				})
				.catch(err => {
					// this is the primary error handler
					if (typeof data.callback === 'function') {
						data.callback(err);
					} else {
						console.log('Hook completion callback threw unhandled error:');
						console.log(err.stack);
						process.exit(1);
					}
				});
		};
	}

	emit(hookNames, data, callback) {
		if (typeof data === 'function') {
			callback = data;
			data = null;
		}

		// make sure hookNames is an array
		hookNames = unique(hookNames);

		// create each hook and immediately fire them
		const promise = hookNames
			.reduce((promise, name) => promise.then(() => new Promise((resolve, reject) => {
				const hook = this.createHook(name, data);
				tunnel.log(`Emitting ${name}`);
				hook((err, result) => {
					err ? reject(err) : resolve(result);
				});
			})), Promise.resolve());

		if (typeof callback !== 'function') {
			return promise;
		}

		promise
			.then(result => callback(null, result))
			.catch(callback);

		return this;
	}

	async executeCommand() {
		await this.emit('cli:pre-execute', { cli: this, command: this.command });

		this.startTime = Date.now();

		const { run } = this.command.module;
		let done = 0;

		await new Promise((resolve, reject) => {
			tunnel.log(`Executing ${this.command.name} run`);

			run(this.logger, this.config, this, async (err, result) => {
				if (done++) {
					// guard against callback being fired more than once
					return;
				}

				// we need to wrap the post-execute emit in a try/catch so that any exceptions
				// it throws aren't confused with command errors
				try {
					await this.emit('cli:post-execute', { cli: this, command: this.command, err, result });
				} catch (ex) {
					return reject(ex);
				}

				if (err) {
					return reject(err);
				}

				resolve();
			});

			// if there's no callback in the run signature, then unblock the function and let
			// Node.js wait for run() to finish any async tasks
			if (run.length < 4) {
				resolve();
			}
		});
	}

	fireHook(...args) {
		return this.emit(...args);
	}

	async go() {
		await this.emit('cli:go', { cli: this });
		await this.command.load(this);
		await this.emit('cli:command-loaded', { cli: this, command: this.command });
		await this.validate();
		await this.executeCommand();
	}

	initConfig(config) {
		return Object.defineProperties(
			mergeDeep({
				app: {
					workspace: ''
				},

				cli: {
					colors: true,
					completion: false,
					logLevel: 'trace',
					prompt: true,
					progressBars: true,
					failOnWrongSDK: false,
					httpProxyServer: '',
					rejectUnauthorized: true,
					width: 100,
					ignoreDirs: '^(\\.svn|_svn|\\.git|\\.hg|\\.?[Cc][Vv][Ss]|\\.bzr|\\$RECYCLE\\.BIN)$',
					ignoreFiles: '^(\\.gitignore|\\.npmignore|\\.cvsignore|\\.DS_Store|\\._.*|[Tt]humbs.db|\\.vspscc|\\.vssscc|\\.sublime-project|\\.sublime-workspace|\\.project|\\.tmproj)$'
				},

				// additional search paths for commands and hooks
				paths: {
					commands: [],
					hooks: [],
					modules: [],
					plugins: [],
					sdks: [],
					templates: []
				},

				user: {
					locale: 'en_US'
				}
			}, config),
			{
				get: {
					value: (key, defaultValue) => get(this, key, defaultValue)
				},

				// called by Android build to set the `android.sdkPath`
				set: {
					value: (key, value) => set(this, key, value)
				}
			}
		);
	}

	on(name, callback) {
		let priority = CLI.HOOK_PRIORITY_DEFAULT;
		let i;

		if (typeof callback === 'function') {
			callback = { post: callback };
		} else if (callback && typeof callback === 'object') {
			priority = parseInt(callback.priority) || priority;
		}

		if (callback.pre) {
			const h = this.hooks.pre[name] || (this.hooks.pre[name] = []);
			callback.pre.priority = priority;
			for (i = 0; i < h.length && priority >= h[i].priority; i++) {}
			h.splice(i, 0, callback.pre);
		}

		if (callback.post) {
			const h = this.hooks.post[name] || (this.hooks.post[name] = []);
			callback.post.priority = priority;
			for (i = 0; i < h.length && priority >= h[i].priority; i++) {}
			h.splice(i, 0, callback.post);
		}

		return this;
	}

	/**
	 * Searches the specified directory for Titanium CLI plugin files.
	 *
	 * @param {String} dir - The directory to scan.
	 * @access public
	 */
	scanHooks(dir) {
		dir = expandPath(dir);

		if (this.hooks.scannedPaths[dir]) {
			return;
		}

		try {
			// eslint-disable-next-line security/detect-non-literal-require
			const appc = require(path.join(this.argv.sdkPath, 'node_modules', 'node-appc'));
			const jsfile = /\.js$/;
			const ignore = /^[._]/;
			const files = fs.statSync(dir).isDirectory() ? fs.readdirSync(dir).map(n => path.join(dir, n)) : [ dir ];

			for (const file of files) {
				try {
					if (fs.statSync(file).isFile() && jsfile.test(file) && !ignore.test(path.basename(path.dirname(file)))) {
						// test the file for syntax errors
						vm.runInThisContext(`(function (exports, require, module, __filename, __dirname){${fs.readFileSync(file).toString()}\n});`, file, 0, false);

						// eslint-disable-next-line security/detect-non-literal-require
						var mod = require(file);
						if (mod.id) {
							if (!Array.isArray(this.hooks.ids[mod.id])) {
								this.hooks.ids[mod.id] = [];
							}
							this.hooks.ids[mod.id].push({
								file: file,
								version: mod.version || null
							});

							// don't load duplicate ids
							if (this.hooks.ids[mod.id].length > 1) {
								continue;
							}
						}

						if (!this.version || !mod.cliVersion || version.satisfies(this.version, mod.cliVersion)) {
							mod.init && mod.init(this.logger, this.config, this, appc);
							this.hooks.loadedFilenames.push(file);
							console.error(`Loaded CLI hook: ${file}`);
						} else {
							this.hooks.incompatibleFilenames.push(file);
						}
					}
				} catch (ex) {
					this.hooks.erroredFilenames.push(file);
					this.hooks.errors[file] = ex;
				}
			}
		} catch (e) {
			// squelch
		}
	}

	async validate() {
		await this.emit('cli:pre-validate', { cli: this, command: this.command });

		// step 1: determine invalid or missing options

		// step 2: determine all missing arguments

		// step 3: run the command's validate() function, if exists

		const { validate } = this.command.module;
		if (validate && typeof validate === 'function') {
			const fn = validate(this.logger, this.config, this);

			// fn should always be a function for `build` and `clean` commands
			if (typeof fn === 'function') {
				await new Promise(resolve => fn(resolve));
			}
		}

		await this.emit('cli:post-validate', { cli: this, command: this.command });

		// step 4: fire all option callbacks
		for (const ctx of [ this.command, this.command?.platform ]) {
			if (ctx) {
				for (const [ name, opt ] of Object.entries(ctx.conf.options)) {
					if (typeof opt.callback === 'function') {
						const val = opt.callback(this.argv[name] || '');
						if (val !== undefined) {
							this.argv[name] = val;
						}
					}
				}
			}
		}
	}
}
