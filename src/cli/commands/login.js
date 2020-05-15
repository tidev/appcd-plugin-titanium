export default {
	desc: 'Log in to the Axway AMPLIFY platform',
	options: {
		'--base-url [url]':          { hidden: true },
		'--client-id [id]':          { hidden: true },
		'--env [name]':              'The environment to use',
		'--realm [realm]':           { hidden: true },
		'--force':                   'Re-authenticate even if the account is already authenticated',
		'--json':                    'Outputs accounts as JSON',
		'-c, --client-secret [key]': 'A secret key used to authenticate',
		'-s, --secret-file [path]':  'Path to the PEM key used to authenticate',
		'-u, --username [user]':     'Username to authenticate with',
		'-p, --password [pass]':     'Password to authenticate with'
	},
	async action({ argv, console, exitCode, terminal }) {
		const [
			{ snooplogg },
			{ prompt }
		] = await Promise.all([
			import('appcd-logger'),
			import('prompts')
		]);
		const { alert, highlight } = snooplogg.styles;
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

		if (Object.prototype.hasOwnProperty.call(argv, 'username')) {
			const questions = [];

			if (!argv.username || typeof argv.username !== 'string') {
				questions.push({
					type:    'text',
					name:    'username',
					message: 'Username:',
					stdin:   terminal.stdin,
					stdout:  terminal.stdout,
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
					stdin:   terminal.stdin,
					stdout:  terminal.stdout,
					validate(s) {
						return !!s || 'Please enter your password';
					}
				});
			}

			if (questions.length && argv.json) {
				throw new Error('--username and --password are required when --json is set');
			}

			Object.assign(data, await prompt(questions));

			if (!argv.json) {
				// add a newline after prompting has completed
				console.log();
			}
		}

		try {
			const { response: account } = await appcd.call('/amplify/1.x/auth/login', { data });

			if (argv.json) {
				console.log(JSON.stringify(account, null, 2));
			} else {
				console.log(`You are logged into ${highlight(account.org.name)} as ${highlight(account.user.email || account.name)}.`);
			}
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
				exitCode(1);
			} else {
				throw err;
			}
		}
	}
};
