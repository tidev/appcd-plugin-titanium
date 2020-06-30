// import config from './config';
// import fs from 'fs';
// import logger from './logger';
// import path from 'path';
// import util from 'util';
// import version from '../version';
// import vm from 'vm';

// function GracefulShutdown() {}
// util.inherits(GracefulShutdown, Error);

// export default class CLI {
// 	argv = {
// 		colors: true
// 	};

// 	hooks = {
// 		erroredFilenames: [],
// 		errors: {},
// 		ids: {},
// 		incompatibleFilenames: [],
// 		loadedFilenames: [],
// 		post: {},
// 		pre: {},
// 		scannedPaths: {}
// 	};

// 	startTime = null;

// 	HOOK_PRIORITY_DEFAULT = 1000;

// 	constructor(argv) {
// 		if (!argv.sdkPath) {
// 			throw new Error('Missing Titanium SDK path (sdkPath) paramater');
// 		}
// 		argv.sdkPath = path.resolve(argv.sdkPath);
// 		if (!fs.existsSync(argv.sdkPath)) {
// 			throw new Error(`Specified Titanium SDK does not exist: ${argv.sdkPath}`);
// 		}

// 		Object.assign(this.argv, argv);
// 		this.argv.$_ = [];

// 		this.config = config;
// 		this.GracefulShutdown = GracefulShutdown;
// 		this.logger = logger;
// 		this.sdk = {
// 			name: path.basename(argv.sdkPath),
// 			path: argv.sdkPath
// 		};

// 		const manifest = JSON.parse(fs.readFileSync(path.join(argv.sdkPath, 'manifest.json')));
// 		this.env = {
// 			sdks: {
// 				[manifest.version]: {
// 					manifest
// 				}
// 			}
// 		};

// 		this.scanHooks(path.resolve(argv.sdkPath, 'cli', 'hooks'));
// 	}

// 	addAnalyticsEvent() {
// 		// noop
// 	}

// 	addHook(...args) {
// 		return this.on(...args);
// 	}

// 	createHook(name, ctx, fn) {
// 		let dataPayload = {};

// 		if (typeof ctx === 'function') {
// 			fn = ctx;
// 			ctx = null;
// 		} else if (ctx && typeof ctx === 'object' && !fn) {
// 			dataPayload = ctx;
// 			ctx = null;
// 		}

// 		return (...args) => {
// 			const callback = args.length && typeof args[args.length - 1] === 'function' ? args.pop() : null;
// 			let data = Object.assign(dataPayload, {
// 				type: name,
// 				args,
// 				callback,
// 				fn: fn,
// 				ctx: ctx
// 			});
// 			const pres = this.hooks.pre[name] || [];
// 			const posts = this.hooks.post[name] || [];

// 			Promise.resolve()
// 				.then(async () => {
// 					// call all pre filters
// 					await pres
// 						.reduce((promise, pre) => {
// 							return promise.then(() => new Promise((resolve, reject) => {
// 								if (pre.length >= 2) {
// 									pre.call(ctx, data, (err, newData) => {
// 										if (err) {
// 											return reject(err);
// 										} else if (newData) {
// 											data = newData;
// 										}
// 										resolve();
// 									});
// 								} else {
// 									pre.call(ctx, data);
// 									resolve();
// 								}
// 							}));
// 						}, Promise.resolve());

// 					if (data.fn) {
// 						data.result = await new Promise((resolve, reject) => {
// 							// call the function
// 							data.args.push((err, data) => {
// 								err ? reject(err) : resolve(data);
// 							});
// 							data.fn.apply(data.ctx, data.args);
// 						});
// 					}

// 					// call all post filters
// 					await posts
// 						.reduce((promise, post) => promise.then(() => new Promise((resolve, reject) => {
// 							if (post.length >= 2) {
// 								post.call(ctx, data, (err, newData) => {
// 									if (err) {
// 										return reject(err);
// 									} else if (newData && typeof newData === 'object' && newData.type) {
// 										data = newData;
// 									}
// 									resolve();
// 								});
// 							} else {
// 								post.call(ctx, data);
// 								resolve();
// 							}
// 						})), Promise.resolve());

