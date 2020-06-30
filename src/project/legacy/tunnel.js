import uuid from 'uuid';

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
		process.on('message', data => {
			const { id } = data;
			const req = id && this.pending[id];
			if (!req) {
				return;
			}

			const { resolve, reject } = req;

			switch (data.type) {
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
			const id = uuid.v4();
			this.pending[id] = { resolve, reject };
			process.send({
				id,
				type: 'request',
				path,
				data
			});
		});
	}
}

/**
 * The global tunnel instance. It is global because `process` is global and there's no single place
 * of instantiation.
 * @type {Tunnel}
 */
export default new Tunnel();
