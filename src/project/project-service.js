/* eslint-disable node/prefer-global/console */

import Dispatcher from 'appcd-dispatcher';
import fs from 'fs-extra';
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

		this.register('/add', ctx => {
			/*
			this endpoint is for adding a component to an existing app such as:
			 * ACA:
			   - Ensure logged in
			   - Entitlement check
			   - Download/install acs module
			   - Add <module> per platform
			 * Alloy
			 * Apple Watch app:
			   - Prompt for name
			   - Install from template into project dir
			 * Hyperloop:
			   - Add <module> per platform
			 * MBS:
				- Create ACS apps
				- Add acs-* properties to tiapp.xml
				- Prompt if acs keys exist
				- Set appc-org-id and appc-creator-user-id properites
				- Add ti.cloud commonjs module
				- Add ti.cloud bootstrap to app.js
			*/

			const projectDir = assertProjectDir(ctx.request.data);

			ctx.response = 'Not implemented yet';
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
			const { response: accounts } = await appcd.call('/amplify/2.x/auth');
			const account = accounts.find(a => a.active) || accounts[0];
			if (!account) {
				throw new AppcdError(codes.FORBIDDEN, 'You must be authenticated to register an app');
			}

			if (!account.orgs.length) {
				throw new AppcdError(codes.SERVER_ERROR, `Your account "${account.name}" has no organizations, please logout and login again`);
			}

			let { force, org } = ctx.request.data;
			let org_id = null;

			// step 1: check the org
			if (org) {
				org = String(org).toLowerCase();
				org_id = account.orgs.find(({ id, guid, name }) => String(id) === org || guid === org || name.toLowerCase() === org)?.id;
			}

			if (!org_id) {
				// no `org` or `org` not found
				if (account.orgs.length > 1) {
					throw new PromptError('Organization required to register app', {
						choices: account.orgs
							.map(org => ({
								name:    org.name,
								message: org.name,
								value:   org.id
							}))
							.sort((a, b) => a.message.localeCompare(b.message)),
						message: 'Which organization should the app be registered with',
						name:    'org',
						type:    'select'
					});
				} else {
					org_id = accounts.orgs[0].id;
				}
			}

			// step 2: determine the project directory
			const projectDir = assertProjectDir(ctx.request.data);

			// step 3: load the tiapp and get the guid
			const tiappFile = path.resolve(projectDir, 'tiapp.xml');
			if (!isFile(tiappFile)) {
				throw new AppcdError(codes.BAD_REQUEST, 'Invalid project directory');
			}

			log(`Loading: ${highlight(tiappFile)}`);
			/* FIX ME!
			const tiapp = new Tiapp({ file: tiappFile });
			const { guid } = tiapp.get('guid');
			*/
			const guid = '28463e4d-0c2a-4eaf-9999-fdb4468c8778'; // already registered
			// const guid = '28463e4d-0c2a-4eaf-9999-fdb4468c8779';

			// step 4: verify that the app is registered
			if (!force) {
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
			}

			// step 5: register the app
			log(`Registering app with org ${highlight(org_id)}`);
			const { response } = await appcd.call('/amplify/2.x/ti/app/set', {
				data: {
					accountName: account.name,
					tiapp: fs.readFileSync(tiappFile, 'utf8'),
					params: {
						import: true,
						org_id
					}
				}
			});

			// step 6: update the tiapp.xml
			/* FIX ME!
			tiapp.set('guid', response.app_guid);
			tiapp.set([ 'property', 'appc-app-id' ], { type: 'string', value: response._id });
			tiapp.save();
			*/

			ctx.response = 'Registration completed successfully!\n';
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

/**
 * Checks that the project diretory is valid and resolves the absolute path.
 *
 * @param {Object} opts - Various options.
 * @param {String} opts.cwd - The current working directory.
 * @param {String} opts.projectDir - The path to the project.
 * @returns {String}
 */
function assertProjectDir({ cwd, projectDir }) {
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

	return projectDir;
}
