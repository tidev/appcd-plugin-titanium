import { callback, options, runLegacyCLI } from '../run-legacy';

export default {
	callback,
	desc: 'Builds a project',
	options: [
		{
			...options,
			'-f, --force': 'Force a full rebuild'
		}
	],
	async action(ctx) {
		await runLegacyCLI('build', ctx);
	}
};
