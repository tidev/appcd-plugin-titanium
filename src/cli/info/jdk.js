export default {
	async fetch() {
		return (await appcd.call('/jdk/1.x/info')).response;
	},
	render(console, info) {
		const { cyan, gray, green, magenta } = require('chalk');

		console.log(magenta('Java Development Kit'.toUpperCase()));
		if (info.length) {
			for (const jdk of info) {
				console.log(`  ${green(`${jdk.version}:${jdk.build}`)}${jdk.default ? gray(' (default)') : ''}`);
				console.log(`    Architecture        = ${cyan(jdk.arch)}`);
				console.log(`    Path                = ${cyan(jdk.path)}`);
			}
		} else {
			console.log(gray('  Not installed'));
		}
		console.log();
	}
};
