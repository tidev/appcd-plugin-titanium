import Module from 'module';
import path from 'path';

/**
 * Patches our system info plugins into Titanium SDK's system info library calls.
 */
const lookup = {
	fields: {
		file:   path.resolve(__dirname, 'fields.js'),
		parent: '_build.js'
	},
	ioslib: {
		file:   path.resolve(__dirname, 'ios.js'),
		parent: '_build.js'
	},
	'node-titanium-sdk/lib/android': {
		file: path.resolve(__dirname, 'android.js'),
		parent: '_build.js'
	}
};

const resolveFilename = Module._resolveFilename;
Module._resolveFilename = (request, parent, isMain) => {
	return lookup[request] && parent && path.basename(parent.filename) === lookup[request].parent && lookup[request].file || resolveFilename(request, parent, isMain);
};
