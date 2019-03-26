import CLI from 'cli-kit';
import Dispatcher from 'appcd-dispatcher';

/**
 * Defines a service endpoint for defining, processing, and dispatching Titanium CLI commands.
 */
export default class CLIService extends Dispatcher {
	/**
	 * Registers all of the endpoints.
	 *
	 * @param {Object} cfg - The Appc Daemon config object.
	 * @returns {Promise}
	 * @access public
	 */
	async activate(cfg) {
		this.config = cfg;

		this.cli = new CLI({
			commands: {
				new:     { desc: 'Create a new project' },
				build:   { desc: 'Builds a project' },
				info:    { desc: 'Display development environment information' },
				project: { desc: 'Manage project settings.' }
			}
		});

		this.register('/', async ctx => {
			const { argv } = ctx.request.data;
			const results = await this.cli.exec(argv);
			return {
				argv: results.argv,
				_: results._
			};
		});

		this.register('/schema', () => this.cli.schema);
	}

	/**
	 * ?
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async deactivate() {
		//
	}
}
