import { exec } from '../legacy';
import { prompt } from '../lib/prompt';

/**
 * Runs a command in the Legacy Titanium CLI based on the cli-kit execution context.
 *
 * @param {String} command - The name of the command to run.
 * @param {Object} ctx - A cli-kit execution context.
 * @returns {Promise}
 */
export async function runLegacyCLI(command, ctx) {
	const { argv, console, data, terminal } = ctx;
	const { prompt: promptingEnabled } = argv;

	// remove general CLI-related values
	delete argv.banner;
	delete argv.color;
	delete argv.help;
	delete argv.prompt;
	delete argv.version;

	// map `build` and `run` to the correct legacy `build` command
	if (command === 'build') {
		argv.buildOnly = true;
	} else if (command === 'run') {
		command = 'build';
	}

	await exec({
		argv,
		command,
		config:  data.config,
		console: console,
		cwd:     data.cwd,
		prompt:  promptingEnabled && (async question => {
			return (await prompt({
				cancel() {}, // prevent '' from being thrown
				validate(value) {
					if (this.type === 'toggle' || !this.required || !!value) {
						return true;
					}
					return question.validateMessage || false;
				},
				...question
			}, terminal))[question.name];
		})
	});
}
