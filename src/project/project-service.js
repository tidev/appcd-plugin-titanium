import Dispatcher from 'appcd-dispatcher';
import path from 'path';
import TemplateService from './templates-service';

import { AppcdError, codes } from 'appcd-response';
import { Project } from 'titaniumlib';
import { spawn } from 'appcd-subprocess';

const { error, log } = appcd.logger('project-service');

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
	 * @param {Object} ctx - The dispatcher context.
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

		const project = new Project({
			path: projectDir
		});

		// const { sdk } = project.tiapp.get('sdk');
		const sdk = '9.0.3.GA';
		const sdkInfo = (await appcd.call('/sdk/find', { data: { name: sdk } })).response;

		log('Spawning legacy Titanium CLI bootstrap...');
		const { child } = spawn({
			command: process.execPath,
			args: [ path.resolve(__dirname, 'legacy/bootstrap.js') ],
			options: {
				env: Object.assign({ FORCE_COLOR: 1 }, process.env),
				stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ]
			}
		});

		child.stdout.on('data', data => ctx.response.write(data.toString()));
		child.stderr.on('data', data => ctx.response.write(data.toString()));
		child.on('close', code => {
			log(`Legacy Titanium CLI bootstrap exited (code ${code || 0})`);
			ctx.response.end();
		});
		child.on('message', async msg => {
			switch (msg.type) {
				case 'call':
					const { id, path, data } = msg;
					if (id && path) {
						let response;
						try {
							response = await appcd.call(path, data);
						} catch (err) {
							child.send({
								error: err,
								id,
								type: 'error'
							});
							throw err;
						}

						try {
							child.send({
								id,
								response,
								type: 'response'
							});
						} catch (err) {
							console.error(err);
						}
					}
					return;

				case 'error':
					error(msg);
					return ctx.response.end(msg);

				case 'log':
					return console.log(...msg.args);

				case 'telemetry':
					return appcd.telemetry(msg.payload);
			}
		});

		const data = {
			argv: {
				...ctx.request.data,
				projectDir,
				sdk
			},
			command,
			config: this.config.titanium,
			sdkPath: sdkInfo.path,
			type: 'exec'
		};
		log('Sending data to bootstrap:');
		log(data);
		child.send(data);
	}
}
