import CLI from './ti/cli';
import { EventEmitter } from 'events';
import { makeSerializable } from 'appcd-util';
import { v4 as uuidv4 } from 'uuid';

/**
 * A simple state manager for sending and receiving requests to the parent process.
 *
 * Note that this tunnel implementation does NOT support chunked/streamed responses.
 */
class Tunnel extends EventEmitter {
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
		super();
		process.on('message', data => this.onMessage(data));
	}

	/**
	 * Requests that the parent process prompts for specified question.
	 *
	 * @param {Object} question - The question to prompt for.
	 * @returns {Promise}
	 * @access public
	 */
	ask(question) {
		return this.sendRequest({
			question,
			type: 'prompt'
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
		return this.sendRequest({
			data,
			path,
			type: 'call'
		});
	}

	/**
	 * Retrieves the active account or authenticates if you're not logged in.
	 *
	 * @returns {Promise} Resolves the account info.
	 */
	async getAccount() {
		if (!this._account) {
			const { response: accounts } = await this.call('/amplify/2.x/auth');
			this._account = accounts.find(a => a.active) || accounts[0];
		}
		if (!this._account) {
			this._account = (await this.call('/amplify/2.x/auth/login')).response;
		}
		return this._account;
	}

	/**
	 * Writes a message to the debug log.
	 *
	 * @param {...*} args - A message or data to log.
	 * @access public
	 */
	log(...args) {
		this.emit('tick');
		if (process.connected) {
			process.send({
				args: makeSerializable(args),
				type: 'log'
			});
		}
	}

	/**
	 * Dispatches a message from the parent process.
	 *
	 * @param {Object} data - The message data.
	 * @access private
	 */
	async onMessage(data) {
		const { id, type } = data;

		if (type === 'exec' || type === 'help') {
			try {
				const cli = new CLI(data);

				if (type === 'exec') {
					await cli.go();
				} else {
					await cli.command.load();
					process.send({
						data: makeSerializable(cli.command.conf),
						type: 'json'
					});
				}

				// the command is complete, but the IPC channel is still open, so we simply disconnect it and
				// this process should exit whenever the command finishes
				this.log('Disconnecting IPC tunnel from parent and letting process exit gracefully');
				process.disconnect();
			} catch (err) {
				process.send(makeSerializable({
					...err,
					message: err.message || err,
					stack: err.stack,
					status: err.status || 500,
					type: 'error'
				}));
				process.exit(1);
			}
			return;
		}

		const req = id && this.pending[id];
		if (!req) {
			return;
		}
		delete this.pending[id];

		const { resolve, reject } = req;

		switch (type) {
			case 'answer':
				return resolve(data.answer);

			case 'error':
				return reject(Object.defineProperties(new Error(data.error), {
					code:  { value: data.code },
					stack: { value: data.stack || 'Error originated in parent process and stack not available' }
				}));

			case 'response':
				return resolve(data.response);
		}
	}

	/**
	 * Initiates a request over the IPC tunnel to the parent.
	 *
	 * @param {Object} data - The request payload.
	 * @returns {Promise}
	 * @access private
	 */
	sendRequest(data) {
		return new Promise((resolve, reject) => {
			this.emit('tick');
			if (process.connected) {
				data.id = uuidv4();
				this.pending[data.id] = { resolve, reject };
				process.send(makeSerializable(data));
			} else {
				reject(new Error(`Can't send "${data.type}" message to parent because IPC channel has been closed`));
			}
		});
	}

	/**
	 * Sends a telemetry event.
	 *
	 * @param {Object} payload - The telemetry payload including the `event` and data.
	 * @access public
	 */
	telemetry(payload) {
		this.emit('tick');
		if (process.connected) {
			process.send(makeSerializable({
				payload,
				type: 'telemetry'
			}));
		}
	}
}

/**
 * The global tunnel instance. It is global because `process` is global and there's no single place
 * of instantiation.
 * @type {Tunnel}
 */
export default new Tunnel();
