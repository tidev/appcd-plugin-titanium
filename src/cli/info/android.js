export default {
	async fetch() {
		return (await appcd.call('/android/2.x/info')).response;
	},
	render(console, info) {
		const { cyan, gray, green, magenta } = require('chalk');

		console.log(magenta('Android SDKs'.toUpperCase()));
		if (info.sdks.length) {
			for (const sdk of info.sdks) {
				console.log(`  ${green(sdk.path)}${sdk.default ? gray(' (default)') : ''}`);
				console.log(`    ADB Executable      = ${cyan(sdk.platformTools.executables.adb || 'not installed')}`);
				console.log(`    Build Tools         = ${cyan(sdk.buildTools.length ? sdk.buildTools.map(bt => bt.version).filter(v => v).join(', ') : 'not installed')}`);
				console.log(`    Platform Tools      = ${cyan(sdk.platformTools.version || 'n/a')}`);
				console.log(`    Tools               = ${cyan(sdk.tools.version || 'n/a')}`);
				console.log('    Platforms:');
				if (sdk.platforms.length) {
					for (const platform of sdk.platforms) {
						console.log(`      ${green(platform.sdk)}`);
						console.log(`        Name            = ${cyan(platform.name)}`);
						console.log(`        API Level       = ${cyan(platform.apiLevel)}`);
						console.log(`        Revision        = ${cyan(platform.revision || '?')}`);
						console.log(`        Path            = ${cyan(platform.path)}`);
						console.log(`        Skins           = ${cyan(platform.skins.join(', '))}`);
						console.log(`        Architectures   = ${cyan(Object.keys(platform.abis).map(name => `${name}: ${platform.abis[name].join(', ')}`))}`);
					}
				} else {
					console.log(gray('      None'));
				}
				console.log('    Addons:');
				if (sdk.addons.length) {
					for (const addon of sdk.addons) {
						console.log(`      ${green(addon.name)}`);
						console.log(`        Name            = ${cyan(addon.name)}${addon.codename ? gray(` (${addon.codename})`) : ''}`);
						console.log(`        API Level       = ${cyan(addon.apiLevel)}`);
						console.log(`        Revision        = ${cyan(addon.revision || '?')}`);
						console.log(`        Based On        = ${cyan(addon.basedOn ? `Android ${addon.basedOn.version}` : 'n/a')}`);
						console.log(`        Path            = ${cyan(addon.path)}`);
						console.log(`        Vendor          = ${cyan(addon.vendor)}`);
						console.log(`        Description     = ${cyan(addon.description || 'n/a')}`);
						console.log(`        Skins           = ${cyan(addon.skins && addon.skins.join(', ') || 'none')}`);
						console.log(`        Architectures   = ${cyan(addon.abis && Object.keys(addon.abis).map(name => `${name}: ${addon.abis[name].join(', ')}`)) || 'none'}`);
					}
				} else {
					console.log(gray('      None'));
				}
			}
		} else {
			console.log(gray('  None'));
		}
		console.log();

		console.log(magenta('Android NDKs'.toUpperCase()));
		if (info.ndks.length) {
			for (const ndk of info.ndks) {
				console.log(`  ${green(ndk.path)}${ndk.default ? gray(' (default)') : ''}`);
				console.log(`    Name                = ${cyan(ndk.name)}`);
				console.log(`    Version             = ${cyan(ndk.version)}`);
				console.log(`    Architecture        = ${cyan(ndk.arch)}`);
				console.log(`    Path                = ${cyan(ndk.path)}`);
			}
		} else {
			console.log(gray('  None'));
		}
		console.log();

		console.log(magenta('Android Emulators'.toUpperCase()));
		if (info.emulators.length) {
			for (const emu of info.emulators) {
				console.log(`  ${green(emu.name)}${emu.type === 'avd' ? gray(' (AVD)') : ''}`);
				console.log(`    ID                  = ${cyan(emu.id)}`);
				console.log(`    Version             = ${cyan(emu.target || '?')}`);
				console.log(`    Architecture        = ${cyan(emu.abi)}`);
				console.log(`    Path                = ${cyan(emu.path)}`);
				console.log(`    Google APIs         = ${cyan(emu.googleApis === null ? 'Unknown' : emu.googleApis ? 'Yes' : 'No')}`);
			}
		} else {
			console.log(gray('  None'));
		}
		console.log();

		console.log(magenta('Android Devices'.toUpperCase()));
		if (info.devices.length) {
			for (const device of info.devices) {
				console.log(`  ${green(device.name)}${device.model ? gray(` (${device.model})`) : ''}`);
				console.log(`    ID                  = ${cyan(device.id)}`);
				console.log(`    State               = ${cyan(device.state)}`);
				console.log(`    SDK Version         = ${cyan(`${device.release || '?'}${device.sdk ? ` (android-${device.sdk})` : ''}`)}`);
				console.log(`    Architectures       = ${cyan(Array.isArray(device.abi) ? device.abi.sort().join(', ') : '?')}`);
			}
		} else {
			console.log(gray('  None'));
		}
		console.log();
	}
};
