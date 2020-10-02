export default {
	aliases: [ 'revoke' ],
	args: [
		{
			name: 'account',
			desc: 'The name of the account to revoke credentials'
		}
	],
	desc: 'Log out of all or a specific account',
	options: {
		'--json': 'Outputs revoked accounts as JSON'
	},
	async action({ argv, console }) {
		const { response: revoked } = await appcd.call('/amplify/2.x/auth/logout', {
			data: {
				accountName: argv.account
			}
		});

		if (argv.json) {
			console.log(JSON.stringify(revoked, null, 2));
			return;
		}

		// pretty output
		if (revoked.length) {
			const { highlight } = appcd.logger.styles;
			console.log('Revoked authenticated accounts:');
			for (const account of revoked) {
				console.log(` ${highlight(account.name)}`);
			}
		} else if (argv.account) {
			console.log(`No account "${argv.account}" to revoke.`);
		} else {
			console.log('No accounts to revoke.');
		}
	}
};
