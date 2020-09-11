import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import isPlatformGuid from '@titanium-sdk/node-is-platform-guid';
import security from 'appc-security';
import tunnel from '../tunnel';
import zlib from 'zlib';
import * as version from '../../lib/version';

import { expandPath } from 'appcd-path';
import { promisify } from 'util';
import { sha1 } from 'appcd-util';

exports.init = (logger, config, cli) => {
	const gzip = promisify(zlib.gzip);
	const homeDir = expandPath(config.get('home'));
	let account;

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
						await tunnel.call('/amplify/1.x/ti/app/set', {
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
					modules:     builder.modules,
					projectDir,
					tiapp
				});

				let applicationJava;

				// step 2.4: check to see if we need to force a rebuild
				if (platformName === 'android') {
					try {
						applicationJava = path.join(builder.buildGenAppIdDir, `${builder.classname}Application.java`);
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

					tiprep.pre = function (data) {
						const orig = data.fn;
						data.fn = async function (...args) {
							const callback = args[args.length - 1];
							try {
								const assetDir = platformName === 'android' ? this.buildBinAssetsDir : this.xcodeAppDir;
								const outputDir = path.join(assetDir, sha1(tiapp.guid));
								const keys = {};
								const shasum = crypto.createHash('sha1');

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

								try {
									await tunnel.call('/amplify/1.x/ti/build-update', {
										data: {
											buildId: buildData.i,
											buildSHA: shaofshas,
											keys
										}
									});
								} catch (err) {
									// possibly offline?
									logger.warn(`Failed to update build metadata: ${err.toString()}`);
									orig.apply(builder, args);
									return;
								}

								await copyFiles(builder, {
									buildId: buildData.i,
									buildSHA: shaofshas,
									keys
								});

								if (platformName === 'android') {
									// Titanium SDK 9 switched to Gradle and no longer manually invokes aapt, javac, and the dexer, so for older
									const legacy = version.lt(this.titaniumSdkVersion, '9.0.0');

									if (legacy) {
										cli.on('build.android.dexer', data => {
											data.args[1].push(path.join(this.buildDir, 'libs', 'appcelerator-security.jar'));
											data.args[1].push(path.join(this.buildDir, 'libs', 'appcelerator-verify.jar'));
										});
									}

									cli.on('build.android.javac', data => {
										// write Application.java file
										const contents = fs.readFileSync(applicationJava, 'utf-8');
										if (contents.includes('new AssetCryptImpl')) {
											fs.writeFileSync(
												applicationJava,
												contents
													.replace(/KrollAssetHelper\.setAssetCrypt[^;]+?;/, 'KrollAssetHelper.setAssetCrypt(new com.appcelerator.verify.AssetCryptImpl(this, appInfo));')
													.replace(/(public void verifyCustomModules)/g, [
														'public void setCurrentActivity(android.app.Activity callingActivity, android.app.Activity activity)',
														'	{',
														'		com.appcelerator.verify.AssetCryptImpl.setActivity(activity);',
														'		super.setCurrentActivity(callingActivity, activity);',
														'	}',
														'',
														'	@Override',
														'$1'
													].join('\n'))
											);
										}

										if (legacy) {
											// patch javac args
											const classpathIdx = data.args.indexOf('-bootclasspath') + 1;
											for (const jar of [ 'appcelerator-security.jar', 'appcelerator-verify.jar' ]) {
												const src = path.join(__dirname, '..', '..', '..', 'support', 'android', jar);
												const dest = path.join(this.buildDir, 'libs', jar);
												data.args[classpathIdx] += `${path.delimiter}${dest}`;
												fs.copyFileSync(src, dest);
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

			} else if (policy === 'remote') {
				throw new Error('Remote encryption policy is only available to registered apps');
			}

			cli.on('build.android.titaniumprep', tiprep);
			cli.on('build.ios.titaniumprep', tiprep);
		},
		priority: 0
	});

	async function copyFiles(builder, keys) {
		const { buildDir, platformName, target } = builder;

		if (platformName === 'iphone') {
			const src = await fs.readFile(path.join(__dirname, '..', '..', '..', 'support', 'ios', 'ApplicationRouting.m'), 'utf-8');
			const dest = await fs.readFile(path.join(buildDir, 'Classes', 'ApplicationRouting.m'), 'utf-8');
			if (src !== dest) {
				const stat = await fs.stat(src);
				await fs.copy(src, dest);
				await fs.utimes(dest, stat.atime, stat.mtime);
			}
		}

		const isSimBuild = target === 'simulator' || target === 'emulator';

		/*

		// encode some necessary strings for storage in the app
		var appStore = builder.platformName === 'android' ? {} : new appc.plist();
		appStore.plan = Buffer.from(config.appc.p).toString('base64');
		appStore.uid = Buffer.from(config.appc.u).toString('base64');
		appStore.oid = Buffer.from(String(config.appc.o)).toString('base64');
		appStore.username = Buffer.from(config.appc.username).toString('base64');
		if (!config.appc.offline && config.appc.shaofshas) {
			// this is not set when offline
			appStore.sha = Buffer.from(config.appc.shaofshas).toString('base64');
		}
		// get the sourcecode encryption policy
		var policy = builder.tiapp.properties['appc-sourcecode-encryption-policy'];
		policy = (policy && policy.value) || 'remote';
		// the current policy is embed (embed the encryption key/iv into the binary)
		// otherwise, use the network (which is the most secure)
		var keyEmbed = (policy === 'embed');
		// encode policy for storage in the app
		appStore.policy = Buffer.from(policy).toString('base64');
		// by default, we do jailbreak and debugger detection. but allow dev to configure
		var jailBreakDetect = builder.target !== 'emulator' && readBooleanFromProps(builder, 'appc-security-jailbreak-detect', false);
		var debuggerDetect = readBooleanFromProps(builder, 'appc-security-debugger-detect', true);

		logger.trace(util.format('encryption policy = %s, jailbreak detect = %d, debugger detect = %d', policy, jailBreakDetect, debuggerDetect));

		if (builder.platformName === 'iphone') {
			// we are going to copy over the tiverify with our own implementation
			var sourceFn = path.join(__dirname, '..', 'support', 'ios', 'libappcverify.a');
			var targetFn = path.join(builder.buildDir, 'lib', 'libtiverify.a');
			if (fs.existsSync(targetFn) && fs.lstatSync(targetFn).isSymbolicLink()) {
				fs.unlinkSync(targetFn);
				fs.symlinkSync(sourceFn, targetFn);
			} else {
				var buf = fs.readFileSync(sourceFn);
				fs.writeFileSync(targetFn, buf);
			}
		}
		if (keyEmbed) {
			// in the key embed policy we are going to generate a key for validation offline
			var seed = Math.round(Math.random() * 5) + 1;
			var key = generateSeed(seed);
			var buildKey = Buffer.from(key).toString('base64');
			var unencrypted = JSON.stringify(json.keys);
			var encryptedObject = security.encrypt(unencrypted, buildKey, config.appc.result.pepper, config.appc.result.hmacKey, 'base64', 128);
			appStore.embedBlob = Buffer.from(encryptedObject.value).toString('base64');
			appStore.embedKey = Buffer.from(encryptedObject.derivedKey).toString('hex');
		}

		// read in our private key and use that to sign the i and we'll use that to send to server
		var privateKey = pki.privateKeyFromPem(fs.readFileSync(config.appc.privateKey));
		var md = forge.md.sha256.create();
		md.update(config.appc.i, 'utf8');
		var signature = privateKey.sign(md);
		var hex = forge.util.bytesToHex(signature);
		var buffer = Buffer.from(hex, 'hex');
		var signatureBase64 = buffer.toString('base64');
		hex = forge.util.bytesToHex(md.digest().bytes());
		buffer = Buffer.from(hex, 'hex');
		var signatureShaBase64 = buffer.toString('base64');

		// we only write main if we're not running on simulator
		if (builder.platformName === 'iphone' && !isSimBuild) {
			logger.trace('not a simulator build, generating a new main.m');

			// write into the main our url for validation
			let targetFn = path.join(builder.buildDir, 'main.m');
			let buf = fs.readFileSync(targetFn).toString();

			// if we are re-writing the same file contents, filter out existing lines so we can
			// re-write them below and not step on each other
			if (buf.indexOf('TI_APPLICATION_APPC') > 0) {
				buf = buf.split('\n').filter(function (line) {
					return line.indexOf('TI_APPLICATION_APPC') === -1
						&& line.indexOf('inserted by appc build') === -1;
				}).join('\n');
			}
			var index = buf.indexOf('int main(int argc, char *argv[])');
			if (index > 0) {
				var before = buf.substring(0, index);
				var after = buf.substring(index);
				buf = before + '\n\n'
					+ '// inserted by appc build\n';
				buf += '#define TI_APPLICATION_APPC_DBG_CHECK           vv9800980890v\n';
				buf += '#define TI_APPLICATION_APPC_JBK_CHECK           c899089089\n';
				buf += '#define TI_APPLICATION_APPC_VERIFY_PEPPER       gggfk332944990\n';
				buf += '#define TI_APPLICATION_APPC_VERIFY_HMAC         ddkssg33jjg4jh\n';
				buf += 'const bool TI_APPLICATION_APPC_DBG_CHECK = ' + debuggerDetect + ';\n';
				buf += 'const bool TI_APPLICATION_APPC_JBK_CHECK = ' + jailBreakDetect + ';\n';
				if (keyEmbed) {
					buf += 'NSString * const TI_APPLICATION_APPC_VERIFY_PEPPER = @"' + config.appc.pepper + '";\n';
					buf += 'NSString * const TI_APPLICATION_APPC_VERIFY_HMAC = @"' + config.appc.hmacKey + '";\n';
				} else {
					// define anyway to avoid missing architecture symbols in remote case
					buf += 'NSString * const TI_APPLICATION_APPC_VERIFY_PEPPER = nil;\n';
					buf += 'NSString * const TI_APPLICATION_APPC_VERIFY_HMAC = nil;\n';
				}
				buf += '\n' + after;
				// write it out
				fs.writeFileSync(targetFn, buf);
			} else {
				return finished(new Error('couldn\'t find correct main entry point'));
			}
		} else if (builder.platformName === 'android') {
			appStore.debuggerDetect = Buffer.from(String(debuggerDetect)).toString('base64');
			appStore.jailBreakDetect = Buffer.from(String(jailBreakDetect)).toString('base64');
		}

		var url = builder.config.appc.url + '/' + encodeURIComponent(builder.config.appc.i) + '/' + encodeURIComponent(signatureBase64) + '/' + encodeURIComponent(signatureShaBase64);
		appStore.build = Buffer.from(String(Date.now())).toString('base64');
		appStore.url = Buffer.from(url).toString('base64');

		var shafn = crypto.createHash('sha1');
		shafn.update(builder.tiapp.id);
		var encryptInto = builder.xcodeAppDir || builder.buildBinAssetsDir;
		var filename = path.join(encryptInto, shafn.digest('hex'));

		var appStoreString;
		if (builder.platformName === 'iphone') {
			appStoreString = appStore.toXml().toString();
			logger.trace(util.format('generated app string store:\n%j', appStoreString));
		} else if (builder.platformName === 'android') {
			appStoreString = Buffer.from(JSON.stringify(appStore)).toString('base64');
			logger.trace('generated app string store: {');
			for (let key in appStore) {
				if (Object.prototype.hasOwnProperty.call(appStore, key)) {
					logger.trace('\t' + key + ': ' + (Buffer.from(appStore[key], 'base64').toString('utf-8')));
				}
			}
			logger.trace('}');
		} else {
			throw new Error(builder.platformName + ' does not know how to handle writing out the encoded app string store');
		}

		// unmark the encrypted file for deletion
		if (builder.buildDirFiles) {
			delete builder.buildDirFiles[filename];
		}

		fs.writeFileSync(filename, appStoreString);
		// TODO: We should also send a sha of the app store values to the server so we can ensure that isn't tampered with.

		if (builder.platformName === 'iphone') {
			if (!isSimBuild) {
				// turn the XML file into binary plist if we're not running on simulator for dev
				logger.trace(util.format('running plist XML to binary conversion %s', filename));
				return appc.subprocess.run('plutil', [ '-convert', 'binary1', filename ], {}, function (err, stdout, stderr) {
					if (err) {
						return finished(new Error('error encoding XML plist to binary.' + err + '.' + stderr));
					}
					finished();
				});
			} else {
				logger.trace(util.format('skipping plist XML to binary conversion %s', filename));
				finished();
			}
		} else {
			logger.trace('encryption support files copied successfully');
			finished();
		}
		*/
	}

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
};
