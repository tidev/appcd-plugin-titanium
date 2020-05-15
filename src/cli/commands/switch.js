export default {
	desc: 'Select default account and organization',
	options: {
		'--account [name]':     'The account to switch to',
		'--json':               'Outputs accounts as JSON',
		'--org [guid|id|name]': 'The organization to switch to'
	},
	async action({ argv, console }) {
		const { response: account } = await appcd.call('/amplify/1.x/auth/switch', {
			data: {
				accountName: argv.account,
				org:         argv.org
			}
		});

		if (argv.json) {
			console.log(JSON.stringify(account, null, 2));
		} else {
			const { highlight } = require('appcd-logger').snooplogg.styles;
			console.log(`You are logged into ${highlight(account.org.name)} as ${highlight(account.user.email || account.name)}.`);
		}
	}
};
