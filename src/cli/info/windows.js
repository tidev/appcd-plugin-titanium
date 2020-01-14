export default {
	fetch: process.platform === 'win32' && (async () => (await appcd.call('/windows/2.x/info')).response),
	render(console, info) {
		const { bold, cyan, gray, magenta } = require('chalk');

		console.log(bold('Visual Studio'));
		if (info.visualstudio && Object.keys(info.visualstudio).length) {
			for (const [ ver, vs ] of Object.entries(info.visualstudio)) {
				console.log(`  ${cyan(ver)}`);
				console.log(`    Name                = ${magenta(vs.name)}`);
				console.log(`    Path                = ${magenta(vs.path)}`);
			}
		} else {
			console.log(gray('  None'));
		}
		console.log();

		console.log(bold('Windows SDKs'));
		if (info.sdks && Object.keys(info.sdks).length) {
			for (const [ ver, sdk ] of Object.entries(info.sdks)) {
				console.log(`  ${cyan(ver)}`);
				console.log(`    Name                = ${magenta(sdk.name)}`);
			}
		} else {
			console.log(gray('  None'));
		}
		console.log();
	}
};
