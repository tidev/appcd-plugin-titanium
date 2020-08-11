/**
 * Installr API docs: https://help.installrapp.com/api/
 *
 * This is the App Preview CLI and validation code. The App Preview Titanium CLI plugin is located
 * in `src/legacy/hooks/app-preview-hook.js`.
 */

// const got = require('got');
// const path = require('path');

// const endpoint = 'https://appbeta.axway.com';

exports.init = (logger, config, cli, appc) => {
	cli.on('build.config', data => {
		data.result.appPreview = [
			'App Preview Options',
			{
				'--app-preview':              'Deploy a build to App Preview',
				'--add [teams]':              'A comma-separated list of team names to add access to the App Preview build',
				'--release-notes [text]':     'Release notes for the App Preview build',
				'--invite [email_addresses]': 'A comma-separated list of email addresses to send the App Preview invites to',
				'--notify [teams]':           'A comma-separated list of team names that have been previously invited to notify of App Preview build'
			}
		];
	});

	// if (!cli.argv.appPreview) {
	// 	return;
	// }

	// cli.on('build.finalize', function (data, callback) {
	// 	let artifact;
	// 	if (cli.argv.platform === 'android') {
	// 		artifact = data.apkFile;
	// 	} else if (cli.argv.platform === 'ios' && cli.argv.outputDir) {
	// 		artifact = path.join(cli.argv.outputDir, `${this.tiapp.name}.ipa`);
	// 	} else {
	// 		throw new Error();
	// 	}
	// 	// 	if (data.buildManifest.outputDir === undefined && data.iosBuildDir === undefined) {
	// 	// 		logger.error("Output directory must be defined to use --app-preview flag");
	// 	// 		return;
	// 	// 	}
	// 	// 	build_file = afs.resolvePath(path.join(data.buildManifest.outputDir, data.buildManifest.name + ".ipa"));
	// 	// }
	// });
};

/*
var _ = require("lodash");
var logger, platform, config, appc, appcConfig, j, build_file, busy;

j = request.jar();

var onUploadComplete = function(err, httpResponse, body) {
	var resp = {};
	if (err) {
		logger.error(err);
	} else {
		if (httpResponse.statusCode != 200) {
			logger.error('Error uploading to app preview, status code=' + httpResponse.statusCode);
			return;
		} else {
			resp = JSON.parse(body);
			if (resp.result != "success") {
				logger.error(resp.message);
				return;
			}
		}
		logger.info("App uploaded successfully.");
		resp = JSON.parse(body);
		// check if we want to invite new testers
		if (config.emails) {
			logger.info('Adding tester(s) ' + config.emails + ' to latest build');
			var r = request.post({
				jar: j,
				url: SERVER + '/apps/' + resp.appData.id + '/builds/' + resp.appData.latestBuild.id + '/team.json'
			}, function optionalCallback(err, httpResponse, body) {
				if (err) {
					logger.error(err);
					showFinalUrl(resp);
				} else {
					logger.info("Tester(s) invited successfully.");
					showFinalUrl(resp);
				}
			});
			var form = r.form();
			form.append('emails', config.emails);
		} else {
			showFinalUrl(resp);
		}
	}
}

function showFinalUrl(resp) {
	logger.info('Open ' + SERVER + '/dashboard/index#/apps/' + resp.appData.id + ' to configure your app in App Preview.')
}

function upload2AppPreview(data, finished) {
	var sid = process.env.APPC_SESSION_SID;
	logger.info('Uploading app to App Preview...please wait...');
	var cookie = request.cookie('connect.sid=' + sid);
	j.setCookie(cookie, SERVER);

	var obj = {
		url: SERVER + '/apps.json',
		jar: j,
		headers: {
			"user-agent": 'Appcelerator CLI'
		}
	};

	// configure proxy
	if (process.env.APPC_CONFIG_PROXY) {
		obj.proxy = process.env.APPC_CONFIG_PROXY;
	}

	var r = request.post(obj, onUploadComplete);

	var form = r.form();
	var file = fs.createReadStream(build_file);
	var totalSize = fs.statSync(build_file).size;
	var bytesRead = 0;
	var lastPercent = 0;
	file.on('data', function(chunk) {
		bytesRead += chunk.length;
		var currentPercent = Math.round((bytesRead / totalSize) * 100);
		if (currentPercent != lastPercent && currentPercent % 5 == 0) {
			logger.info("uploaded " + currentPercent + "%");
			lastPercent = currentPercent;
		}
	});
	form.append('qqfile', file);
	form.append('releaseNotes', config.releaseNotes);
	form.append('notify', config.notify.toString());
	if (config.add) {
		form.append('add', config.add.toString());
	}
}
*/

/*
function INVALID_ARGUMENT({ msg, code, prompt }) {
	const err = new TypeError(msg);
	if (code !== undefined) {
		err.code = code;
	}
	if (prompt !== undefined) {
		err.prompt = prompt;
	}
	return err;
}

export async function validate(argv) {
	if (!argv.appPreview) {
		return;
	}

	const { response: account } = await appcd.call('/amplify/1.x/auth/active');

	if (!account) {
		const err = new Error('Log in required to use App Preview');
		err.details = `Please login by running: ${highlight('ti login')}`;
		err.showHelp = false;
		throw err;
	}

	if (!account.org?.entitlements?.appPreview) {
		// eslint-disable-next-line no-throw-literal
		const err = new Error('Your account is not entitled to use App Preview');
		err.details = `Your current organization is ${highlight(`"${account.org.name}"`)}.\n`;
		if (account.orgs.length > 1) {
			err.details += `If this is not the correct organization, run ${highlight('"ti switch"')} to change to another organization.\n`;
		}
		err.details += 'To upgrade your account, visit https://billing.axway.com/.';
		err.showHelp = false;
		throw err;
	}

	log(`Active account org ${highlight(`"${account.org.name}"`)} is entitled to App Preview!`);

	const { platform } = argv;
	if (platform !== 'android' && platform !== 'ios') {
		const err = new Error(`App Preview does not support the platform "${platform}"`);
		err.details = 'Only Android and iOS platforms are supported.';
		err.showHelp = false;
		throw err;
	}

	if (platform === 'ios' && !argv.outputDir) {
		//
	}

	if (argv.releaseNotes === undefined) {
		throw INVALID_ARGUMENT({
			msg: 'Expected App Preview release notes or path to release notes file',
			prompt: {
				message: 'Please enter release notes or a path to a release notes file',
				name:    'releaseNotes',
				type:    'text'
			}
		});
	}

	if (argv.notify === undefined) {
		throw INVALID_ARGUMENT({
			msg: 'Expected App Preview notification preference',
			prompt: {
				disabled: 'No',
				enabled:  'Yes',
				initial:  true,
				message:  'Do you want to notify previous testers on upload?',
				name:     'notify',
				required: true,
				type:     'toggle'
			}
		});
	}
}
*/
