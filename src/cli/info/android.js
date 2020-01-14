export default {
	async fetch() {
		return (await appcd.call('/android/2.x/info')).response;
	},
	render(console, info) {
		const { bold, cyan, gray, magenta } = require('chalk');

		console.log(bold('Android SDKs'));
		if (info.sdks.length) {
			for (const sdk of info.sdks) {
				console.log(`  ${cyan(sdk.path)}${sdk.default ? gray(' (default)') : ''}`);
				console.log(`    ADB Executable      = ${magenta(sdk.platformTools.executables.adb || 'not installed')}`);
				console.log(`    Build Tools         = ${magenta(sdk.buildTools.length ? sdk.buildTools.map(bt => bt.version).filter(v => v).join(', ') : 'not installed')}`);
				console.log(`    Platform Tools      = ${magenta(sdk.platformTools.version || 'n/a')}`);
				console.log(`    Tools               = ${magenta(sdk.tools.version || 'n/a')}`);
				console.log('    Platforms:');
				if (sdk.platforms.length) {
					for (const platform of sdk.platforms) {
						console.log(`      ${cyan(platform.sdk)}`);
						console.log(`        Name            = ${magenta(platform.name)}`);
						console.log(`        API Level       = ${magenta(platform.apiLevel)}`);
						console.log(`        Revision        = ${magenta(platform.revision || '?')}`);
						console.log(`        Path            = ${magenta(platform.path)}`);
						console.log(`        Skins           = ${magenta(platform.skins.join(', '))}`);
						console.log(`        Architectures   = ${magenta(Object.keys(platform.abis).map(name => `${name}: ${platform.abis[name].join(', ')}`))}`);
					}
				} else {
					console.log(gray('      None'));
				}
				console.log('    Addons:');
				if (sdk.addons.length) {
					for (const addon of sdk.addons) {
						console.log(`      ${cyan(addon.name)}`);
						console.log(`        Name            = ${magenta(addon.name)}${addon.codename ? gray(` (${addon.codename})`) : ''}`);
						console.log(`        API Level       = ${magenta(addon.apiLevel)}`);
						console.log(`        Revision        = ${magenta(addon.revision || '?')}`);
						console.log(`        Based On        = ${magenta(addon.basedOn ? `Android ${addon.basedOn.version}` : 'n/a')}`);
						console.log(`        Path            = ${magenta(addon.path)}`);
						console.log(`        Vendor          = ${magenta(addon.vendor)}`);
						console.log(`        Description     = ${magenta(addon.description || 'n/a')}`);
						console.log(`        Skins           = ${magenta(addon.skins && addon.skins.join(', ') || 'none')}`);
						console.log(`        Architectures   = ${magenta(addon.abis && Object.keys(addon.abis).map(name => `${name}: ${addon.abis[name].join(', ')}`)) || 'none'}`);
					}
				} else {
					console.log(gray('      None'));
				}
			}
		} else {
			console.log(gray('  None'));
		}
		console.log();

		console.log(bold('Android NDKs'));
		if (info.ndks.length) {
			for (const ndk of info.ndks) {
				console.log(`  ${cyan(ndk.path)}${ndk.default ? gray(' (default)') : ''}`);
				console.log(`    Name                = ${magenta(ndk.name)}`);
				console.log(`    Version             = ${magenta(ndk.version)}`);
				console.log(`    Architecture        = ${magenta(ndk.arch)}`);
				console.log(`    Path                = ${magenta(ndk.path)}`);
			}
		} else {
			console.log(gray('  None'));
		}
		console.log();

		console.log(bold('Android Emulators'));
		if (info.emulators.length) {
			for (const emu of info.emulators) {
				console.log(`  ${cyan(emu.name)}${emu.type === 'avd' ? gray(' (AVD)') : emu.type === 'genymotion' ? gray(' (Genymotion)') : ''}`);
				console.log(`    ID                  = ${magenta(emu.id)}`);
				console.log(`    Version             = ${magenta(emu.target || '?')}`);
				console.log(`    Architecture        = ${magenta(emu.abi)}`);
				console.log(`    Path                = ${magenta(emu.path)}`);
				console.log(`    Google APIs         = ${magenta(emu.googleApis === null ? 'Unknown' : emu.googleApis ? 'Yes' : 'No')}`);
			}
		} else {
			console.log(gray('  None'));
		}
		console.log();

		console.log(bold('Android Devices'));
		if (info.devices.length) {
			for (const device of info.devices) {
				console.log(`  ${cyan(device.name)}${device.model ? gray(` (${device.model})`) : ''}`);
				console.log(`    ID                  = ${magenta(device.id)}`);
				console.log(`    State               = ${magenta(device.state)}`);
				console.log(`    SDK Version         = ${magenta(`${device.release || '?'}${device.sdk ? ` (android-${device.sdk})` : ''}`)}`);
				console.log(`    Architectures       = ${magenta(Array.isArray(device.abi) ? device.abi.sort().join(', ') : '?')}`);
			}
		} else {
			console.log(gray('  None'));
		}
		console.log();
	}
};