// 					const { callback } = data;
// 					if (typeof callback === 'function') {
// 						data.callback = null;
// 						if (callback.length > 1) {
// 							callback.call(data, null, data.result);
// 						} else {
// 							// this is because the original hook system was bad and didn't handle
// 							// errors correctly :(
// 							callback.call(data, data.result);
// 						}
// 					}
// 				})
// 				.catch(err => {
// 					// this is the primary error handler
// 					if (typeof data.callback === 'function') {
// 						data.callback(err);
// 					} else {
// 						console.log('Hook completion callback threw unhandled error:');
// 						console.log(err.stack);
// 						process.exit(1);
// 					}
// 				});
// 		};
// 	}

// 	emit(hookNames, data, callback) {
// 		if (typeof data === 'function') {
// 			callback = data;
// 			data = null;
// 		}

// 		// make sure hookNames is an array
// 		if (!Array.isArray(hookNames)) {
// 			hookNames = [ hookNames ];
// 		}

// 		// create each hook and immediately fire them
// 		const promise = hookNames
// 			.reduce((promise, name) => promise.then(() => new Promise((resolve, reject) => {
// 				const hook = this.createHook(name, data);
// 				console.error(`Emitting ${name}`);
// 				hook((err, result) => {
// 					err ? reject(err) : resolve(result);
// 				});
// 			})), Promise.resolve());

// 		if (typeof callback !== 'function') {
// 			return promise;
// 		}

// 		promise
// 			.then(result => callback(null, result))
// 			.catch(callback);

// 		return this;
// 	}

// 	fireHook(...args) {
// 		return this.emit(...args);
// 	}

// 	on(name, callback) {
// 		let priority = this.HOOK_PRIORITY_DEFAULT;
// 		let i;

// 		if (typeof callback === 'function') {
// 			callback = { post: callback };
// 		} else if (callback && typeof callback === 'object') {
// 			priority = parseInt(callback.priority) || priority;
// 		}

// 		if (callback.pre) {
// 			const h = this.hooks.pre[name] || (this.hooks.pre[name] = []);
// 			callback.pre.priority = priority;
// 			for (i = 0; i < h.length && priority >= h[i].priority; i++) {}
// 			h.splice(i, 0, callback.pre);
// 		}

// 		if (callback.post) {
// 			const h = this.hooks.post[name] || (this.hooks.post[name] = []);
// 			callback.post.priority = priority;
// 			for (i = 0; i < h.length && priority >= h[i].priority; i++) {}
// 			h.splice(i, 0, callback.post);
// 		}

// 		return this;
// 	}

// 	scanHooks(dir) {
// 		if (this.hooks.scannedPaths[dir]) {
// 			return;
// 		}

// 		try {
// 			// eslint-disable-next-line security/detect-non-literal-require
// 			const appc = require(path.join(this.argv.sdkPath, 'node_modules', 'node-appc'));
// 			const jsfile = /\.js$/;
// 			const ignore = /^[._]/;
// 			const files = fs.statSync(dir).isDirectory() ? fs.readdirSync(dir).map(n => path.join(dir, n)) : [ dir ];

// 			for (const file of files) {
// 				try {
// 					if (fs.statSync(file).isFile() && jsfile.test(file) && !ignore.test(path.basename(path.dirname(file)))) {
// 						// test the file for syntax errors
// 						vm.runInThisContext(`(function (exports, require, module, __filename, __dirname){${fs.readFileSync(file).toString()}\n});`, file, 0, false);

// 						// eslint-disable-next-line security/detect-non-literal-require
// 						var mod = require(file);
// 						if (mod.id) {
// 							if (!Array.isArray(this.hooks.ids[mod.id])) {
// 								this.hooks.ids[mod.id] = [];
// 							}
// 							this.hooks.ids[mod.id].push({
// 								file: file,
// 								version: mod.version || null
// 							});

// 							// don't load duplicate ids
// 							if (this.hooks.ids[mod.id].length > 1) {
// 								continue;
// 							}
// 						}

// 						if (!this.version || !mod.cliVersion || version.satisfies(this.version, mod.cliVersion)) {
// 							mod.init && mod.init(this.logger, this.config, this, appc);
// 							this.hooks.loadedFilenames.push(file);
// 							console.error(`Loaded CLI hook: ${file}`);
// 						} else {
// 							this.hooks.incompatibleFilenames.push(file);
// 						}
// 					}
// 				} catch (ex) {
// 					this.hooks.erroredFilenames.push(file);
// 					this.hooks.errors[file] = ex;
// 				}
// 			}
// 		} catch (e) {
// 			// squelch
// 		}
// 	}

