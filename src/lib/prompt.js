import { prompt as enquire } from 'enquirer';
import { Readable } from 'stream';

const { highlight } = appcd.logger.styles;

/**
 * ?
 *
 * @param {Object|Array.<Object>} questions -
 * @returns {Promise}
 */
export function prompt(questions, { stdin, stdout } = {}) {
	if (!Array.isArray(questions)) {
		questions = [ questions ];
	}

	for (let i = 0, len = questions.length; i < len; i++) {
		questions[i] = {
			format() {
				// for some reason, enquirer doesn't print the selected value using the primary
				// (green) color for select prompts, so we just force it for all prompts
				return this.style(this.value);
			},
			styles: {
				em(msg) {
					// stylize emphasised text with just the primary color, no underline
					return this.primary(msg);
				}
			},
			...questions[i],
			onSubmit() {
				this.cursorShow();
			},
			stdin,
			stdout
		};
	}

	return enquire(questions);
}

/**
 * ?
 *
 * @param {Object} opts - Various options.
 * @returns {Promise}
 */
export async function promptLoop({ ctx, data, footer, header, ns, path, print }) {
	const { argv, console, terminal } = ctx;
	const logger = appcd.logger(ns);

	if (print === undefined) {
		print = console.log;
	}

	while (true) {
		try {
			const { response } = await appcd.call(path, { data });
			if (response instanceof Readable) {
				await new Promise((resolve, reject) => {
					response.on('data', print);
					response.on('end', resolve);
					response.on('error', reject);
				});
			} else if (footer) {
				print(typeof footer === 'function' ? await footer(response) : footer);
			} else {
				print(response);
			}
			return;
		} catch (err) {
			if (!err.prompt || !argv.prompt) {
				throw err;
			}

			if (header) {
				print(typeof header === 'function' ? await header() : header);
				header = null;
			}

			// prompt and try again
			let ask = err.prompt;
			let { name } = ask;
			let result;
			logger.warn(`${err.toString()}, prompting for ${highlight(`"${name}"`)}`);

			while (ask) {
				result = await prompt({
					validate(value) {
						return !!value || !this.required || ask.validateMessage || false;
					},
					name: ask.name || name,
					...ask
				}, terminal);

				ask = result?.[ask.name || name]?.prompt;
			}

			Object.assign(data, result);
		}
	}
}
