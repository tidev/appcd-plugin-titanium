import Dispatcher, { DispatcherError } from 'appcd-dispatcher';
import ModuleListService from './module-list-service';

import { AppcdError } from 'appcd-response';
import { expandPath } from 'appcd-path';
import { get, unique } from 'appcd-util';
import { modules } from 'titaniumlib';

const { log } = appcd.logger('module-service');
const { highlight } = appcd.logger.styles;

/**
 * Defines a service endpoint for listing Titanium modules.
 */
export default class ModuleService extends Dispatcher {
	/**
	 * Registers all of the endpoints and initializes the installed modules detect engine.
	 *
	 * @param {Object} cfg - The Appc Daemon config object.
	 * @returns {Promise}
	 * @access public
	 */
	async activate(cfg) {
		this.config = cfg;

		this.installed = new ModuleListService();
		await this.installed.activate(cfg);

		this.register('/', (ctx, next) => {
			ctx.path = '/list';
			return next();
		})
			.register('/check-downloads', ctx => this.checkDownloads(ctx.request.data.accountName))
			.register('/install/:name?',  ctx => this.install(ctx))
			.register('/list',            this.installed)
			.register('/locations',       () => modules.getPaths());

		const check = async () => {
			try {
				const { response: accounts } = await appcd.call('/amplify/1.x/auth');
				const account = accounts.find(a => a.active) || accounts[0];
				await this.checkDownloads(account?.name);
				log('Successfully checked downloads, checking again in 1 hour');
			} catch (err) {
				if (err.code === 'EAUTH') {
					log('Not authenticated, checking downloads again in 1 hour');
				} else {
					log(`Failed to check downloads: ${err.message}`);
					log('Trying again in 1 hour');
				}
			}
		};
		this.checkTimer = setInterval(check, 1000 * 60 * 60); // check every hour
		check();
	}

	/**
	 * Checks platform for available Titanium native modules and installs them if they aren't
	 * already installed.
	 *
	 * @param {String} accountName - The name of the account to use to verify downloads.
	 * @returns {Promise<Array<TitaniuModule>>}
	 * @access private
	 */
	async checkDownloads(accountName) {
		if (!accountName || typeof accountName !== 'string') {
			const err = new TypeError('Expected account name');
			err.code = 'EAUTH';
			throw err;
		}

		const { response: downloads } = await appcd.call('/amplify/1.x/ti/downloads', {
			data: {
				accountName
			}
		});
		const installed = this.installed.data;
		const result = [];

		for (const { id, versions } of downloads.modules) {
			for (const { platforms = [], url, version } of versions) {
				for (let platform of platforms) {
					if (platform === 'iphone') {
						platform = 'ios';
					}
					if (platform !== 'android' && (process.platform === 'darwin' || platform !== 'ios')) {
						continue;
					}
					if (installed[platform]?.[id]?.[version]) {
						log(`${highlight(`${id}@${version}`)} (${platform}) already installed`);
					} else {
						log(`Installing ${highlight(`${id}@${version}`)} (${platform})...`);
						result.push.apply(result, await modules.install({
							downloadDir: this.config.titanium.home && expandPath(this.config.titanium.home, 'downloads'),
							uri: url
						}));
						break;
					}
				}
			}
		}

		return result;
	}

	/**
	 * Shuts down the installed SDKs detect engine and stop checking for downloads.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async deactivate() {
		await this.installed.deactivate();

		if (this.checkTimer) {
			clearInterval(this.checkTimer);
			this.checkTimer = null;
		}
	}

	/**
	 * Returns a list of Titanium module installation locations.
	 *
	 * @returns {Array.<String>}
	 * @access private
	 */
	getInstallPaths() {
		const paths = modules.locations[process.platform].map(p => expandPath(p));
		const defaultPath = get(this.config, 'titanium.modules.defaultInstallLocation');
		if (defaultPath) {
			paths.unshift(expandPath(defaultPath));
		}
		return unique(paths);
	}

	/**
	 * Install module service handler.
	 *
	 * Note: This method does not return a promise because we want the response to be sent
	 * immediately and receive install events as they occur. It relies on the response stream to
	 * close.
	 *
	 * @param {Context} ctx - A request context.
	 * @access private
	 */
	install({ request, response }) {
		const { data } = request;

		modules.install({
			downloadDir: this.config.titanium.home && expandPath(this.config.titanium.home, 'downloads'),
			keep:        data.keep,
			onProgress(evt) {
				if (data.progress) {
					response.write(evt);
				}
			},
			overwrite:   data.overwrite,
			uri:         data.uri
		}).then(modules => {
			response.write({ fin: true, message: 'Titanium Module installed', modules });
			response.end();
		}).catch(err => {
			try {
				if (err.code === 'ENOTFOUND') {
					response.write(new DispatcherError(err.message));
				} else {
					response.write(new AppcdError(err));
				}
				response.end();
			} catch (e) {
				// stream is probably closed
			}
		});
	}
}
