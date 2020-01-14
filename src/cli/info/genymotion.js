export default {
	async fetch() {
		return (await appcd.call('/genymotion/1.x/info')).response;
	},
	render(console, info) {
		const { bold, cyan, gray, magenta } = require('chalk');

		console.log(bold('Genymotion'));
		if (info.path) {
			console.log(`  App Path              = ${magenta(info.path)}`);
			console.log(`  Genymotion Executable = ${magenta(info.executables.genymotion || 'not installed')}`);
			console.log(`  Genymotion Player     = ${magenta(info.executables.player || 'not installed')}`);
			console.log(`  Home                  = ${magenta(info.home)}`);
			console.log('  Emulators:');
			if (info.emulators.length) {
				for (const emu of info.emulators) {
					console.log(`    ${cyan(emu.name)}`);
					console.log(`      ID                = ${magenta(emu.id)}`);
					console.log(`      Version           = ${magenta(emu.target || '?')}`);
					console.log(`      Architecture      = ${magenta(emu.abi)}`);
					console.log(`      Path              = ${magenta(emu.path)}`);
					console.log(`      Google APIs       = ${magenta(emu.googleApis === null ? 'Unknown' : emu.googleApis ? 'Yes' : 'No')}`);
				}
			} else {
				console.log(gray('    None'));
			}
		} else {
			console.log(gray('  Not installed'));
		}
		console.log();

		console.log(bold('VirtualBox'));
		if (info.virtualbox) {
			console.log(`  Executable            = ${magenta(info.virtualbox.executables.vboxmanage)}`);
			console.log(`  Version               = ${magenta(info.virtualbox.version)}`);
		} else {
			console.log(`  ${gray('Not installed')}`);
		}
		console.log();
	}
};
