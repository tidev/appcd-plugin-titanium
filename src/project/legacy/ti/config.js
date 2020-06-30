// import fs from 'fs';
// import path from 'path';

// // default config
// export const config = {
// 	app: {
// 		workspace: ''
// 	},

// 	cli: {
// 		colors: true,
// 		completion: false,
// 		logLevel: 'trace',
// 		prompt: true,
// 		progressBars: true,
// 		failOnWrongSDK: false,
// 		httpProxyServer: '',
// 		rejectUnauthorized: true,
// 		width: 100,
// 		ignoreDirs: '^(\\.svn|_svn|\\.git|\\.hg|\\.?[Cc][Vv][Ss]|\\.bzr|\\$RECYCLE\\.BIN)$',
// 		ignoreFiles: '^(\\.gitignore|\\.npmignore|\\.cvsignore|\\.DS_Store|\\._.*|[Tt]humbs.db|\\.vspscc|\\.vssscc|\\.sublime-project|\\.sublime-workspace|\\.project|\\.tmproj)$'
// 	},

// 	// additional search paths for commands and hooks
// 	paths: {
// 		commands: [],
// 		hooks: [],
// 		modules: [],
// 		plugins: [],
// 		sdks: [],
// 		templates: []
// 	},

// 	user: {}
// };

// export default config;

// const configFile = path.join(process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'], '.titanium', 'config.json');
// if (fs.existsSync(configFile)) {
// 	try {
// 		(function mix(src, dest) {
// 			for (let [ key, value ] of Object.entries(src)) {
// 				if (value && typeof value === 'object' && !Array.isArray(value)) {
// 					if (!dest[key] || typeof dest[key] !== 'object') {
// 						dest[key] = {};
// 					}
// 					mix(value, dest[key]);
// 				} else if (typeof value === 'string') {
// 					value = value === undefined ? '' : String(value).trim();
// 					if (value === 'null') {
// 						value = null;
// 					} else if (value === 'true') {
// 						value = true;
// 					} else if (value === 'false') {
// 						value = false;
// 					}
// 					dest[key] = value;
// 				}
// 			}
// 		}(JSON.parse(fs.readFileSync(configFile)), config));
// 	} catch (e) {
// 		console.error(`Failed to parse Titanium CLI config: ${e.message}`);
// 	}
// }

// Object.defineProperties(config, {
// 	get: {
// 		value: function (key, defaultValue) {
// 			if (!key) {
// 				return this;
// 			}

// 			const parts = key.split('.');
// 			const q = parts.pop();
// 			let obj = this;
// 			let i = 0;
// 			let p = parts.length && parts[i++];

// 			if (p) {
// 				do {
// 					if (obj.hasOwnProperty(p)) {
// 						obj = obj[p];
// 					} else {
// 						return defaultValue;
// 					}
// 				} while (obj && (p = parts[i++]));
// 			}

// 			return obj && q && obj.hasOwnProperty(q) ? obj[q] : defaultValue;
// 		}
// 	},
// 	set: {
// 		value: function (key, value) {
// 			const parts = key.split('.');
// 			const q = parts.pop();
// 			let obj = this;
// 			let i = 0;
// 			let p = parts.length && parts[i++];

// 			if (p) {
// 				do {
// 					obj = obj.hasOwnProperty(p) ? obj[p] : (obj[p] = {});
// 				} while (obj && (p = parts[i++]));
// 			}

// 			// if not an array, try to cast to null, true, false, int or leave as string
// 			if (!Array.isArray(value)) {
// 				value = value === undefined ? '' : String(value).trim();
// 				if (value === 'null') {
// 					value = null;
// 				} else if (value === 'true') {
// 					value = true;
// 				} else if (value === 'false') {
// 					value = false;
// 				} else if (String(~~value) === value) {
// 					value = ~~value;
// 				}
// 			}

// 			if (obj && q) {
// 				obj[q] = value;
// 			}
// 		}
// 	}
// });
