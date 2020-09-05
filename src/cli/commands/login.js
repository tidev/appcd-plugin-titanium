import { login } from '../auth/login';

const { highlight } = appcd.logger.styles;

export default {
	desc: 'Log in to the Axway AMPLIFY platform',
	options: {
		'--base-url [url]':          { hidden: true },
		'--client-id [id]':          { hidden: true },
		'--env [name]':              'The environment to use',
		'--realm [realm]':           { hidden: true },
		'--force':                   'Re-authenticate even if the account is already authenticated',
		'--json': {
			callback({ ctx, value }) {
				if (value) {
					while (ctx.parent) {
						ctx = ctx.parent;
					}
					ctx.banner = false;
				}
			},
			desc: 'Outputs accounts as JSON'
		},
		'-c, --client-secret [key]': 'A secret key used to authenticate',
		'-s, --secret-file [path]':  'Path to the PEM key used to authenticate',
		'-u, --username [user]':     'Username to authenticate with',
		'-p, --password [pass]':     'Password to authenticate with'
	},
	async action(params) {
		const { argv, console } = params;
		const account = await login(params);

		if (account) {
			if (argv.json) {
				console.log(JSON.stringify(account, null, 2));
			} else {
				console.log(`You are logged into ${highlight(account.org.name)} as ${highlight(account.user.email || account.name)}.`);
			}
		}
	}
};
