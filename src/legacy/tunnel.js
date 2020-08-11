import CLI from './ti/cli';
import { v4 as uuidv4 } from 'uuid';

/**
 * A simple state manager for sending and receiving requests to the parent process.
 *
 * Note that this tunnel implementation does NOT support chunked/streamed responses.
 */
class Tunnel {
	/**
	 * A map of all pending request ids and their associated promise callbacks.
	 * @type {Object}
	 */
	pending = {};

	/**
	 * Wires up the IPC message handler.
	 *
	 * @access public
	 */
	constructor() {
		process.on('message', async data => {
			const { id, type } = data;

			if (type === 'exec' || type === 'help') {
				try {
					const cli = new CLI(data);

					if (type === 'exec') {
						await cli.go();
					} else {
						await cli.command.load();
						process.send({
							data: cli.command.conf,
							type: 'json'
						});
					}

					// the command is complete, but the IPC channel is still open, so we simply disconnect it and
					// this process should exit whenever the command finishes
					process.disconnect();
				} catch (err) {
					process.send({
						...err,
						message: err.message || err,
						stack: err.stack,
						status: err.status || 500,
						type: 'error'
					});
					process.exit(1);
				}
				return;
			}

			const req = id && this.pending[id];
			if (!req) {
				return;
			}
			const { resolve, reject } = req;

			switch (type) {
				case 'response':
					delete this.pending[id];
					resolve(data.response);
					return;

				case 'error':
					delete this.pending[id];
					reject(new Error(data.error));
					return;
			}
		});
	}

	/**
	 * Makes a request to the parent process.
	 *
	 * @param {String} path - The path to request.
	 * @param {Object} [data] - An optional data payload to send with the request.
	 * @returns {Promise}
	 * @access public
	 */
	call(path, data) {
		return new Promise((resolve, reject) => {
			const id = uuidv4();
			this.pending[id] = { resolve, reject };
			process.send({
				data,
				id,
				path,
				type: 'call'
			});
		});
	}

	/**
	 * Writes a message to the debug log.
	 *
	 * @param {...*} args - A message or data to log.
	 * @access public
	 */
	log(...args) {
		process.send({
			args,
			type: 'log'
		});
	}

	/**
	 * Sends a telemetry event.
	 *
	 * @param {Object} payload - The telemetry payload including the `event` and data.
	 * @access public
	 */
	telemetry(payload) {
		process.send({
			payload,
			type: 'telemetry'
		});
	}
}

/**
 * The global tunnel instance. It is global because `process` is global and there's no single place
 * of instantiation.
 * @type {Tunnel}
 */
export default new Tunnel();
