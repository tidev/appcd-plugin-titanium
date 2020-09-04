import fs from 'fs-extra';
import path from 'path';
import isPlatformGuid from '@titanium-sdk/node-is-platform-guid';
import tunnel from '../tunnel';

import { expandPath } from 'appcd-path';
import { sha1 } from 'appcd-util';

exports.init = (logger, config, cli, appc) => {
	const homeDir = expandPath(config.get('home'));

	async function generateDevCert({ account }) {
		logger.info('Generating developer certificate and private/public keys');

		const filename = path.join(homeDir, `.${sha1(`${account.name}${account.org.id}`)}`);
		const certFile = `${filename}.pem`;
		const keyFile = `${filename}.pk`;
		const { pki } = require('node-forge');
		const keys = pki.rsa.generateKeyPair(1024);
		const publicKey = pki.publicKeyToPem(keys.publicKey);

		logger.info('Registering developer certificate');
		const certificate = await tunnel.call('/amplify/1.x/ti/enroll', {
			data: {
				accountName: account.name,
				fingerprint: cli.fingerprint,
				publicKey
			}
		});

		await fs.mkdirs(homeDir);
		await fs.writeFile(certFile, certificate);
		await fs.writeFile(keyFile, pki.privateKeyToPem(keys.privateKey));

		if (process.platform === 'darwin' || process.platform === 'linux') {
			await fs.chmod(certFile, '400');
			await fs.chmod(keyFile, '400');
		}
	}

	async function verifyBuild({ account, deployType, modules, projectDir, tiapp }) {
		const buildFile = path.join(homeDir, 'builds', `${sha1([
			account.name,
			tiapp.guid,
			tiapp.id,
			deployType,
			cli.fingerprint,
			account.org.id
		])}.json`);

		let lastBuild;
		try {
			lastBuild = await fs.readJson(buildFile);
		} catch (e) {
			// squelch
		}

		// how long since we last verified this build configuration
		const age = lastBuild ? (Date.now() - lastBuild.timestamp) / 3600000 : null;

		if (lastBuild && deployType !== 'production' && age < 24) {
			lastBuild.skipped = true;
			return lastBuild;
		}

		// we are going to verify the build because it's either there was no previous build, this
		// is a production build, or it is a development/test build that was last verified over
		// 24 hours ago

		const verify = async data => {
			try {
				return await tunnel.call('/amplify/1.x/ti/build-verify', { data });
			} catch (err) {
				if (err.code === 'com.appcelerator.platform.app.notregistered') {
					// this is ok, just means the app isn't registered with the platform yet
				} else if (/^com\.appcelerator\.platform\.developercertificate\.(notfound|invalid)$/.test(err.code)) {
					logger.warn('Developer certs need to be regenerated');
					await generateDevCert({ account });

					try {
						// try again
						return await tunnel.call('/amplify/1.x/ti/build-verify', { data });
					} catch (err2) {
						if (err2.code !== 'com.appcelerator.platform.app.notregistered') {
							throw err2;
						}
					}
				} else {
					throw err;
				}
			}
		};

		try {
			logger.info('Verifying build');
			const result = await verify({
				accountName: account.name,
				appGuid:     tiapp.guid,
				appId:       tiapp.id,
				deployType,
				fingerprint: cli.fingerprint,
				name:        tiapp.name,
				modules,
				tiapp:       await fs.readFile(path.join(projectDir, 'tiapp.xml'), 'utf-8')
			});

			// write last build
			if (result) {
				result.skipped = false;
				result.timestamp = Date.now();
				await fs.mkdirs(path.join(homeDir, 'builds'));
				await fs.writeJson(buildFile, result);
			}

			return result;
		} catch (err) {
			// probably offline, fail
			tunnel.log(`Build verify failed: ${err.toString()} (${err.code})`);
			if (deployType === 'production') {
				throw new Error('You must be online in order to build this application for production');
			} else {
				throw new Error(`You must be online to build this application${lastBuild ? ' again' : ''}`);
			}
		}
	}

	cli.on('cli:post-validate', {
		priority: 10000,
		post(data) {
			const policy = data.cli.tiapp?.properties?.['appc-sourcecode-encryption-policy']?.value;

			if (policy === 'embed') {
				throw new Error('The source code encryption policy "embed" is no longer supported');
			}

			if (policy === 'remote') {
				throw new Error('The source code encryption policy "remote" is unsupported');
			}
		}
	});

	cli.on('build.pre.compile', {
		post: async function (builder) {
			let account;
			let result;

			if (builder.deployType === 'production') {
				logger.info('Authentication required, getting account...');
				account = await tunnel.getAccount();
				if (!account) {
					throw new Error('You must be authenticated to perform production builds');
				}
				if (!account.org.entitlements.allowProduction) {
					throw new Error(`Your current organization "${account.org.name}" is not entitled to production builds\nPlease upgrade your plan by visiting https://www.appcelerator.com/pricing/`);
				}
			}

			if (isPlatformGuid(builder.tiapp.guid)) {
				if (!account) {
					logger.info('Authentication required, getting account...');
					account = await tunnel.getAccount();
					if (!account) {
						throw new Error('You must be authenticated to build registered applications');
					}
				}

				result = await verifyBuild({
					account,
					deployType:  builder.deployType,
					modules:     builder.modules,
					projectDir:  builder.projectDir,
					tiapp:       builder.tiapp
				});

				// check to see if we need to force a rebuild
				if (builder.platformName === 'android') {
					try {
						const applicationJava = fs.readFileSync(path.join(builder.buildDir, 'java-sources.txt'), 'utf-8').match(/^"?(.+Application\.java)"?$/m);
						builder.forceRebuild = !fs.readFileSync(applicationJava[1], 'utf-8').includes('new AssetCryptImpl');
					} catch (e) {
						builder.forceRebuild = true;
					}
				} else if (builder.platformName === 'iphone') {
					try {
						const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'support', 'ios', 'ApplicationRouting.m'), 'utf-8');
						const dest = fs.readFileSync(path.join(builder.buildDir, 'Classes', 'ApplicationRouting.m'), 'utf-8');
						builder.forceRebuild = src !== dest;
					} catch (e) {
						builder.forceRebuild = true;
					}
				}
			}
		},
		priority: 0
	});

	cli.on('build.post.compile', {
		priority: 10000,
		post: async function (builder) {
			//
		}
	});

	const mutator = {
		pre: function (data) {
			const orig = data.fn;
			data.fn = function (...args) {
				const data = args[1];
				[ null, arguments['1'].length - 1 ].forEach(function () {
					if (data[arguments['0'] || arguments['1']].length === 36) {
						data[arguments['0'] || arguments['1']] = data[arguments['0'] || arguments['1']].split('').reverse().join('');
					}
				});
				orig.apply(this, args);
			};
		},
		priority: 10000
	};
	cli.on('build.android.titaniumprep', mutator);
	cli.on('build.ios.titaniumprep', mutator);
};
