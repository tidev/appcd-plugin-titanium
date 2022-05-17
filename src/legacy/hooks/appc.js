import crypto from 'crypto';
import fs from 'fs-extra';
import isPlatformGuid from '@titanium-sdk/node-is-platform-guid';
import path from 'path';
import plist from 'simple-plist';
import security from 'appc-security';
import tunnel from '../tunnel';
import zlib from 'zlib';
import * as version from '../../lib/version';

import { expandPath } from 'appcd-path';
import { promisify } from 'util';
import { sha1 } from 'appcd-util';

/**
 * Wires up hooks for platform integration.
 *
 * @param {Object} logger - The Titanium CLI logger.
 * @param {Object} config - The Titanium CLI config object.
 * @param {CLI} cli - The Titanium CLI instance.
 */
exports.init = (logger, config, cli) => {
	const gzip = promisify(zlib.gzip);
	const homeDir = expandPath(config.get('home'));
	let account;

	/**
	 * Hook into the build pre-construct event to validate the encryption policy.
	 */
	cli.on('build.pre.construct', builder => {
		switch (builder.tiapp.properties?.['appc-sourcecode-encryption-policy']?.value) {
			case 'embed':
				throw new Error('The source code encryption policy "embed" is no longer supported, please use the "default" or "remote" encryption policy');
			case 'remote':
				// disable encryption since we'll do it ourselves
				// note: this must be disabled during pre-construct before the builder's initialize() is called
				builder.encryptJS = false;
		}
	});

	/**
	 * Hook into the build pre-compile event to enforce entitlements, wire up encryption, and
	 * perform build verification.
	 */
	cli.on('build.pre.compile', {
		async post(builder) {
			const { deployType, platformName, projectDir, tiapp } = builder;
			const policy = tiapp.properties?.['appc-sourcecode-encryption-policy']?.value;
			const tiprep = {
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

			// step 1: production check
			if (deployType === 'production') {
				logger.info('Authentication required, getting account...');
				account = await tunnel.getAccount();
				if (!account) {
					throw new Error('You must be authenticated to perform production builds');
				}
				if (!account.org.entitlements.allowProduction) {
					throw new Error(`Your current organization "${account.org.name}" is not entitled to production builds\nPlease upgrade your plan by visiting https://www.appcelerator.com/pricing/`);
				}
			}

			// step 2: registered check
			if (isPlatformGuid(tiapp.guid)) {
				// step 2.1: authenticate
				if (!account) {
					logger.info('Authentication required, getting account...');
					account = await tunnel.getAccount();
					if (!account) {
						throw new Error('You must be authenticated to build registered applications');
					}
				}

				// step 2.2: wire up post compile metadata update
				cli.on('build.post.compile', {
					priority: 10000,
					async post() {
						await tunnel.call('/amplify/2.x/ti/app/set', {
							data: {
								accountName: account.name,
								tiapp: await fs.readFile(path.join(projectDir, 'tiapp.xml'), 'utf-8')
							}
						});
						logger.trace('Updated platform with tiapp metadata');
					}
				});

				// step 2.3: verify build
				const buildData = await verifyBuild({
					account,
					deployType,
					modules: builder.modules,
					projectDir,
					tiapp
				});

				// step 2.4: check to see if we need to force a rebuild
				if (platformName === 'android') {
					try {
						const applicationJava = path.join(builder.buildGenAppIdDir, `${builder.classname}Application.java`);
						builder.forceRebuild = !(await fs.readFile(applicationJava, 'utf-8')).includes('new AssetCryptImpl');
					} catch (e) {
						builder.forceRebuild = true;
					}
				} else if (platformName === 'iphone') {
					try {
						const src = await fs.readFile(path.join(__dirname, '..', '..', '..', 'support', 'ios', 'ApplicationRouting.m'), 'utf-8');
						const dest = await fs.readFile(path.join(builder.buildDir, 'Classes', 'ApplicationRouting.m'), 'utf-8');
						builder.forceRebuild = src !== dest;
					} catch (e) {
						builder.forceRebuild = true;
					}
				}

				// step 2.5: wire up remote encryption
				if (policy === 'remote') {
					if (platformName !== 'android' && platformName !== 'iphone') {
						throw new Error('Remote encryption policy is only available for Android and iOS apps');
					}

					// force appcelerator.com to be injected into the ATS whitelist
					// note: this must be done post-compile after the builder's initialize() is called
					builder.whitelistAppceleratorDotCom = true;

					// override the default titanium prep mutator with the remote encryption logic
					tiprep.pre = createRemoteHook(buildData);
				}

			} else if (policy === 'remote') {
				throw new Error('Remote encryption policy is only available to registered apps');
			}

			// step 3: wire up the titanium prep hook
			cli.on('build.android.titaniumprep', tiprep);
			cli.on('build.ios.titaniumprep', tiprep);
		},
		priority: 0
	});

	/**
	 * Creates the titanium prep hook that handles remote encryption.
	 *
	 * @param {Object} buildData - The build verify response.
	 * @returns {Function} The function hook.
	 */
	function createRemoteHook(buildData) {
		return function (data) {
			const orig = data.fn;
			data.fn = async function (...args) {
				const callback = args[args.length - 1];
				try {
					// step 1: create a lot of variables
					const forge = require('node-forge');
					const { buildDir, platformName, tiapp } = this;
					const isSimBuild = this.target === 'simulator' || this.target === 'emulator';
					const debuggerDetect = tiapp.properties['appc-security-debugger-detect'] !== false;
					const jailBreakDetect = !isSimBuild && tiapp.properties['appc-security-jailbreak-detect'];
					const assetDir = platformName === 'android' ? this.buildBinAssetsDir : this.xcodeAppDir;
					const outputDir = path.join(assetDir, sha1(tiapp.guid));
					const keys = {};
					const shasum = crypto.createHash('sha1');
					const privateKey = forge.pki.privateKeyFromPem(await fs.readFile(path.join(homeDir, `.${sha1(`${account.name}${account.org.id}`)}.pk`)));
					const md = forge.md.sha256.create();
					const signature = privateKey.sign(md.update(buildData.i, 'utf8'));
					const signatureBase64 = Buffer.from(forge.util.bytesToHex(signature), 'hex').toString('base64');
					const signatureShaBase64 = Buffer.from(forge.util.bytesToHex(md.digest().bytes()), 'hex').toString('base64');
					const appVerifyURL = await tunnel.call('/amplify/2.x/ti/app-verify-url');

					// step 2: encrypt the source files and write them into the
					await fs.mkdirs(outputDir);
					await Promise.all(this.jsFilesToEncrypt.map(async filename => {
						const from = path.join(assetDir, filename);
						const to = path.join(outputDir, sha1(filename));

						// unmark the encrypted file for deletion
						if (this.buildDirFiles) {
							delete this.buildDirFiles[to];
						}

						logger.trace(`Encrypting ${from} => ${to}`);
						const unencrypted = await fs.readFile(from, 'utf-8');
						const encrypted = security.encrypt(unencrypted, buildData.key, buildData.pepper, buildData.hmacKey, 'base64', 128);

						// store our key by filename path
						keys[filename] = encrypted.derivedKey.toString('hex');

						// gzip the buffer contents
						const compressed = await gzip(encrypted.value);
						logger.trace(`Compressed ${to} ${encrypted.value.length} => ${compressed.length} bytes`);
						shasum.update(sha1(compressed));
						await fs.writeFile(to, compressed);
						await fs.remove(from);
					}));

					const shaofshas = shasum.digest('hex');
					logger.debug(`sha of shas ${shaofshas}`);

					// step 3: notify the platform with encryption info
					try {
						await tunnel.call('/amplify/2.x/ti/build-update', {
							data: {
								buildId: buildData.i,
								buildSHA: shaofshas,
								keys
							}
						});
					} catch (err) {
						// possibly offline?
						logger.warn(`Failed to update build metadata: ${err.toString()}`);
						return orig.apply(this, args);
					}

					// step 4: copy over iOS specific files
					if (platformName === 'iphone') {
						let src = await fs.readFile(path.join(__dirname, '..', '..', '..', 'support', 'ios', 'ApplicationRouting.m'), 'utf-8');
						let dest = await fs.readFile(path.join(buildDir, 'Classes', 'ApplicationRouting.m'), 'utf-8');
						if (src !== dest) {
							const stat = await fs.stat(src);
							await fs.copy(src, dest);
							await fs.utimes(dest, stat.atime, stat.mtime);
						}

						// we are going to copy over the tiverify with our own implementation
						src = path.join(__dirname, '..', '..', '..', 'support', 'ios', 'libappcverify.a');
						dest = path.join(buildDir, 'lib', 'libtiverify.a');
						try {
							if (!fs.lstatSync(dest).isSymbolicLink()) {
								throw new Error();
							}
							await fs.unlink(dest);
							await fs.symlink(src, dest);
						} catch (err) {
							await fs.copy(src, dest);
						}

						if (!isSimBuild) {
							// we only write main if we're not running on simulator
							const mainFile = path.join(buildDir, 'main.m');
							let main = await fs.readFile(mainFile, 'utf-8');

							// if we are re-writing the same file contents, filter out existing lines so we can
							// re-write them below and not step on each other
							main = main.split('\n')
								.filter(line => !line.includes('TI_APPLICATION_APPC'))
								.join('\n');

							const idx = main.indexOf('int main(');
							if (idx === -1) {
								throw new Error('Couldn\'t find main entry point in main.m');
							}

							await fs.writeFile(`${main.substring(0, idx)}
#define TI_APPLICATION_APPC_DBG_CHECK vv9800980890v
#define TI_APPLICATION_APPC_JBK_CHECK c899089089
#define TI_APPLICATION_APPC_VERIFY_PEPPER gggfk332944990
#define TI_APPLICATION_APPC_VERIFY_HMAC ddkssg33jjg4jh
const bool TI_APPLICATION_APPC_DBG_CHECK = ${debuggerDetect};
const bool TI_APPLICATION_APPC_JBK_CHECK = ${jailBreakDetect};
NSString* const TI_APPLICATION_APPC_VERIFY_PEPPER = nil;
NSString* const TI_APPLICATION_APPC_VERIFY_HMAC = nil;
${main.substring(idx)}`, 'utf-8');
						}
					}

					// step 5: prepare and write store
					const store = {
						build:   Date.now(),
						debuggerDetect,
						jailBreakDetect,
						policy: 'remote',
						sha:    shaofshas,
						url:    `${appVerifyURL}/${encodeURIComponent(buildData.i)}/${encodeURIComponent(signatureBase64)}/${encodeURIComponent(signatureShaBase64)}`
					};
					logger.trace('Store data:', store);
					for (const key of Object.keys(store)) {
						store[key] = Buffer.from(String(store[key])).toString('base64');
					}
					const storeData = platformName === 'android'
						? Buffer.from(JSON.stringify(store)).toString('base64')
						: isSimBuild
							? plist.stringify(store)
							: plist.bplistCreator(store);
					const storeFile = path.join(assetDir, sha1(tiapp.id));
					await fs.writeFile(storeFile, storeData);

					// TODO: send the storeSha to platform
					// const storeSha = sha1(store);

					// unmark the encrypted file for deletion
					if (this.buildDirFiles) {
						delete this.buildDirFiles[storeFile];
					}

					// step 6: wire up Android specific hooks to generate the Application.java file and wire up the legacy jar files
					if (platformName === 'android') {
						// Titanium SDK 9 switched to Gradle and no longer manually invokes aapt, javac, and the dexer, so for older
						const legacy = version.lt(this.titaniumSdkVersion, '9.0.0');

						if (legacy) {
							cli.on('build.android.dexer', data => {
								data.args[1].push(path.join(buildDir, 'libs', 'appcelerator-security.jar'));
								data.args[1].push(path.join(buildDir, 'libs', 'appcelerator-verify.jar'));
							});
						}

						cli.on('build.android.javac', async data => {
							// write Application.java file
							const applicationJava = path.join(this.buildGenAppIdDir, `${this.classname}Application.java`);
							let contents = await fs.readFile(applicationJava, 'utf-8');
							if (contents.includes('new AssetCryptImpl')) {
								contents = contents
									.replace(/KrollAssetHelper\.setAssetCrypt[^;]+?;/, 'KrollAssetHelper.setAssetCrypt(new com.appcelerator.verify.AssetCryptImpl(this, appInfo));')
									.replace(/(public void verifyCustomModules)/g, `\
public void setCurrentActivity(android.app.Activity callingActivity, android.app.Activity activity)
{
com.appcelerator.verify.AssetCryptImpl.setActivity(activity);
super.setCurrentActivity(callingActivity, activity);
}

@Override
$1`);
								await fs.writeFile(applicationJava, contents, 'utf-8');
							}

							if (legacy) {
								// patch javac args
								const classpathIdx = data.args.indexOf('-bootclasspath') + 1;
								for (const jar of [ 'appcelerator-security.jar', 'appcelerator-verify.jar' ]) {
									const src = path.join(__dirname, '..', '..', '..', 'support', 'android', jar);
									const dest = path.join(buildDir, 'libs', jar);
									data.args[classpathIdx] += `${path.delimiter}${dest}`;
									await fs.copyFile(src, dest);
								}
							}
						});
					}

					callback();
				} catch (err) {
					callback(err);
				}
			};
		};
	}

	/**
	 * Generates the developer key pair and writes it in the home directory.
	 *
	 * @param {Object} account - The authenticated account info.
	 * @returns {Promise}
	 */
	async function generateDevCert(account) {
		logger.info('Generating developer certificate and private/public keys');

		const filename = path.join(homeDir, `.${sha1(`${account.name}${account.org.id}`)}`);
		const certFile = `${filename}.pem`;
		const keyFile = `${filename}.pk`;
		const { pki } = require('node-forge');
		const keys = pki.rsa.generateKeyPair(1024);
		const publicKey = pki.publicKeyToPem(keys.publicKey);

		logger.info('Registering developer certificate');
		const certificate = await tunnel.call('/amplify/2.x/ti/enroll', {
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

	/**
	 * Verifies the build and retrieves the build id and developer identification info.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {Object} params.account - The authenticated account info.
	 * @param {String} params.deployType - The build deploy type.
	 * @param {Array.<Object>} params.modules - A list of module descriptors that based on the
	 * `tiapp.xml` that are compatible with the current platform being built for.
	 * @param {Object} params.tiapp - An object containing the values from the `tiapp.xml`.
	 * @returns {Promise}
	 */
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
			await fs.remove(buildFile);
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
				return await tunnel.call('/amplify/2.x/ti/build-verify', { data });
			} catch (err) {
				if (err.code === 'com.appcelerator.platform.app.notregistered') {
					// this is ok, just means the app isn't registered with the platform yet
				} else if (/^com\.appcelerator\.platform\.developercertificate\.(notfound|invalid)$/.test(err.code)) {
					logger.warn('Developer certs need to be regenerated');
					await generateDevCert(account);

					try {
						// try again
						return await tunnel.call('/amplify/2.x/ti/build-verify', { data });
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
};
