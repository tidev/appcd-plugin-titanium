import { parseVersion } from '../../lib/util';

export default {
	async fetch(data) {
		return {
			cli: {
				version: parseVersion(data.userAgent)
			},
			plugin: {
				version: data.pluginVersion
			},
			sdks: (await appcd.call('/sdk')).response
		};
	},
	render(console, info) {
		const { bold, cyan, gray, magenta } = require('chalk');

		console.log(bold('Titanium CLI'));
		console.log(`  CLI Version           = ${magenta(info.cli.version)}`);
		console.log(`  Plugin Version        = ${magenta(info.plugin.version)}`);
		console.log();

		console.log(bold('Titanium SDK'));
		if (info.sdks.length) {
			for (const sdk of info.sdks) {
				console.log(`  ${cyan(sdk.name)}`);
				console.log(`    Version             = ${magenta(sdk.manifest.version)}`);
				console.log(`    Install Location    = ${magenta(sdk.path)}`);
				console.log(`    Platforms           = ${magenta(sdk.manifest.platforms.sort().join(', '))}`);
				console.log(`    git Hash            = ${magenta(sdk.manifest.githash || 'unknown')}`);
			}
		} else {
			console.log(gray('  None'));
		}
		console.log();
	}
};
