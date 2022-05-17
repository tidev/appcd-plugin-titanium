export default {
	desc: 'Displays the current logged in user',
	options: {
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		const { response: accounts } = await appcd.call('/amplify/2.x/auth');

		if (!accounts.length) {
			console.log('No authenticated accounts.');
			return;
		}

		const account = accounts.filter(a => a.active)[0] || accounts[0];

		if (argv.json) {
			console.log(JSON.stringify(account, null, 2));
		} else {
			const { highlight } = appcd.logger.styles;
			console.log(`You are logged into ${highlight(account.org.name)} as ${highlight(account.user.email || account.name)}.`);
		}
	}
};
