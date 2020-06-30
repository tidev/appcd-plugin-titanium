/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

if (!process.connected) {
	console.error('The Titanium SDK bootstrap cannot be directly executed.');
	process.exit(2);
}

// import CLI from './ti/cli';
import './patch';

process.title = 'titanium-legacy-bootstrap';

// the Titanium SDK commands call process.exit() directly and that will interfere with the async output, so
// we need to monkey patch stdout/stderr to make sure the buffers are flushed
const { exit, stdout, stderr } = process;
process.exit = code => Promise
	.all([ stdout, stderr ].map(stream => new Promise(resolve => {
		if (stream._writableState && stream._writableState.needDrain) {
			stream.on('drain', resolve);
		} else {
			resolve();
		}
	})))
	.then(() => exit(code));

process
	.on('uncaughtException', err => console.error('Caught unhandled exception:', err))
	.on('unhandledRejection', (reason, p) => console.error('Caught unhandled rejection at: Promise ', p, reason))
	.once('message', onMessage);

async function onMessage(msg) {
	try {
		// const cli = new CLI(msg);
		// await cli.go(msg.command);
		console.log('Hi from the bootstrap!');

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
}
