export default {
	fetch: process.platform === 'darwin' && (async () => (await appcd.call('/ios/2.x/info')).response),
	render(console, info) {
		const dateformat = require('dateformat');
		const pluralize = require('pluralize');
		const { bold, cyan, gray, magenta } = require('chalk');

		console.log(bold('Xcode'));
		if (info.xcode) {
			for (const xcode of Object.values(info.xcode)) {
				console.log(`  ${cyan(xcode.version)} (build ${xcode.build})${xcode.default ? gray(' (default)') : ''}}`);
				console.log(`    App Path            = ${magenta(xcode.xcodeapp)}`);
				console.log(`    iOS SDKs            = ${magenta(xcode.sdks.ios.join(', '))}`);
				console.log(`    watchOS SDKs        = ${magenta(xcode.sdks.watchos.join(', '))}`);
				console.log(`    EULA Accepted       = ${magenta(xcode.eulaAccepted ? 'Yes' : 'No')}`);
			}
		} else {
			console.log(gray('  Not installed'));
		}
		console.log();

		const pc = (title, certs) => {
			console.log(`  ${cyan(title)}`);
			certs = certs.filter(c => !c.invalid);
			if (certs.length) {
				for (const cert of certs) {
					console.log(`    ${cert.name}`);
					console.log(`      Not valid before  = ${magenta(cert.before ?  dateformat(cert.before, 'm/d/yyyy h:MM TT') : 'unknown')}`);
					if (cert.after) {
						const days = Math.floor((new Date(cert.after) - new Date()) / 1000 / 60 / 60 / 24);
						console.log(`      Not valid after   = ${magenta(dateformat(cert.after, 'm/d/yyyy h:MM TT'))} ${gray(`(expires in ${pluralize('day', days, true)})`)}`);
					} else {
						console.log(`      Not valid after   = ${magenta('unknown')}`);
					}
				}
			} else {
				console.log(gray('    None'));
			}
		};
		console.log(bold('Certificates'));
		console.log(cyan('  Apple WWDR Cert'));
		if (info.certs.wwdr) {
			console.log('    Installed');
		} else {
			console.log(`    Not installed, visit ${magenta('https://developer.apple.com/support/certificates/expiration/')}`);
		}

		pc('Development', info.certs.developer);
		pc('Distribution', info.certs.distribution);
		console.log();

		const pp = (title, profiles) => {
			console.log(`  ${cyan(title)}`);
			profiles = profiles.filter(p => !p.expired && !p.managed);
			if (profiles.length) {
				for (const p of profiles) {
					console.log(`    ${p.name}`);
					console.log(`      UUID              = ${magenta(p.uuid)}`);
					console.log(`      App ID            = ${magenta(p.entitlements['application-identifier'] || '?')}`);
					console.log(`      Date Created      = ${magenta(p.creationDate ?  dateformat(p.creationDate, 'm/d/yyyy h:MM TT') : 'unknown')}`);
					if (p.expirationDate) {
						const days = Math.floor((new Date(p.expirationDate) - new Date()) / 1000 / 60 / 60 / 24);
						console.log(`      Date Expires      = ${magenta(dateformat(p.expirationDate, 'm/d/yyyy h:MM TT'))} ${gray(`(expires in ${pluralize('day', days, true)})`)}`);
					} else {
						console.log(`      Date Expires      = ${magenta('unknown')}`);
					}
				}
			} else {
				console.log(gray('    None'));
			}
		};
		console.log(bold('Provisioning Profiles'));
		pp('Development',                    info.provisioning.development);
		pp('App Store Distribution',         info.provisioning.distribution);
		pp('Ad Hoc Distribution',            info.provisioning.adhoc);
		pp('Enterprice Ad Hoc Distribution', info.provisioning.enterprise);
		console.log();

		const ps = (title, data) => {
			const vers = Object.keys(data);
			if (vers.length) {
				for (const ver of vers) {
					console.log(cyan(`  ${title} ${ver}`));
					const sims = data[ver];
					for (const sim of sims) {
						const supportsWatch = sim.supportsWatch && Object.values(sim.supportsWatch).filter(x => x).length;
						console.log(`   ${supportsWatch ? gray('*') : ' '}${sim.name.substring(0, 36).padEnd(36)} = ${magenta(sim.udid)}`);
					}
				}
			} else {
				console.log(gray('    None'));
			}
		};
		console.log(`${bold('Simulators')} ${gray('(*supports watch sim pairing)')}`);
		ps('iOS', info.simulators.ios);
		ps('watchOS', info.simulators.watchos);
		console.log();

		console.log(bold('iOS Devices'));
		if (info.devices.length) {
			for (const device of info.devices) {
				console.log(`  ${cyan(device.name)}`);
				console.log(`    UDID                = ${magenta(device.udid)}`);
				console.log(`    Type                = ${magenta(`${device.deviceClass} (${device.deviceColor})`)}`);
				console.log(`    iOS Version         = ${magenta(device.productVersion)}`);
				console.log(`    CPU Architecture    = ${magenta(device.cpuArchitecture)}`);
			}
		} else {
			console.log(gray('  None'));
		}
		console.log();
	}
};
