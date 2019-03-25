import Dispatcher from 'appcd-dispatcher';
import Response, { AppcdError, codes } from 'appcd-response';
import SDKListService from './sdk-list-service';

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
	 *
	 * @param {Context} ctx - A request context.
	 * @returns {Promise}
	 * @access private
	 */
	async install(ctx) {
		const { data, params } = ctx.request;

		await sdk.install({
			downloadDir: this.config.home && expandPath(this.config.home, 'downloads'),
			keep:        data.keep,
			overwrite:   data.overwrite,
			uri:         data.uri || params.name
		});

		ctx.response = new Response(codes.OK, 'Installed successfully');
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
		const uri              = (data.uri || params.name || '').trim();

		if (!uri) {
			throw new AppcdError(codes.BAD_REQUEST, 'Missing Titanium SDK name or path');
		}

		try {
			return await sdk.uninstall({ uri });
		} catch (e) {
			if (e.code === 'ENOTFOUND') {
				throw new AppcdError(codes.NOT_FOUND, e);
			} else {
				throw e;
			}
		}
	}
}
