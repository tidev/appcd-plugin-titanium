/* eslint-disable node/prefer-global/console */

import Dispatcher from 'appcd-dispatcher';
import path from 'path';
import TemplateService from './templates-service';
import { AppcdError, codes } from 'appcd-response';
import { Console } from 'console';
import { exec } from '../legacy';
import { isFile } from 'appcd-fs';
import { Project /* , Tiapp */ } from 'titaniumlib';
import { PromptError } from '../lib/prompt';

const { log } = appcd.logger('project');
const { highlight } = appcd.logger.styles;

/**
 * Service for creating and building Titanium applications.
 */
export default class ProjectService extends Dispatcher {
	templateSvc = new TemplateService();

	/**
	 * Registers all of the endpoints.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async activate() {
		const runLegacyCLI = async (command, ctx) => {
			const { cwd } = ctx.request.data;
			const argv = { ...ctx.request.data };
			delete argv.cwd;
			await exec({
				argv,
				command,
				config:  appcd.config.get('titanium'),
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

		this.register('/register', async ctx => {
			// step 1: make sure you're logged in
			log('!!!!!!!!!!! GETTING ACCOUNT');
			const { response: accounts } = await appcd.call('/amplify/2.x/auth');
			log(accounts);
			const account = accounts.find(a => a.active) || accounts[0];
			log(account);
			if (!account) {
				throw new AppcdError(codes.FORBIDDEN, 'You must be authenticated to perform production builds');
			}

			// step 2: determine the project directory
			let { cwd, projectDir } = ctx.request.data;

			if (projectDir !== undefined && typeof projectDir !== 'string') {
				throw new PromptError('Invalid project directory', {
					message: 'Where is the project located?',
					name:    'projectDir',
					type:    'text'
				});
			}

			if (projectDir === undefined || !path.isAbsolute(projectDir)) {
				if (!cwd || typeof cwd !== 'string') {
					throw new AppcdError(codes.BAD_REQUEST, 'Current working directory required when project directory is relative');
				}
				projectDir = path.resolve(cwd, projectDir || '.');
			}

			// step 3: load the tiapp and get the guid
			const tiappFile = path.resolve(projectDir, 'tiapp.xml');
			if (!isFile(tiappFile)) {
				throw new AppcdError(codes.BAD_REQUEST, 'Invalid project directory');
			}

			log(`Loading: ${highlight(tiappFile)}`);
			// FIX ME!
			// const tiapp = new Tiapp({ file: tiappFile });
			// const { guid } = tiapp.get('guid');
			const guid = '28463e4d-0c2a-4eaf-9999-fdb4468c8778';

			// step 4: verify that the app is registered
			try {
				await appcd.call('/amplify/2.x/ti/app', {
					data: {
						accountName: account.name,
						appGuid:     guid
					}
				});

				ctx.response = 'Application already registered\n';
				return;
			} catch (err) {
				if (err.code !== 404) {
					throw new AppcdError(codes.SERVER_ERROR, `Failed to verify app: ${err.message}`);
				}
			}

			// step 5: register the app
			ctx.response = 'registering! :)\n';
		});

		// TODO: in the future, run will call project.build and we'll "run" it ourselves
		this.register('/run', ctx => runLegacyCLI('run', ctx));

		await this.templateSvc.activate();
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
