import { prompt } from '../../lib/prompt';

const { alert, highlight } = appcd.logger.styles;

/**
 * Performs a login.
 *
 * @param {Object} opts - Various options.
 * @param {Array.<String>} opts.argv - The parsed command line arguments.
 * @param {Console} opts.console - The console instance to write to.
 * @param {Function} opts.setExitCode - A function to set the exit code.
 * @param {Terminal} opts.terminal - A cli-kit Terminal instance.
 * @returns {Object} The account info.
 */
export async function login({ argv, console, setExitCode, terminal }) {
	const data = {
		baseUrl:      argv.baseUrl,
		clientId:     argv.clientId,
		clientSecret: argv.clientSecret,
		env:          argv.env,
		force:        argv.force,
		password:     argv.password,
		secretFile:   argv.secretFile,
		username:     argv.username
	};

	if (argv.username !== undefined) {
		const questions = [];

		if (!argv.username || typeof argv.username !== 'string') {
			questions.push({
				type:    'input',
				name:    'username',
				message: 'Username:',
				validate(s) {
					return !!s || 'Please enter your username';
				}
			});
		}

		if (!argv.password || typeof argv.password !== 'string') {
			questions.push({
				type:    'password',
				name:    'password',
				message: 'Password:',
				validate(s) {
					return !!s || 'Please enter your password';
				}
			});
		}

		if (questions.length && argv.json) {
			throw new Error('--username and --password are required when --json is set');
		}

		Object.assign(data, await prompt(questions, terminal));

		if (!argv.json) {
			// add a newline after prompting has completed
			console.log();
		}
	}

	try {
		const { response: account } = await appcd.call('/amplify/2.x/auth/login', { data });
		try {
			await appcd.call('/module/check-downloads', { data: { accountName: account.name } });
		} catch (err) {
			// squelch
		}
		return account;
	} catch (err) {
		if (err.code === 'EAUTHENTICATED') {
			const { account } = err;
			if (argv.json) {
				console.log(JSON.stringify(account, null, 2));
			} else {
				console.log(`You are already logged into ${highlight(account.org.name)} as ${highlight(account.user.email || account.name)}.`);
			}
		} else if (err.code === 'ERR_AUTH_FAILED') {
			console.error(alert(err.message));
			setExitCode(1);
		} else {
			throw err;
		}
	}
}

export default login;
