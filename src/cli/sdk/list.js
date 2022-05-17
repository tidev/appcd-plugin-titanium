import { rcompare } from '../../lib/version';

export default {
	async action({ console, argv }) {
		const [
			{ response: sdks },
			{ response: locations },
			{ response: releases } = {},
			{ response: branches } = {},
			{ response: builds } = {}
		] = await Promise.all([
			appcd.call('/sdk/list'),
			appcd.call('/sdk/locations'),
			argv.releases && appcd.call('/sdk/releases'),
			argv.branches && appcd.call('/sdk/branches'),
			argv.branch && appcd.call(`/sdk/builds/${argv.branch}`)
		]);

		const defaultInstallLocation = locations[0] || null;

		if (argv.json || argv.output === 'json') {
			const info = {
				defaultInstallLocation,
				installLocations: locations,
				installed: {},
				sdks: {}
			};

			if (releases) {
				info.releases = Object
					.keys(releases)
					.filter(name => name !== 'latest')
					.reduce((obj, name) => {
						obj[releases[name].version] = releases[name].url;
						return obj;
					}, {});
			}

			if (branches) {
				info.branches = branches;
			}

			if (builds) {
				info.builds = {
					[argv.branch]: builds
				};
			}

			for (const sdk of sdks) {
				info.installed[sdk.name] = sdk.path;
				info.sdks[sdk.name] = {
					name:     sdk.name,
					manifest: sdk.manifest,
					path:     sdk.path
				};
			}

			console.log(JSON.stringify(info, null, '  '));
		} else {
			const { bold, cyan, gray, magenta } = require('chalk');
			const installed = {};

			console.log(bold('SDK Install Locations'));
			if (locations.length) {
				for (const location of locations.sort()) {
					console.log(`  ${cyan(location)}${location === defaultInstallLocation ? gray(' (default)') : ''}`);
				}
			} else {
				console.log('  No paths found!');
			}
			console.log();

			console.log(bold('Installed SDKs'));
			if (sdks.length) {
				for (const sdk of sdks) {
					installed[sdk.name] = 1;
					console.log(`  ${cyan(sdk.name)}  ${magenta(sdk.manifest.name)}  ${sdk.path}`);
				}
			} else {
				console.log('  No SDK installed');
			}
			console.log();

			if (releases) {
				console.log(bold('Releases'));
				const latest = releases.latest && releases.latest.version;
				const releaseNames = Object.keys(releases).filter(v => v !== 'latest').sort(rcompare);
				if (releaseNames.length) {
					for (const name of releaseNames) {
						console.log(`  ${cyan(name)} ${installed[name] ? gray(' (installed)') : ''}${releases[name].version === latest ? gray(' (latest)') : ''}`);
					}
				} else {
					console.log('  No releases found!');
				}
				console.log();
			}

			if (branches) {
				console.log(bold('Branches'));
				if (branches.branches.length) {
					const { defaultBranch } = branches;
					for (const branch of branches.branches.sort((a, b) => a.localeCompare(b) * -1)) {
						console.log(`  ${cyan(branch)} ${branch === defaultBranch ? gray(' (default)') : ''}`);
					}
				} else {
					console.log('  No branches found!');
				}
				console.log();
			}

			if (argv.branch) {
				console.log(bold(`${argv.branch} Branch Builds`));
				if (builds) {
					const entries = Object.entries(builds);
					if (entries.length) {
						const dateformat = require('dateformat');
						for (const [ name, { date } ] of entries) {
							console.log(`  ${cyan(name)}  ${date && dateformat(date, 'm/d/yyyy h:MM TT') || ''}`);
						}
					} else {
						console.log('  No builds found');
					}
				} else {
					console.log(`  Branch "${argv.branch}" not found`);
				}
			}
		}
	},
	aliases: [ 'ls' ],
	desc: 'Print a list of installed SDK versions.',
	options: {
		'-b, --branches': 'Retreive and print all branches',
		'--branch [name]': 'Continuous integration build branch name',
		'--json': 'output info as JSON',
		'-o, --output [format]': { hidden: true },
		'-r, --releases': 'Retreive and print all releases'
	}
};
