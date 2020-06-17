import Dispatcher from 'appcd-dispatcher';
import snooplogg from 'snooplogg';

import { Project, templates } from 'titaniumlib';

const { log } = snooplogg('project-service');

/**
 * Service for creating and building Titanium applications.
 */
export default class ProjectService extends Dispatcher {
	/**
	 * Registers all of the endpoints.
	 *
	 * @param {Object} cfg - The Appc Daemon config object.
	 * @returns {Promise}
	 * @access public
	 */
	async activate() {
		this.register('/', () => {
		});

		this.register('/build', () => {
		});

		this.register('/clean', () => {
		});

		this.register('/new', ctx => new Project().create(ctx.request.data));

		this.register('/run', () => {
		});

		// init the templates
		await templates.getTemplates();
	}

	/**
	 * Perform any necessary cleanup.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async deactivate() {
	}
}
