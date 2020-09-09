import fs from 'fs-extra';
import got from 'got';
import isPlatformGuid from '@titanium-sdk/node-is-platform-guid';
import path from 'path';
import stream from 'stream';
import tar from 'tar';
import tunnel from '../tunnel';

import { isDir } from 'appcd-fs';
import { promisify } from 'util';

exports.init = (logger, config, cli) => {
	const pipeline = promisify(stream.pipeline);

	cli.on('build.pre.compile', async ({ deployType, platformName, tiapp }) => {
		if (!tiapp.modules.find(m => m.id === 'com.appcelerator.aca' && (!m.platform || m.platform === platformName || m.platform === 'ios'))) {
			return;
		}

		if (!isPlatformGuid(tiapp.guid)) {
			throw new Error('Crash Analytics requires the application to be registered');
		}

		if (/^ios|iphone$/.test(platformName) && deployType !== 'development') {
			logger.info('Authentication required, getting account...');
			const account = await tunnel.getAccount();
			if (!account) {
				throw new Error('You must be authenticated to use Crash Analytics');
			}

			// we only need to upload the symbols for iOS apps
			cli.on('build.post.compile', {
				post: builder => uploadSymbols(builder, account),
				priority: 10000
			});
		}
	});

	async function uploadSymbols({ iosBuildDir, platformName, tiapp }, account) {
		const symbolsPath = path.join(iosBuildDir, `${tiapp.name}.app.dSYM`);
		const symbolsTarFile = `${symbolsPath}.tar.gz`;

		if (!isDir(symbolsPath)) {
			logger.error('Could not find iOS debug symbols, skipping Crash Analytics');
			return;
		}

		const { api_token, limit, url } = (await tunnel.call('/amplify/1.x/ti/aca-upload-url', {
			data: {
				accountName: account.name,
				appGuid: tiapp.guid
			}
		})).response;

		logger.info('Compressing debug symbols...');
		await tar.create({
			cwd: path.dirname(symbolsPath),
			file: symbolsTarFile,
			gzip: { level: 9 },
			portable: true
		}, [ path.basename(symbolsPath) ]);

		const stat = await fs.stat(symbolsTarFile);
		if (limit && stat.size > limit) {
			logger.error('Symbol size exceeded max upload limit, skipping Crash Analytics');
			return;
		}

		const { headers, statusCode } = await got(`${url}?app=${tiapp.guid}&platform=${platformName}&version=${tiapp.version}`, {
			followRedirect: false,
			headers: { 'X-Auth-Token': api_token },
			retry: 0
		});

		if (!headers.location || statusCode !== 302) {
			logger.error('Failed to upload debug symbols, couldn\'t resolve upload destination');
			return;
		}

		logger.info('Uploading debug symbols...');
		await pipeline(
			fs.createReadStream(symbolsTarFile),
			await got.stream.put(headers.location, {
				headers: {
					'Content-Length': stat.size
				}
			})
		);

		logger.info('Symbols uploaded successfully');
	}
};
