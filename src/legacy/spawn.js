import path from 'path';
import { spawn } from 'appcd-subprocess';

const { log } = appcd.logger('legacy:spawn');

/**
 * Spawns the Legacy CLI and resolves once the command finishes.
 *
 * @param {Object} opts - Various options.
 * @param {DispatcherContext} [opts.ctx] - The dispatcher context.
 * @param {Object} [opts.data] - A data payload to send over the IPC tunnel to the Legacy Titanium
 * CLI.
 * @returns {Promise}
 */
export async function spawnLegacyCLI({ ctx, data }) {
	log('Spawning legacy Titanium CLI bootstrap...');
	const { child } = spawn({
		command: process.execPath,
		args: [ path.resolve(__dirname, 'bootstrap.js') ],
		options: {
			env: Object.assign({ FORCE_COLOR: 1 }, process.env),
			stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ]
		}
	});

	child.stdout.on('data', data => {
		if (ctx) {
			ctx.response.write(data.toString());
		} else {
			log(data.toString());
		}
	});

	child.stderr.on('data', data => {
		if (ctx) {
			ctx.response.write(data.toString());
		} else {
			log(data.toString());
		}
	});

	return await new Promise((resolve, reject) => {
		child.on('close', code => {
			log(`Legacy Titanium CLI bootstrap exited (code ${code || 0})`);
			if (ctx) {
				resolve();
				ctx.response.end();
			}
		});

		child.on('message', async msg => {
			switch (msg.type) {
				case 'call':
					const { id, path, data } = msg;
					if (id && path) {
						let response;
						try {
							response = await appcd.call(path, data);
						} catch (err) {
							child.send({
								error: err,
								id,
								type: 'error'
							});
							throw err;
						}

						try {
							child.send({
								id,
								response,
								type: 'response'
							});
						} catch (err) {
							console.error(err);
						}
					}
					return;

				case 'error':
				{
					const err = new Error(msg.message);
					return reject(Object.assign(err, msg));
				}

				case 'json':
					return resolve(msg.data);

				case 'log':
					return console.log(...msg.args);

				case 'telemetry':
					return appcd.telemetry(msg.payload);
			}
		});

		log('Sending data to bootstrap:');
		log(data);
		child.send(data);
	});
}
