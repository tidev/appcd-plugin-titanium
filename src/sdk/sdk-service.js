import Dispatcher from 'appcd-dispatcher';
import SDKListService from './sdk-list-service';

import { AppcdError, codes } from 'appcd-response';
import { expandPath } from 'appcd-path';
import { sdk } from 'titaniumlib';

/**
 * Defines a service endpoint for listing, installing, and uninstalling Titanium SDKs.
 */
export default class SDKService extends Dispatcher {
	/**
	 * Registers all of the endpoints and initializes the installed SDKs detect engine.
	 *
	 * @param {Object} cfg - The Appc Daemon config object.
	 * @returns {Promise}
	 * @access public
	 */
	async activate(cfg) {
		this.config = cfg;

		this.installed = new SDKListService();
		await this.installed.activate(cfg);

		this.register('/', (ctx, next) => {
			ctx.path = '/list';
			return next();
		})
			.register('/list',             this.installed)
			.register('/branches',         () => sdk.getBranches())
			.register('/builds/:branch?',  ctx => sdk.getBuilds(ctx.request.params.branch))
			.register('/locations',        () => sdk.getPaths())
			.register('/releases',         () => sdk.getReleases())
			.register('/install/:name?',   ctx => this.install(ctx))
			.register('/uninstall/:name?', ctx => this.uninstall(ctx));
	}

	/**
	 * Shuts down the installed SDKs detect engine.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async deactivate() {
		await this.installed.deactivate();
	}

	/**
	 * Install SDK service handler.
	 * Note: This method does not return a promise because we want the response to be sent
	 * immediately and receive install events as they occur. It relies on the
	 *
	 * @param {Context} ctx - A request context.
	 * @access private
	 */
	install({ request, response }) {
		const { data, params } = request;

		sdk.install({
			downloadDir: this.config.home && expandPath(this.config.home, 'downloads'),
			keep:        data.keep,
			onProgress(evt) {
				if (data.progress) {
					response.write(evt);
				}
			},
			overwrite:   data.overwrite,
			uri:         data.uri || params.name
		}).then(tisdk => {
			response.write({ fin: true, message: `Titanium SDK ${tisdk.name} installed` });
			response.end();
		}).catch(err => {
			try {
				if (err.code === 'ENOTFOUND') {
					response.write(new AppcdError(codes.NOT_FOUND, err.message));
				} else {
					response.write(new AppcdError(err));
				}
				response.end();
			} catch (e) {
				// stream is probably closed
			}
		});
	}

	/**
	 * Deletes an installed Titanium SDK by name or path.
	 *
	 * @param {Context} ctx - A dispatcher context.
	 * @returns {Promise<Object>}
	 * @access private
	 */
	async uninstall(ctx) {
		const { data, params } = ctx.request;
		const uri = (data.uri || params.name || '').trim();

		if (!uri) {
			throw new AppcdError(codes.BAD_REQUEST, 'Missing Titanium SDK name or path');
		}

		try {
			return await sdk.uninstall(uri);
		} catch (err) {
			throw err.code === 'ENOTFOUND' ? new AppcdError(codes.NOT_FOUND, err) : err;
		}
	}
}
