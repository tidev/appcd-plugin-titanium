/* eslint-disable promise/no-callback-in-promise */

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

/**
 * The legacy Titanium CLI version. Since this legacy shim is intended to simulate the Titanium CLI
 * v5, we keep the major as `5`, but set the minor to something high that will never exist.
 */
const CLI_VERSION = '5.999.0';

/**
 * A helper function that creates an error and defines an optional code and prompt metadata.
 *
 * @param {Object} opts - Various options.
 * @param {String} [opts.code] - A custom error code. This value should begin with an `E`.
 * @param {String} opts.message - The error message.
 * @param {Object} [opts.option] - A CLI option to autogenerate the prompt metadata from.
 * @param {Object} [opts.prompt] - Prompt metadata.
 * @returns {Error}
 */
function INVALID_ARGUMENT({ code, msg, option, prompt }) {
	const err = new TypeError(msg);
	if (code !== undefined) {
		err.code = code;
	}
	if (option?.values) {
		err.prompt = {
			choices:  option.values.map(value => ({ value })),
			message:  `Please select a valid ${option.name} value`,
			name:     option.name,
			required: true,
			type:     'select'
		};
	} else if (option) {
		err.prompt = {
			message:  `Please enter a valid ${option.name}`,
			name:     option.name,
			required: true,
			type:     'text'
		};
	} else if (prompt !== undefined) {
		err.prompt = prompt;
	}
	return err;
}

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
	 * @param {Object} [opts.conf] - The command's configuration. This is used when the `build`
	 * command initializes a platform-specific context.
	 * @param {String} opts.name - The command name.
	 * @param {Context} [opts.parent] - A reference to the parent context. This is used to
	 * associate a platform-specific context with the `build` command context.
	 * @param {String} opts.path - The path to the command JS file.
	 * @access public
	 */
	constructor({ conf, name, parent, path }) {
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
	 * @param {CLI} cli - A reference to the main CLI instance.
	 * @returns {Promise}
	 * @access public
	 */
	async load(cli) {
		tunnel.log(`Loading command file: ${highlight(this.path)}`);
		// eslint-disable-next-line security/detect-non-literal-require
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
	 * The legacy Titanium CLI version.
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
	 * The legacy Titanium CLI logger object. The original supports log levels, this one does not.
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

	/**
	 * An alias for `on()`.
	 *
	 * @param {*} ...args - An event name and callback.
	 * @returns {CLI}
	 * @deprecated
	 * @access public
	 */
	addHook(...args) {
		return this.on(...args);
	}

	/**
	 * Defines a hook function that will emit an event before and after the hooked function is
	 * invoked.
	 *
	 * @param {String} name - The name of hook event.
	 * @param {Object} [ctx] - The `this` context to bind the callbacks to.
	 * @param {Function} [fn] - The function being hooked.
	 * @returns {Function}
	 * @access public
	 */
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
						// eslint-disable-next-line promise/no-nesting
						.reduce((promise, pre) => promise.then(() => new Promise((resolve, reject) => {
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
						})), Promise.resolve());

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
						// eslint-disable-next-line promise/no-nesting
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

	/**
	 * Emits an event along with a data payload.
	 *
	 * @param {String|Array.<String>} name - One or more events to emit.
	 * @param {Object} [data] - An optional data payload.
	 * @param {Function} [callback] A function to call once the emitting has finished. If no
	 * callback is specified, this function will return a promise instead.
	 * @returns {CLI|Promise}
	 * @access public
	 */
	emit(name, data, callback) {
		if (typeof data === 'function') {
			callback = data;
			data = null;
		}

		// create each hook and immediately fire them
		const promise = unique(name)
			.reduce((promise, name) => promise.then(() => new Promise((resolve, reject) => {
				const hook = this.createHook(name, data);
				tunnel.log(`Emitting ${name}`);
				hook((err, result) => {
					err ? reject(err) : resolve(result);
				});
			})), Promise.resolve(this));

		if (typeof callback !== 'function') {
			return promise;
		}

		promise
			.then(result => callback(null, result))
			.catch(callback);

		return this;
	}

	/**
	 * Executes the command's `run()` method.
	 *
	 * @returns {Promise}
	 * @access private
	 */
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

	/**
	 * An alias for `emit()`.
	 *
	 * @param {*} ...args - The hook names, data, and callback.
	 * @returns {CLI}
	 * @deprecated
	 * @access public
	 */
	fireHook(...args) {
		return this.emit(...args);
	}

	/**
	 * The main pipeline for running the CLI.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async go() {
		await this.emit('cli:go', { cli: this });
		await this.command.load(this);
		await this.emit('cli:command-loaded', { cli: this, command: this.command });
		await this.validate();
		await this.executeCommand();
	}

	/**
	 * Creates a legacy Titanium CLI config object from the Titanium plugin config.
	 *
	 * @param {Object} config - The Titanium plugin config.
	 * @returns {Object}
	 * @access private
	 */
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

	/**
	 * Registers an event callback.
	 *
	 * @param {String} name - The name of the event.
	 * @param {Function} callback - The listener to register.
	 * @returns {CLI}
	 * @access public
	 */
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
			// eslint-disable-next-line no-empty
			for (i = 0; i < h.length && priority >= h[i].priority; i++) {}
			h.splice(i, 0, callback.pre);
		}

		if (callback.post) {
			const h = this.hooks.post[name] || (this.hooks.post[name] = []);
			callback.post.priority = priority;
			// eslint-disable-next-line no-empty
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

	/**
	 * Validates the arguments. First it checks against the built-in naive validation such as
	 * required or against a list of values. Next it calls each option's validator. After that it
	 * calls the command's validator. Lastly it calls each option's value callback.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async validate() {
		await this.emit('cli:pre-validate', { cli: this, command: this.command });

		// step 0: build a list of all options so we can sort them
		const options = [];
		for (const ctx of [ this.command, this.command?.platform ]) {
			if (ctx?.conf.options) {
				for (const [ name, opt ] of Object.entries(ctx.conf.options)) {
					options.push({
						// this is a sacrificial wrapper that we can throw away after firing and it
						// handles the boilerplate of checking the callback and result
						callback(value) {
							let result;
							if (typeof opt.callback === 'function') {
								// technically `opt.callback()` can throw a `GracefulShutdown` error
								// for both `build` and `clean` commands during the `project-dir`
								// callback if the `<sdk-version>` in the tiapp.xml is not the same
								// version loaded by the Titanium SDK, but luckily that will never :)
								result = opt.callback(value || '');
							}
							delete this.callback;
							return result !== undefined ? result : value;
						},
						name,
						order:            opt.order,
						required:         opt.required,
						validate:         opt.validate,
						values:           !opt.skipValueCheck && Array.isArray(opt.values) ? opt.values : null,
						verifyIfRequired: opt.verifyIfRequired
					});
				}
			}
		}

		options.sort((a, b) => ~~b.order - ~~a.order);

		// step 1: determine invalid or missing options
		for (const opt of options) {
			const { name } = opt;
			const value = this.argv[name];

			if (value !== undefined && opt.values && !opt.values.includes(value)) {
				throw INVALID_ARGUMENT({
					msg: `Invalid ${name} value "${value}"`,
					option: opt
				});
			}

			if (value !== undefined) {
				if (typeof opt.validate === 'function') {
					await new Promise((resolve, reject) => {
						opt.validate(value, (err, value) => {
							if (err) {
								return reject(INVALID_ARGUMENT({
									msg: `Invalid ${name} value "${value}"`,
									option: opt
								}));
							}

							this.argv[name] = opt.callback(value);
							resolve();
						});
					});
				} else {
					this.argv[name] = opt.callback(value);
				}

			// we need to check if the option is required
			// sometimes required options such as `--device-id` allow an undefined value in the
			// case when the value is derived by the config or is autoselected
			} else if (opt.required && (typeof opt.verifyIfRequired !== 'function' || await new Promise(opt.verifyIfRequired))) {
				throw INVALID_ARGUMENT({
					msg: `Missing required option: ${name}`,
					option: opt
				});
			}
		}

		// note that we don't care about missing arguments because `build` and `clean` commands
		// don't have any arguments!

		// step 2: run the command's validate() function, if exists

		const { validate } = this.command.module;
		if (validate && typeof validate === 'function') {
			const fn = validate(this.logger, this.config, this);

			// fn should always be a function for `build` and `clean` commands
			if (typeof fn === 'function') {
				await new Promise(resolve => fn(resolve));
			}
		}

		await this.emit('cli:post-validate', { cli: this, command: this.command });

		// step 3: fire all option callbacks for any options we missed above
		for (const opt of options) {
			if (typeof opt.callback === 'function') {
				const val = opt.callback(this.argv[opt.name] || '');
				if (val !== undefined) {
					this.argv[opt.name] = val;
				}
			}
		}
	}
}
