import path from 'path';
import { AppcdError, codes } from 'appcd-response';
import { Project } from 'titaniumlib';
import { PromptError } from '../lib/prompt';
import { spawn } from 'appcd-subprocess';

const logger = appcd.logger('legacy-cli');
const { log } = logger;

/**
 * Executes the 'build' or 'clean' command from the Legacy Titanium CLI.
 *
 * @param {Object} opts - Various options.
 * @param {Object} opts.argv - The parsed arguments.
 * @param {String} opts.command - The name of the command to execute.
 * @param {Object} [opts.config] - The Titanium configuration.
 * @param {Console} opts.console - A console to write output to.
 * @param {String} [opts.cwd] - The current working directory. Only required if `projectDir` is
 * undefined or a relative path.
 * @param {Function} [opts.prompt] - A function that prompts for user input.
 * @returns {Promise}
 */
export async function exec({ argv, command, config, console, cwd, prompt }) {
	let { projectDir } = argv;

	// step 1: validate the project directory
	if (projectDir !== undefined && typeof projectDir !== 'string') {
		const err = new PromptError('Invalid project directory', {
			message: 'Where is the project located?',
			name:    'projectDir',
			type:    'text'
		});

		if (prompt) {
			({ projectDir } = await prompt(err));
		} else {
			throw err;
		}
	}

	if (projectDir === undefined || !path.isAbsolute(projectDir)) {
		if (!cwd || typeof cwd !== 'string') {
			throw new AppcdError(codes.BAD_REQUEST, 'Current working directory required when project directory is relative');
		}
		projectDir = path.resolve(cwd, projectDir || '.');
	}

	// step 2: init the project
	const project = new Project({
		path: projectDir
	});

	// step 3: load the sdk
	// FIX ME!
	// const { sdk } = project.tiapp.get('sdk-version');
	const sdk = '9.0.3.GA';
	const sdkInfo = (await appcd.call('/sdk/find', { data: { name: sdk } })).response;

	const data = {
		argv: {
			...argv,
			projectDir,
			sdk
		},
		command,
		config:           config || {},
		cwd:              projectDir,
		promptingEnabled: !!prompt,
		sdkPath:          sdkInfo.path,
		type:             'exec'
	};

	if (command === 'build') {
		data.argv.buildOnly = true;
	}

	// step 4: spawn the legacy cli
	await spawnLegacyCLI({ console, data, prompt });
}

/**
 * Spawns the Legacy CLI and resolves once the command finishes.
 *
 * @param {Object} opts - Various options.
 * @param {Console} [opts.console] - The console to pipe output to.
 * @param {Object} [opts.data] - A data payload to send over the IPC tunnel to the Legacy Titanium
 * CLI.
 * @param {Function} [opts.prompt] - A function that prompts for user input.
 * @returns {Promise}
 */
export async function spawnLegacyCLI({ console, data, prompt }) {
	log(`Spawning legacy Titanium CLI bootstrap (console ${console ? 'enabled' : 'disabled'})`);

	const { child } = spawn({
		command: process.execPath,
		args: [ path.resolve(__dirname, 'bootstrap.js') ],
		options: {
			cwd: data?.cwd,
			env: Object.assign({ FORCE_COLOR: 1 }, process.env),
			stdio: [ 'ignore', 'pipe', 'pipe', 'ipc' ]
		}
	});

	const trace = logger(`${child.pid}-trace`);

	if (console) {
		child.stdout.on('data', data => console._stdout.write(data.toString()));
		child.stderr.on('data', data => console._stderr.write(data.toString()));
	} else {
		const { log } = logger(`${child.pid}-stdout`);
		const { error } = logger(`${child.pid}-stderr`);
		const newline = /\n$/;
		child.stdout.on('data', data => log(data.toString().replace(newline, '')));
		child.stderr.on('data', data => error(data.toString().replace(newline, '')));
	}

	return await new Promise((resolve, reject) => {
		child.on('close', code => {
			log(`Legacy Titanium CLI bootstrap exited (code ${code || 0})`);
			resolve();
		});

		child.on('message', async msg => {
			const { type } = msg;

			if (type === 'call') {
				const { id, path, data } = msg;
				if (id && path) {
					try {
						const response = await appcd.call(path, data);
						child.send({ id, response, type: 'response' });
					} catch (err) {
						child.send({ error: err.message, id, type: 'error' });
					}
				}

			} else if (type === 'error') {
				const err = new Error(msg.message);
				reject(Object.assign(err, msg));

			} else if (type === 'json') {
				resolve(msg.data);

			} else if (type === 'log') {
				trace.log(...msg.args);

			} else if (type === 'prompt') {
				const { id, question } = msg;

				if (id && question) {
					if (prompt) {
						const answer = await prompt(question);
						child.send({ answer, id, type: 'answer' });
					} else {
						child.send({ error: 'Prompting is not enabled', id, type: 'error' });
					}
				}

			} else if (type === 'telemetry') {
				appcd.telemetry(msg.payload);
			}
		});

		log('Sending data to bootstrap:');
		log(data);
		child.send(data);
	});
}
