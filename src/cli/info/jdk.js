export default {
	async fetch() {
		return (await appcd.call('/jdk/1.x/info')).response;
	},
	render(console, info) {
		const { bold, cyan, gray, magenta } = require('chalk');

		console.log(bold('Java Development Kit'));
		if (info.length) {
			for (const jdk of info) {
				console.log(`  ${cyan(`${jdk.version}:${jdk.build}`)}${jdk.default ? gray(' (default)') : ''}`);
				console.log(`    Architecture        = ${magenta(jdk.arch)}`);
				console.log(`    Path                = ${magenta(jdk.path)}`);
			}
		} else {
			console.log(gray('  Not installed'));
		}
		console.log();
	}
};
