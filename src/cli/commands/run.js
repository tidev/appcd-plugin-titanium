import { runLegacyCLI } from '../run-legacy';

export default {
	desc: 'Build and runs a project',
	options: [
		{
			'--build-only':             'Builds the project without running it in the simulator/emulator or installing it on device',
			'-d, --project-dir [path]': 'The directory containing the project; defaults to the current directory',
			'-f, --force':              'Force a full rebuild',
			'-p, --platform [name]':    'The target build platform'
		}
	],
	async action(ctx) {
		await runLegacyCLI('run', ctx);
	}
};
