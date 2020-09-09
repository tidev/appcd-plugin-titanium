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
		const { cyan, gray, green, magenta } = require('chalk');

		console.log(magenta('Titanium CLI'.toUpperCase()));
		console.log(`  CLI Version           = ${cyan(info.cli.version)}`);
		console.log(`  Plugin Version        = ${cyan(info.plugin.version)}`);
		console.log();

		console.log(magenta('Titanium SDKs'.toUpperCase()));
		if (info.sdks.length) {
			for (const sdk of info.sdks) {
				console.log(`  ${green(sdk.name)}`);
				console.log(`    Version             = ${cyan(sdk.manifest.version)}`);
				console.log(`    Install Location    = ${cyan(sdk.path)}`);
				console.log(`    Platforms           = ${cyan(sdk.manifest.platforms.sort().join(', '))}`);
				console.log(`    git Hash            = ${cyan(sdk.manifest.githash || 'unknown')}`);
			}
		} else {
			console.log(gray('  None'));
		}
		console.log();
	}
};
