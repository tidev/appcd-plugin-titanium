import { prompt } from 'enquirer';
import { Readable } from 'stream';

const { highlight } = appcd.logger.styles;

export default async function prompter({ ctx, data, footer, header, ns, path, print }) {
	const { argv, console, terminal } = ctx;
	const { stdin, stdout } = terminal;
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
						return !!value || ask.validateMessage || false;
					},
					name: ask.name || name,
					...ask,
					format() {
						return this.style(this.focused?.name || this.value);
					},
					stdin,
					stdout,
					styles: {
						em(msg) {
							return this.primary(msg);
						}
					}
				});

				ask = result?.[ask.name || name]?.prompt;
			}

			Object.assign(data, result);
		}
	}
}
