import { runLegacyCLI } from '../run-legacy';

export default {
	desc: 'Remove previous build directories',
	options: {
		'-d, --project-dir [path]': 'The directory containing the project; defaults to the current directory',
		'-p, --platforms [names]':  {
			aliases: [ '--platform' ],
			desc: 'A comma separated list of platforms; defaults to all platforms'
		}
	},
	async action(ctx) {
		await runLegacyCLI('clean', ctx);
	}
};