// 	async go(command) {
// 		// load the command
// 		// try {
// 		// 	this.command = require(path.resolve(__dirname, '..', 'commands', `${argv.command}.js`));
// 		// } catch (e) {
// 		// 	throw new Error(`Invalid command "${argv.command}"`);
// 		// }

// 		// await cmd(cli, msg);
// 		// await this.validate();
// 		//
// 		// await this.executeCommand();
// 	}

// 	async validate({ options }) {
// 		const { argv } = this;
// 		const orderedOptionNames = Object.keys(options).sort((a, b) => {
// 			if (options[a].order && options[b].order) {
// 				return options[a].order - options[b].order;
// 			}
// 			return options[a].order ? -1 : options[b].order ? 1 : 0;
// 		});

// 		for (const [ name, option ] of Object.entries(options)) {
// 			if (argv[name] === undefined && option.default !== undefined) {
// 				argv[name] = option.default;
// 			}
// 		}

// 		const issues = [];

// 		for (let name of orderedOptionNames) {
// 			const opt = options[name];
// 			opt.name = name;

// 			if (opt.validated) {
// 				continue;
// 			}

// 			if (argv[name] === undefined) {
// 				// check if the option is required
// 				if (opt.required || (opt.conf && opt.conf.required)) {
// 					// ok, we have a required option, but it's possible that this option
// 					// replaces some legacy option in which case we need to check if the
// 					// legacy options were defined

// 					if (typeof opt.verifyIfRequired === 'function') {
// 						await new Promise(resolve => opt.verifyIfRequired(stillRequired => {
// 							if (stillRequired) {
// 								issues.push({ opt });
// 							}
// 							resolve();
// 						}));
// 						continue;
// 					}

// 					issues.push({ opt });
// 				}

// 			} else if (Array.isArray(opt.values) && !opt.skipValueCheck && opt.values.indexOf(argv[name]) === -1) {
// 				issues.push({ opt });

// 			} else if (!opt.validated && typeof opt.validate === 'function') {
// 				try {
// 					await new Promise(resolve => opt.validate(argv[name], (err, value) => {
// 						if (err) {
// 							opt._err = err;
// 							issues.push({
// 								opt,
// 								err,
// 								value: argv[name]
// 							});
// 						} else {
// 							argv[name] = value;
// 							opt.validated = true;
// 							if (opt.callback) {
// 								const val = opt.callback(argv[name] || '');
// 								if (val !== undefined) {
// 									argv[name] = val;
// 								}
// 								delete opt.callback;
// 							}
// 						}
// 						resolve();
// 					}));
// 				} catch (ex) {
// 					if (ex instanceof GracefulShutdown) {
// 						// simply return and cb() is never called which effectively cause the cli
// 						// to gracefully exit
// 						continue;
// 					}
// 					throw ex;
// 				}

// 			} else if (opt.callback) {
// 				opt.validated = true;
// 				const val = opt.callback(argv[name] || '');
// 				if (val !== undefined) {
// 					argv[name] = val;
// 				}
// 				delete opt.callback;
// 			}
// 		}

// 		if (issues.length) {
// 			// we are going to throw an error, but we first need to build up the info for each missing
// 			// or invalid parameter
// 			const err = new Error('Bad request');
// 			err.status = 400;
// 			err.issues = await Promise.all(issues.map(async ({ opt, err, value }) => {
// 				const issue = {
// 					name: opt.name
// 				};

// 				if (err) {
// 					issue.error = err;
// 				}

// 				if (value) {
// 					issue.value = value;
// 				}

// 				if (typeof opt.prompt === 'function') {
// 					const field = await new Promise(opt.prompt);
// 					issue.field = {
// 						type: field.constructor.name.toLowerCase(),
// 						message: field.promptLabel
// 					};
// 				} else if (Array.isArray(opt.values)) {
// 					issue.field = {
// 						type: 'select',
// 						message: `Please select a ${opt.name}`,
// 						options: opt.values
// 						// suggest
// 						// complete
// 						// numbered
// 					};
// 				} else {
// 					issue.field = {
// 						type: opt.password ? 'password' : 'text',
// 						message: `Please enter a valid ${opt.name}`
// 					};
// 				}

// 				return issue;
// 			}));
// 			throw err;
// 		}

// 		// detect missing arguments

// 		// callCommandValidate

// 		// callOptionCallbacks
// 	}

// 	async executeCommand() {
// 		//
// 	}
// }
