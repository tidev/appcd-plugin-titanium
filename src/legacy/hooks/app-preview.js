/**
 * This code is based on https://github.com/jeffbonnes/appc-app-preview-cli-hook by Jeff Bonnes and
 * licensed under the MIT license.
 *
 * Installr API docs: https://help.installrapp.com/api/
 */

import FormData from 'form-data';
import fs from 'fs';
import open from 'open';
import tmp from 'tmp';
import tunnel from '../tunnel';
import { expandPath } from 'appcd-path';

const endpoint = 'https://appbeta.axway.com';

exports.init = async (logger, config, cli) => {
	cli.on('build.config', data => {
		data.result[1].appPreview = [
			'App Preview Options',
			{
				'--app-preview':              'Deploy a distribution build to App Preview',
				'--add [teams]':              'A comma-separated list of team names to add access to the App Preview build',
				'--release-notes [text]':     'Release notes for the App Preview build',
				'--invite [email_addresses]': 'A comma-separated list of email addresses to send the App Preview invites to',
				'--notify [teams]':           'A comma-separated list of team names that have been previously invited to notify of App Preview build'
			}
		];
	});

	let { add, appPreview, invite, notify, outputDir, releaseNotes, target } = cli.argv;

	if (!appPreview) {
		return;
	}

	logger.info('Authentication required, getting account...');
	const account = await tunnel.getAccount();
	if (!account) {
		throw new Error('You must be authenticated to use App Preview');
	}

	if (!account.org.entitlements.appPreview) {
		throw new Error(`Your current organization "${account.org.name}" is not entitled to App Preview\nPlease upgrade your plan by visiting https://www.appcelerator.com/pricing/`);
	}

	cli.on('build.pre.compile', async ({ platformName }) => {
		if (platformName !== 'android' && platformName !== 'iphone') {
			throw new Error('App Preview is only supported when building for Android or iOS');
		}

		if (!target?.startsWith('dist-')) {
			throw new Error('App Preview can only be used when doing a distribution build');
		}

		if (platformName === 'iphone' && !outputDir) {
			if (target === 'dist-appstore') {
				logger.info('App Preview is forcing App Store build to skip Xcode archive');
			}
			outputDir = cli.argv.outputDir = cli.argv['output-dir'] = tmp.tmpNameSync({ prefix: 'titanium-app-preview-' });
		}

		// TODO: prompt for releaseNotes and notify
	});

	cli.on('build.finalize', async ({ apkFile, platformName, tiapp }) => {
		const file = platformName === 'android' ? apkFile : expandPath(outputDir, `${tiapp.name}.ipa`);

		const form = new FormData();
		form.append('qqfile', fs.createReadStream(file));
		form.append('releaseNotes', releaseNotes);
		form.append('notify', notify);
		if (add) {
			form.append('add', add);
		}

		logger.info('App Preview uploading build...');

		const post = async (url, body) => {
			try {
				return (await cli.got(url, {
					body,
					headers: {
						Accept: 'application/json',
						Cookie: `connect.sid=${account.sid}`,
						'User-Agent': 'Titanium CLI'
					},
					method: 'post',
					responseType: 'json',
					retry: 0
				})).body;
			} catch (err) {
				const msg = err.response?.body?.message || err.response?.body?.description;
				err.message = `App Preview request failed: ${msg || err.message}`;

				const code = err.response?.body?.code;
				if (code) {
					err.code = code;
				}

				throw err;
			}
		};

		const { appData, message, result } = await post(`${endpoint}/apps.json`, form);

		if (result !== 'success') {
			throw new Error(`App Preview failed to upload build: ${message || 'Unknown error'}`);
		}

		logger.info('App Preview uploaded build successfully');

		// check if we want to invite new testers
		const emails = invite && invite.split(',').map(s => s.trim()).filter(Boolean);
		if (emails?.length) {
			try {
				logger.info(`Adding tester${emails.length === 1 ? '' : 's'}: ${emails.join(', ')}`);
				const form = new FormData();
				form.append('emails', emails.join(','));
				await post(`${endpoint}/apps/${appData.id}/builds/${appData.latestBuild.id}/team.json`, form);
				logger.info(`Tester${emails.length === 1 ? '' : 's'} successfully invited`);
			} catch (err) {
				logger.warn(`App Preview failed to invite users: ${err.message}`);
			}
		}

		open(`${endpoint}/dashboard/index#/apps/${appData.id}`);
	});
};
