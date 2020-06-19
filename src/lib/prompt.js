import { prompt as enquire } from 'enquirer';
import { Readable } from 'stream';

const { highlight } = appcd.logger.styles;

/**
 * Prompts for a value with unified settings and improved style consistency.
 *
 * @param {Object|Array.<Object>} questions - A question or list of questions to prompt for.
 * @param {Object} [terminal] - An object containing a `stdin` and `stdout` such as a cli-kit
 * `Terminal` instance.
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
 * Calls the specified appcd service and if the response returns an error with a `prompt`, then
 * it will prompt for the value and retry the request.
 *
 * @param {Object} opts - Various options.
 * @param {Object} opts.ctx - A cli-kit execution context.
 * @param {Object} opts.data - The data payload to send to the appcd service.
 * @param {String|Function} [opts.footer] - A message to display after the service call has completed successfully.
 * @param {String|Function} [opts.header] - A message to display before the first prompt.
 * @param {String} opts.ns - The debug log namespace for this prompt loop.
 * @param {String} opts.path - The appcd service to call.
 * @param {Function} [opts.print] - A custom print function. Defaults to `console.log()`.
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
