import path from 'path';
import { capitalize } from '../lib/util';
import { exec, spawnLegacyCLI } from '../legacy';
import { isFile } from 'appcd-fs';
import { prompt } from '../lib/prompt';
// import { Tiapp } from 'titaniumlib';

const { log } = appcd.logger('run-legacy');
const { highlight } = appcd.logger.styles;

/**
 * A cache of build options. The key is a combination of the platform and the Titanium SDK path.
 * @type {Object}
 */
const buildOptionCache = {};

/**
 * The build/run command callback that is executed when the parser finds the command.
 *
 * @param {Object} opts - Various options.
 * @param {Object} opts.data - The CLI data object.
 * @param {Parser} opts.parser - The cli-kit parser instance.
 */
export function callback({ data, parser }) {
	parser.on('finalize', async ({ ctx }) => {
		let platform;
		let projectDir = data?.cwd;

		for (const arg of parser.args) {
			if (arg.type === 'option') {
				if (arg.option.name === 'project-dir') {
					projectDir = arg.value;
				} else if (arg.option.name === 'platform') {
					platform = arg.value;
					if (platform === 'ios') {
						platform = 'iphone';
					}
				}
			}
		}

		if (!projectDir) {
			throw new Error('Expected project directory or current working directory');
		}

		const tiappFile = path.resolve(projectDir, 'tiapp.xml');
		if (!isFile(tiappFile)) {
			throw new Error('Invalid project directory');
		}

		// FIX ME!
		// data.tiapp = new Tiapp({ file: tiappFile });
		const sdk = '9.0.3.GA'; // data.tiapp.get('sdk-version');
		await loadOptions({ config: data.config, ctx, platform, sdk });
	});
}

/**
 * Loads the CLI options for the given Titanium SDK into a cli-kit context.
 *
 * @param {Object} opts - Various options.
 * @param {Context} opts.ctx - A cli-kit Context.
 * @param {String} [opts.platform] - The platform name or falsey for all platforms.
 * @param {String} opts.sdk - The name of the Titanium SDK.
 * @returns {Promise}
 */
export async function loadOptions({ config, ctx, platform, sdk }) {
	const sdkInfo = (await appcd.call('/sdk/find', { data: { name: sdk } })).response;
	const cacheKey = `${platform || ''}|${sdkInfo.path}`;
	let buildOptions = buildOptionCache[cacheKey];

	if (!Array.isArray(buildOptions)) {
		log(`Fetching "build" help for ${platform ? `platform "${platform}"` : 'all platforms'}: ${highlight(sdkInfo.path)}`);

		// load the Android and iOS options directly from the SDK
		const buildConfig = await spawnLegacyCLI({
			data: {
				command: 'build',
				config,
				sdkPath: sdkInfo.path,
				type:    'help'
			}
		});

		// copy the platform-specific options into a cli-kit friendly format
		const lv = {};
		const lvRegExp = /^liveview/;

		buildOptions = [];

		for (const key of Object.keys(buildConfig)) {
			if (key === 'flags' || key === 'options') {
				// we skip the top level build flags/options because they are either
				// already defined in the command or are unsupported
			} else if (key === 'platforms') {
				for (const [ platformName, conf ] of Object.entries(buildConfig[key])) {
					if (platform && platform !== platformName) {
						continue;
					}

					const options = {};

					for (const [ name, flag ] of Object.entries(conf.flags)) {
						if (!flag.hidden) {
							(lvRegExp.test(name) ? lv : options)[`--${name}`] = { desc: capitalize(flag.desc) };
						}
					}

					for (const [ name, option ] of Object.entries(conf.options)) {
						if (!option.hidden) {
							let format = option.abbr ? `-${option.abbr}, ` : '';
							format += `--${name} [${option.hint || 'value'}]`;
							(lvRegExp.test(name) ? lv : options)[format] = {
								desc: capitalize(option.desc)
							};
						}
					}

					if (Object.keys(options).length) {
						buildOptions.push(`${conf.title} build options`, options);
					}
				}
			} else if (Array.isArray(buildConfig[key])) {
				buildOptions.push.apply(buildOptions, buildConfig[key]);
			}
		}

		if (Object.keys(lv).length) {
			buildOptions.push('LiveView Options', lv);
		}

		buildOptionCache[cacheKey] = buildOptions;
	}

	if (buildOptions.length) {
		ctx.option(buildOptions);
	}
}

/**
 * Common options for the `build` and `run` commands.
 * @type {Object}
 */
export const options = {
	'-d, --project-dir [path]': 'The directory containing the project; defaults to the current directory',
	'-p, --platform [name]':    'The target build platform'
};

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
