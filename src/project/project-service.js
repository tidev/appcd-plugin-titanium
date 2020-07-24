import Dispatcher from 'appcd-dispatcher';
import path from 'path';
import TemplateService from './templates-service';

import { AppcdError, codes } from 'appcd-response';
import { Project } from 'titaniumlib';
import { spawnLegacyCLI } from '../legacy/spawn';
import { validate as validateAppPreview } from '../lib/app-preview';

const { alert } = appcd.logger.styles;

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

		this.register('/', ctx => {
			return 'tiapp coming soon!';
		});

		this.register('/build', ctx => this.exec('build', ctx));

		this.register('/clean', ctx => this.exec('clean', ctx));

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
		this.register('/run', ctx => this.exec('run', ctx));

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

	/**
	 * Executes a Titanium SDK "build" or "clean" command. Commands are the old Titanium CLI v5
	 * format and must be run via the bootstrap.
	 *
	 * @param {String} command - The name of the command to run.
	 * @param {DispatcherContext} ctx - The dispatcher context.
	 * @returns {Promise}
	 * @access private
	 */
	async exec(command, ctx) {
		const { cwd } = ctx.headers;
		let { projectDir } = ctx.request.data;

		if (projectDir !== undefined && typeof projectDir !== 'string') {
			throw new AppcdError(codes.BAD_REQUEST, 'Missing project directory');
		}

		if (projectDir === undefined || !path.isAbsolute(projectDir)) {
			if (!cwd || typeof cwd !== 'string') {
				throw new AppcdError(codes.BAD_REQUEST, 'Current working directory required when project directory is relative');
			}
			projectDir = path.resolve(cwd, projectDir || '.');
		}

		if (command === 'build' || command === 'run') {
			try {
				await validateAppPreview(ctx.request.data);
			} catch (err) {
				if (err.code === 'ENOTENT') {
					return `${alert(err.toString())}\n\n${err.details}\n`;
				}
				throw err;
			}
		}

		const project = new Project({
			path: projectDir
		});

		// const { sdk } = project.tiapp.get('sdk-version');
		const sdk = '9.0.3.GA';
		const sdkInfo = (await appcd.call('/sdk/find', { data: { name: sdk } })).response;

		const data = {
			argv: {
				...ctx.request.data,
				projectDir,
				sdk
			},
			command,
			config:  this.config.titanium,
			sdkPath: sdkInfo.path,
			type:    'exec'
		};

		if (command === 'build') {
			data.argv.buildOnly = true;
		}

		await spawnLegacyCLI({
			ctx,
			data
		});
	}
}
