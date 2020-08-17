/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

if (!process.connected) {
	console.error('The Titanium SDK bootstrap cannot be directly executed.');
	process.exit(2);
}

import 'v8-compile-cache';
import 'colors';
import './tunnel';

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
	.on('unhandledRejection', (reason, p) => console.error('Caught unhandled rejection at: Promise ', p, reason));
