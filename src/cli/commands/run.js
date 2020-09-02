import { callback, options, runLegacyCLI } from '../run-legacy';

export default {
	callback,
	desc: 'Build and runs a project',
	options: [
		{
			...options,
			'--build-only': 'Builds the project without running it in the simulator/emulator or installing it on device',
			'-f, --force': 'Force a full rebuild'
		}
	],
	async action(ctx) {
		await runLegacyCLI('run', ctx);
	}
};
