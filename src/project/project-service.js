import Dispatcher from 'appcd-dispatcher';
import TemplateService from './templates-service';

import { Project } from 'titaniumlib';

const { log } = appcd.logger('project-service');

/**
 * Service for creating and building Titanium applications.
 */
export default class ProjectService extends Dispatcher {
	templateSvc = new TemplateService();

	/**
	 * Registers all of the endpoints.
	 *
	 * @param {Object} cfg - The Appc Daemon config object.
	 * @returns {Promise}
	 * @access public
	 */
	async activate(cfg) {
		this.register('/', ctx => {
			log(ctx.request.data);
		});

		this.register('/build', ctx => {
			log(ctx.request.data);
		});

		this.register('/clean', ctx => {
			log(ctx.request.data);
		});

		this.register('/new', async ctx => {
			return await new Project({
				templates: (await this.call('/templates')).response
			}).create(ctx.request.data);
		});

		this.register('/run', ctx => {
			log(ctx.request.data);
		});

		await this.templateSvc.activate(cfg);
		this.register('/templates', this.templateSvc);
	}

	/**
	 * Perform any necessary cleanup.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async deactivate() {
		await this.templateSvc.deactivate();
	}
}
