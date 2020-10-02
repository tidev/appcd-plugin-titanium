/* eslint-disable promise/no-callback-in-promise, security/detect-non-literal-require */

import Context from './context';
import fs from 'fs-extra';
import getOSInfo from '../../lib/os';
import Module from 'module';
import path from 'path';
import tunnel from '../tunnel';
import * as version from '../../lib/version';
import * as request from '@axway/amplify-request';
import { CLI_VERSION } from './version';
import { expandPath } from 'appcd-path';
import { format } from 'util';
import { debounce, get, mergeDeep, set, unique } from 'appcd-util';
import { sdk } from 'titaniumlib';
import { snooplogg } from 'cli-kit';

const { gray, green, highlight, magenta, note, red, yellow } = snooplogg.styles;

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
		debug: (msg = '', ...args) => console.log(`${magenta('[DEBUG]')} ${format(msg, ...args)}`),
		error: (msg = '', ...args) => console.error(red(`[ERROR] ${format(msg, ...args)}`)),
		info:  (msg = '', ...args) => console.info(`${green('[INFO]')}  ${format(msg, ...args)}`),
		log:   (msg = '', ...args) => console.log(format(msg, ...args)),
		trace: (msg = '', ...args) => console.log(`${gray('[TRACE]')} ${format(msg, ...args)}`),
		warn:  (msg = '', ...args) => console.warn(yellow(`[WARN]  ${format(msg, ...args)}`)),

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
	 * @param {Object} [opts.network] - Network configuration settings including `caFile`,
	 * `certFile`, `keyFile`, `proxy`, and `strictSSL`.
	 * @param {Boolean} [opts.promptingEnabled] - When `true`, invalid and missing values will be
	 * prompted for.
	 * @param {String} opts.sdkPath - The path to the Titanium SDK.
	 * @access public
	 */
	constructor(opts) {
		if (!opts || typeof opts !== 'object') {
			throw new TypeError('Expected options to be an object');
		}

		this.config           = this.initConfig(opts.config);
		this.fingerprint      = opts.fingerprint;
		this.promptingEnabled = !!opts.promptingEnabled;
		this.sdk              = new sdk.TitaniumSDK(opts.sdkPath);

		this.got = request.init({ defaults: opts.network });

		// initialize the CLI argument values
		this.argv = {
			$command: opts.command,
		};
		if (opts.argv) {
			for (const [ key, value ] of Object.entries(opts.argv)) {
				this.argv[key] = this.argv[key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)] = value;
			}
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
					npm:    'n/a' // unimportant
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

		// patch modules
		const load = Module._load;
		const patchDir = path.resolve(__dirname, '..', 'patch');
		const lookup = {
			fields:                          path.join(patchDir, 'fields.js'),
			ioslib:                          path.join(patchDir, 'ios.js'),
			'node-titanium-sdk/lib/android': path.join(patchDir, 'android.js')
		};
		Module._load = (request, parent, isMain) => {
			if (lookup[request] && parent && path.basename(parent.filename) === '_build.js') {
				return require(lookup[request]).patch({ load, request, parent, isMain });
			}
			return load(request, parent, isMain);
		};

		// initialize the commands
		const cmd = opts.command;
		if (cmd !== 'build' && cmd !== 'clean') {
			throw new Error(`Invalid command "${cmd}"`);
		}
		this.command = this.cmds[cmd] = new Context({
			cli: this,
			name: cmd,
			path: path.join(this.sdk.path, 'cli', 'commands', `${cmd}.js`)
		});

		// initialize the hooks
		unique(this.config.paths.hooks).forEach(this.scanHooks.bind(this));
		this.scanHooks(path.resolve(__dirname, '..', 'hooks'));
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
		tunnel.telemetry({ event: type === 'ti.apiusage' ? type : event, ...data });
	}

	/**
	 * An alias for `on()`.
	 *
	 * @param {*} ...args - An event name and callback.
	 * @returns {CLI}
	 * @access public
	 */
	addHook(...args) {
		return this.on(...args);
	}

	/**
	 * Prompt for a question.
	 *
	 * @param {Object} question - The question parameters.
	 * @returns {Promise}
	 * @access public
	 */
	async ask(question) {
		// copy the question and remove the error message
		question = { required: true, ...question };
		delete question.error;

		if (this.promptingEnabled) {
			return await tunnel.ask(question);
		}

		const err = new Error(question.error);
		err.prompt = question;
		throw err;
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
			let data = Object.assign({}, dataPayload, {
				type: name,
				args,
				fn: fn,
				ctx: ctx
			});
			const callback = data.args.pop();
			const pres = this.hooks.pre[name] || [];
			const posts = this.hooks.post[name] || [];

			(async () => {
				// call all pre filters
				await pres
					// eslint-disable-next-line promise/no-nesting
					.reduce((promise, pre) => promise.then(async () => {
						if (pre.length >= 2) {
							await new Promise((resolve, reject) => {
								pre.call(ctx, data, (err, newData) => {
									if (err) {
										return reject(err);
									} else if (newData) {
										data = newData;
									}
									resolve();
								});
							});
						} else {
							await pre.call(ctx, data);
						}
					}), Promise.resolve());

				if (data.fn) {
					data.result = await new Promise(resolve => {
						// call the function
						data.args.push((...args) => resolve(args));
						data.fn.apply(data.ctx, data.args);
					});
				}

				// call all post filters
				await posts
					// eslint-disable-next-line promise/no-nesting
					.reduce((promise, post) => promise.then(async () => {
						if (post.length >= 2) {
							await new Promise((resolve, reject) => {
								post.call(ctx, data, (err, newData) => {
									if (err) {
										return reject(err);
									}
									if (newData && typeof newData === 'object' && newData.type) {
										data = newData;
									}
									resolve();
								});
							});
						} else {
							await post.call(ctx, data);
						}
					}), Promise.resolve());

				if (typeof callback === 'function') {
					callback.apply(data, data.result);
				}
			})().catch(err => {
				// this is the primary error handler
				if (typeof callback === 'function') {
					tunnel.log(err.stack);
					callback(err);
				} else {
					this.logger.error('Hook completion callback threw unhandled error:');
					this.logger.error(err.stack);
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
		const promise = unique(Array.isArray(name) ? name : [ name ])
			.reduce((promise, name) => promise.then(() => new Promise((resolve, reject) => {
				const hook = this.createHook(name, data);
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
			this.logger.trace(`Executing ${highlight(this.command.name)}`);

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

			// if there's no callback in the run signature (e.g. the "clean" command), then we wait
			// 100ms after the last bit of output activity through the IPC tunnel
			if (run.length < 4) {
				this.logger.debug(`Command "${this.command.name}" does NOT have a finished callback!`);
				const fn = debounce(resolve, 100);
				fn(); // start the bounce
				tunnel.on('tick', fn);
			}
		});
	}

	/**
	 * An alias for `emit()`.
	 *
	 * @param {*} ...args - The hook names, data, and callback.
	 * @returns {CLI}
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
		await this.command.load(true);
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
					value(key, defaultValue) {
						return get(this, key, defaultValue);
					}
				},

				// called by Android build to set the `android.sdkPath`
				set: {
					value(key, value) {
						set(this, key, value);
					}
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
		this.logger.trace(`Scanning hooks: ${highlight(dir)}`);

		if (this.hooks.scannedPaths[dir]) {
			return;
		}

		try {
			const jsfile = /\.js$/;
			const ignore = /^[._]/;
			const files = fs.statSync(dir).isDirectory() ? fs.readdirSync(dir).map(n => path.join(dir, n)) : [ dir ];
			let appc;

			for (const file of files) {
				try {
					if (fs.statSync(file).isFile() && jsfile.test(file) && !ignore.test(path.basename(path.dirname(file)))) {
						const startTime = Date.now();
						const mod = require(file);
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
							if (!appc) {
								appc = require(path.join(this.sdk.path, 'node_modules', 'node-appc'));
							}
							mod.init && mod.init(this.logger, this.config, this, appc);
							this.hooks.loadedFilenames.push(file);
							this.logger.trace(`Loaded CLI hook: ${highlight(file)} ${note(`(${Date.now() - startTime} ms)`)}`);
						} else {
							this.hooks.incompatibleFilenames.push(file);
						}
					}
				} catch (ex) {
					this.logger.trace(`Error loading hook: ${highlight(file)}`);
					this.logger.trace(ex.stack);
					this.hooks.erroredFilenames.push(file);
					this.hooks.errors[file] = ex;
				}
			}
		} catch (err) {
			if (err.code !== 'ENOENT') {
				this.logger.trace(`Error scanning hooks: ${highlight(dir)}`);
				this.logger.trace(err.stack);
			}
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

		// step 1: build a list of all options so we can sort them
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
						orig: opt,
						values: !opt.skipValueCheck && Array.isArray(opt.values) ? opt.values : null
					});
				}
			}
		}

		options.sort((a, b) => {
			if (a.orig.order && b.orig.order) {
				return a.orig.order - b.orig.order;
			}
			return a.orig.order ? -1 : b.orig.order ? 1 : 0;
		});

		const createQuestion = async (opt, error) => {
			if (opt.values) {
				return {
					choices: opt.values.map(value => ({ value })),
					error,
					message: `Please select a valid ${opt.name}`,
					name:    opt.name,
					type:    'select'
				};
			}

			if (typeof opt.orig?.prompt === 'function') {
				return await new Promise(opt.orig.prompt);
			}

			return {
				error,
				message: `Please enter a valid ${opt.name}`,
				name:    opt.name,
				type:    'text'
			};
		};

		// step 2: determine invalid or missing options
		for (const opt of options) {
			const { name, orig, values } = opt;
			const value = this.argv[name];

			if (value === undefined) {
				// we need to check if the option is required
				// sometimes required options such as `--device-id` allow an undefined value in the
				// case when the value is derived by the config or is autoselected
				if (orig.required && (typeof orig.verifyIfRequired !== 'function' || await new Promise(orig.verifyIfRequired))) {
					const question = await createQuestion(opt, `Missing required option "${name}"`);
					this.argv[name] = question.type === 'select' && question.choices.length === 1 ? question.choices[0].value : (await this.ask(question));
				}
			} else if (values && !values.includes(value)) {
				const question = await createQuestion(opt, `Invalid ${name} value "${value}"`);
				this.argv[name] = question.type === 'select' && question.choices.length === 1 ? question.choices[0].value : (await this.ask(question));
			} else if (typeof orig.validate === 'function') {
				this.argv[name] = await new Promise((resolve, reject) => {
					orig.validate(value, async (err, adjustedValue) => {
						if (err) {
							this.logger.trace(`Validation failed for option ${name}: ${err.toString()}`);
							try {
								const question = await createQuestion(opt, `Invalid ${name} value "${value}"`);
								adjustedValue = question.type === 'select' && question.choices.length === 1 ? question.choices[0].value : (await this.ask(question));
							} catch (e) {
								return reject(e);
							}
						}
						resolve(opt.callback(adjustedValue));
					});
				});
			} else {
				this.argv[name] = opt.callback(value);
			}
		}

		// note that we don't care about missing arguments because `build` and `clean` commands
		// don't have any arguments!

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

		// step 4: fire all option callbacks for any options we missed above
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
