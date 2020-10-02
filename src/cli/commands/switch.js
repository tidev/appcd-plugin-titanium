import { login } from '../auth/login';
import { prompt } from '../../lib/prompt';

export default {
	desc: 'Select default account and organization',
	options: {
		'--account [name]':     'The account to switch to',
		'--json':               'Outputs accounts as JSON',
		'--org [guid|id|name]': 'The organization to switch to'
	},
	async action(params) {
		const { argv, console, terminal } = params;
		const { response: accounts } = await appcd.call('/amplify/2.x/auth');
		let account;
		let { org } = argv;
		let loggedIn = false;
		let previousOrg;

		if (accounts.length) {
			account = argv.account
				&& accounts.find(a => a.name === argv.account)
				|| accounts.find(a => a.active)
				|| accounts[0];
		}

		if (!account) {
			account = await login(params);
			loggedIn = true;
		}

		if (!account.orgs?.length) {
			console.log(`Account ${account.name} does not have any orgs.`);
			return;
		}

		previousOrg = account?.org.guid;

		if (account.orgs.length === 1) {
			account = await appcd.call('/amplify/2.x/switch', {
				accountName: account.name,
				org: account.orgs[0].guid
			});
		} else if (!org && argv.json) {
			throw new Error('--org is required when --json is set');
		} else {
			if (!org) {
				let initial;
				const orgs = account.orgs.sort((a, b) => a.name.localeCompare(b.name));

				({ org } = await prompt({
					choices: orgs
						.map((org, i) => {
							if (org.guid === account.org.guid) {
								initial = i;
							}
							return {
								name:    org.name,
								message: `${org.name} (${org.guid} : ${org.id})`,
								value:   org.guid
							};
						})
						.sort((a, b) => a.message.localeCompare(b.message)),
					initial,
					message: 'Select an organization to switch to',
					name:    'org',
					type:    'select'
				}, terminal));

				console.log();
			}

			account = (await appcd.call('/amplify/2.x/auth/switch', {
				data: {
					accountName: account.name,
					org
				}
			})).response;
		}

		try {
			await appcd.call('/module/check-downloads', { data: { accountName: account.name } });
		} catch (err) {
			// squelch
		}

		if (argv.json) {
			console.log(JSON.stringify(account, null, 2));
		} else {
			const { highlight } = appcd.logger.styles;
			const msg = loggedIn ? 'are logged into' : previousOrg !== account.org.guid ? 'have switched to' : 'are already switched to';
			console.log(`You ${msg} ${highlight(account.org.name)} as ${highlight(account.user.email || account.name)}.`);
		}
	}
};
