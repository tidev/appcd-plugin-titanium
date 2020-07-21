import Module from 'module';
import path from 'path';

/**
 * Patches our system info plugins into Titanium SDK's system info library calls.
 */
const lookup = {
	fields: path.resolve(__dirname, 'fields.js'),
	ioslib: path.resolve(__dirname, 'ios.js'),
	'node-titanium-sdk/lib/android': path.resolve(__dirname, 'android.js')
};

const load = Module._load;
Module._load = (request, parent, isMain) => {
	const module = load(request, parent, isMain);
	if (lookup[request] && parent && path.basename(parent.filename) === '_build.js') {
		Object.assign(module, load(lookup[request], parent, isMain));
	}
	return module;
};
