import Dispatcher from 'appcd-dispatcher';
import path from 'path';
import TemplateService from './templates-service';

import { AppcdError, codes } from 'appcd-response';
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
		const handler = action => {
			return async ctx => {
				// get project dir
				let { cwd, projectDir } = ctx.request.data;

				if (projectDir !== undefined && typeof projectDir !== 'string') {
					throw new AppcdError(codes.BAD_REQUEST, 'Missing project directory');
				}

				if (projectDir === undefined || !path.isAbsolute(projectDir)) {
					if (!cwd || typeof cwd !== 'string') {
						throw new AppcdError(codes.BAD_REQUEST, 'Current working directory required when project directory is relative');
					}
					projectDir = path.resolve(cwd, projectDir || '.');
				}

				return await new Project({
					path: projectDir
				})[action](ctx.request.data);
			};
		};

		this.register('/', handler('tiapp'));

		this.register('/build', handler('build'));

		this.register('/clean', handler('clean'));

		this.register('/new', async ctx => {
			return await new Project({
				templates: (await this.call('/templates')).response
			}).create(ctx.request.data);
		});

		// TODO: in the future, run will call project.build and we'll "run" it ourselves
		this.register('/run', handler('run'));

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
