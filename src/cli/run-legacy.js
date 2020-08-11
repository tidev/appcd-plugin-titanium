import { exec } from '../legacy';
import { prompt } from '../lib/prompt';

export async function runLegacyCLI(command, ctx) {
	const { argv, console, data, terminal } = ctx;
	const { prompt: promptEnabled } = argv;

	// remove general CLI-related values
	delete argv.banner;
	delete argv.color;
	delete argv.help;
	delete argv.prompt;
	delete argv.version;

	await exec({
		argv,
		command,
		config: data.config,
		console: console,
		cwd: data.cwd,
		prompt: promptEnabled && (async ask => {
			let { name } = ask;
			let result;

			while (ask) {
				result = await prompt({
					cancel() {}, // prevent '' from being thrown
					validate(value) {
						if (this.type === 'toggle' || !this.required || !!value) {
							return true;
						}
						return ask.validateMessage || false;
					},
					name: ask.name || name,
					...ask
				}, terminal);

				ask = result?.[ask.name || name]?.prompt;
			}

			return result;
		})
	});
}
