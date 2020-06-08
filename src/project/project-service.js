import Dispatcher from 'appcd-dispatcher';

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

		this.register('/new', () => {
		});

		this.register('/run', () => {
		});
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
