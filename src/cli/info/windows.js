export default {
	fetch: process.platform === 'win32' && (async () => (await appcd.call('/windows/2.x/info')).response),
	render(console, info) {
		const { cyan, gray, green, magenta } = require('chalk');

		console.log(magenta('Visual Studio'.toUpperCase()));
		if (info.visualstudio && Object.keys(info.visualstudio).length) {
			for (const [ ver, vs ] of Object.entries(info.visualstudio)) {
				console.log(`  ${green(ver)}`);
				console.log(`    Name                = ${cyan(vs.name)}`);
				console.log(`    Path                = ${cyan(vs.path)}`);
			}
		} else {
			console.log(gray('  None'));
		}
		console.log();

		console.log(magenta('Windows SDKs'.toUpperCase()));
		if (info.sdks && Object.keys(info.sdks).length) {
			for (const [ ver, sdk ] of Object.entries(info.sdks)) {
				console.log(`  ${green(ver)}`);
				console.log(`    Name                = ${cyan(sdk.name)}`);
			}
		} else {
			console.log(gray('  None'));
		}
		console.log();
	}
};
