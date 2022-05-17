export default {
	fetch: process.platform === 'darwin' && (async () => (await appcd.call('/ios/2.x/info')).response),
	render(console, info) {
		const dateformat = require('dateformat');
		const pluralize = require('pluralize');
		const { cyan, gray, green, magenta } = require('chalk');

		console.log(magenta('Xcode'.toUpperCase()));
		if (info.xcode) {
			for (const xcode of Object.values(info.xcode)) {
				console.log(`  ${green(`${xcode.version} (build ${xcode.build})`)}${xcode.default ? gray(' (default)') : ''}`);
				console.log(`    App Path            = ${cyan(xcode.xcodeapp)}`);
				console.log(`    iOS SDKs            = ${cyan(xcode.sdks.ios.join(', '))}`);
				console.log(`    watchOS SDKs        = ${cyan(xcode.sdks.watchos.join(', '))}`);
				console.log(`    EULA Accepted       = ${cyan(xcode.eulaAccepted ? 'Yes' : 'No')}`);
			}
		} else {
			console.log(gray('  Not installed'));
		}
		console.log();

		const pc = (title, certs) => {
			console.log(`  ${green(title)}`);
			const total = certs.length;
			certs = certs.filter(c => !c.invalid);
			if (certs.length) {
				for (const cert of certs) {
					console.log(`    ${cert.name}`);
					console.log(`      Not valid before  = ${cyan(cert.before ?  dateformat(cert.before, 'm/d/yyyy h:MM TT') : 'unknown')}`);
					if (cert.after) {
						const days = Math.floor((new Date(cert.after) - new Date()) / 1000 / 60 / 60 / 24);
						console.log(`      Not valid after   = ${cyan(dateformat(cert.after, 'm/d/yyyy h:MM TT'))} ${gray(`(expires in ${pluralize('day', days, true)})`)}`);
					} else {
						console.log(`      Not valid after   = ${cyan('unknown')}`);
					}
				}
				const delta = total - certs.length;
				if (delta) {
					console.log(gray(`    (${delta} additional expired cert${delta === 1 ? '' : 's'})`));
				}
			} else if (total) {
				console.log(gray(`    None (${total} expired cert${total === 1 ? '' : 's'})`));
			} else {
				console.log(gray('    None'));
			}
		};
		console.log(magenta('Certificates'.toUpperCase()));
		console.log(green('  Apple WWDR Cert'));
		if (info.certs.wwdr) {
			console.log('    Installed');
		} else {
			console.log(`    Not installed, visit ${cyan('https://developer.apple.com/support/certificates/expiration/')}`);
		}

		pc('Development', info.certs.developer);
		pc('Distribution', info.certs.distribution);
		console.log();

		const pp = (title, profiles) => {
			console.log(`  ${green(title)}`);
			const total = profiles.length;
			profiles = profiles.filter(p => !p.expired && !p.managed);
			if (profiles.length) {
				for (const p of profiles) {
					console.log(`    ${p.name}`);
					console.log(`      UUID              = ${cyan(p.uuid)}`);
					console.log(`      App ID            = ${cyan(p.entitlements['application-identifier'] || '?')}`);
					console.log(`      Date Created      = ${cyan(p.creationDate ?  dateformat(p.creationDate, 'm/d/yyyy h:MM TT') : 'unknown')}`);
					if (p.expirationDate) {
						const days = Math.floor((new Date(p.expirationDate) - new Date()) / 1000 / 60 / 60 / 24);
						console.log(`      Date Expires      = ${cyan(dateformat(p.expirationDate, 'm/d/yyyy h:MM TT'))} ${gray(`(expires in ${pluralize('day', days, true)})`)}`);
					} else {
						console.log(`      Date Expires      = ${cyan('unknown')}`);
					}
				}
				const delta = total - profiles.length;
				if (delta) {
					console.log(gray(`    (${delta} additional expired or unsupported profile${delta === 1 ? '' : 's'})`));
				}
			} else if (total) {
				console.log(gray(`    None (${total} expired or unsupported profile${total === 1 ? '' : 's'})`));
			} else {
				console.log(gray('    None'));
			}
		};
		console.log(magenta('Provisioning Profiles'.toUpperCase()));
		pp('Development',                    info.provisioning.development);
		pp('App Store Distribution',         info.provisioning.distribution);
		pp('Ad Hoc Distribution',            info.provisioning.adhoc);
		pp('Enterprice Ad Hoc Distribution', info.provisioning.enterprise);
		console.log();

		const star = process.platform === 'win32' ? '*' : '★';
		const ps = (title, data) => {
			const vers = Object.keys(data);
			if (vers.length) {
				for (const ver of vers) {
					console.log(green(`  ${title} ${ver}`));
					const sims = data[ver];
					for (const sim of sims) {
						const supportsWatch = sim.supportsWatch && Object.values(sim.supportsWatch).filter(x => x).length;
						console.log(`  ${supportsWatch ? gray(star) : ' '} ${sim.name.substring(0, 36).padEnd(36)} = ${cyan(sim.udid)}`);
					}
				}
			} else {
				console.log(gray('    None'));
			}
		};
		console.log(`${magenta('Simulators'.toUpperCase())} ${gray(`(${star} supports watch sim pairing)`)}`);
		ps('iOS', info.simulators.ios);
		ps('watchOS', info.simulators.watchos);
		console.log();

		console.log(magenta('iOS Devices'.toUpperCase()));
		if (info.devices.length) {
			for (const device of info.devices) {
				console.log(`  ${green(device.name)}`);
				console.log(`    UDID                = ${cyan(device.udid)}`);
				console.log(`    Type                = ${cyan(`${device.deviceClass} (${device.deviceColor})`)}`);
				console.log(`    iOS Version         = ${cyan(device.productVersion)}`);
				console.log(`    CPU Architecture    = ${cyan(device.cpuArchitecture)}`);
			}
		} else {
			console.log(gray('  None'));
		}
		console.log();
	}
};
