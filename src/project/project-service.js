import Dispatcher from 'appcd-dispatcher';
import TemplateService from './templates-service';
import { Console } from 'console';
import { exec } from '../legacy';
import { Project } from 'titaniumlib';

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
		this.config = cfg;

		const runLegacyCLI = async (command, ctx) => {
			const { cwd } = ctx.request.data;
			const argv = { ...ctx.request.data };
			delete argv.cwd;
			await exec({
				argv,
				command,
				config:  cfg.titanium,
				console: new Console(ctx.response, ctx.response),
				cwd
			});
			ctx.response.end();
		};

		this.register('/', ctx => {
			return 'tiapp coming soon!';
		});

		this.register('/build', ctx => runLegacyCLI('build', ctx));

		this.register('/clean', ctx => runLegacyCLI('clean', ctx));

		this.register('/new', async ctx => {
			try {
				return await new Project({
					templates: (await this.call('/templates')).response
				}).create(ctx.request.data);
			} catch (err) {
				if (err.prompt) {
					err.telemetry = false;
				}
				throw err;
			}
		});

		// TODO: in the future, run will call project.build and we'll "run" it ourselves
		this.register('/run', ctx => runLegacyCLI('run', ctx));

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
