import isPlatformGuid from '@titanium-sdk/node-is-platform-guid';
import path from 'path';

exports.init = (logger, config, cli, appc) => {
	cli.on('build.pre.compile', ({ deployType, platformName, tiapp }) => {
		if (!tiapp.modules.find(m => m.id === 'com.appcelerator.aca')) {
			return;
		}

		if (!isPlatformGuid(tiapp.guid)) {
			throw new Error('Crash Analytics requires the application to be registered');
		}

		if (/^ios|iphone$/.test(platformName) && deployType !== 'development') {
			// we only need to upload the symbols for iOS apps
			cli.on('build.post.compile', {
				post: uploadSymbols,
				priority: 10000
			});
		}
	});

	function uploadSymbols(builder) {
		const productsDir = path.join(builder.buildDir, 'build', 'Products');
		const symbolsPath = `${builder.xcodeAppDir}.dSYM`;

		//
	}

	/*
	fs.readdirSync(productsDir).forEach(function (name) {
		var subdir = path.join(productsDir, name);
		if (fs.statSync(subdir).isDirectory()) {
			fs.readdirSync(subdir).forEach(function (name) {
				var file = path.join(subdir, name);
				if (/\.dSYM$/.test(name) && fs.statSync(file).isDirectory()) {
					symbolsPath = file;
					logger.info('symbols: ' + symbolsPath);
				}
			});
		}
	});

	var symbolsTar = symbolsPath + '.tar.gz';
	if (!fs.existsSync(symbolsPath)) {
		logger.error('could not find debug symbols');
		return cb();
	}

	logger.trace('requesting crash report upload url');
	aps.createRequest(session, '/api/v1/app/' + tiapp.guid + '/upload', function (err, result) {
		if (err) {
			logger.error(err);
			return cb();
		}

		logger.trace('compressing debug symbols...');
		const tarOpt = {
			file: symbolsTar,
			cwd: path.dirname(symbolsPath),
			portable: true,
			gzip: { level: 9 }
		};

		tar.create(tarOpt, [ path.basename(symbolsPath) ], function (err) {
			if (err) {
				logger.error(err);
				return cb();
			}

			logger.trace('uploading compressed debug symbols...');
			logger.trace('uploading ' + result.url);

			if (result.module === 'aca') {
				var stat = fs.statSync(symbolsTar);
				logger.trace('symbol size: ' + stat.size);
				logger.trace('max upload limit: ' + result.limit);

				if (stat.size && result.limit && stat.size > result.limit) {
					logger.error('Symbol size exceeded limit, the symbol file upload did not succeed.');
					return cb();
				}

				var props = '?'
					+ '&version=' + tiapp.version
					+ '&platform=' + platformName
					+ '&app=' + tiapp.guid;

				var reqOptions = {
					url: result.url + props,
					headers: {
						'Content-Length': stat.size,
						'X-Auth-Token': result.api_token
					}
				};

				// dummy request to retrieve the redirect endpoint
				request.put(reqOptions, function (err, resp, body) {
					if (err) {
						logger.error(err);
						return cb();
					}

					if (resp && resp.statusCode !== 302) {
						logger.error(body);
						return cb();
					}

					var redirect_headers = {
						url: resp.headers.location,
						headers: {
							'Content-Length': stat.size
						}
					};

					// actual upload of the file to the destination, found in the headers
					var req = request.put(redirect_headers, function (err, resp, body) {
						if (err) {
							logger.error(err);
							return cb();
						}

						if (resp && resp.statusCode !== 200) {
							logger.error(body);
							return cb();
						}

						logger.trace('Uploaded compressed debug symbols!');
						return cb();
					});

					fs.createReadStream(symbolsTar).pipe(req);
				});
			} else {
				var req = request.post(result.url, function (err, resp, body) {
					if (err) {
						logger.error(err);
						return cb();
					}
					if (resp && resp.statusCode !== 200) {
						logger.error(body);
						return cb();
					}
					logger.trace('Uploaded compressed debug symbols!');
					return cb();
				});

				var form = req.form();
				form.append('key', result.api_token);
				form.append('dsym', fs.createReadStream(symbolsTar));
			}
		});
	});
	*/
};
