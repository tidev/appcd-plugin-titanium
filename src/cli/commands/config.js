export default {
	aliases: 'conf',
	commands: {
		'@ls, list': {
			desc: 'Display all config settings',
			action: ctx => runConfig('get', ctx)
		},
		'get [key]': {
			desc: 'Display a specific config setting',
			action: ctx => runConfig('get', ctx)
		},
		'set <key> <value>': {
			desc: 'Change a config setting',
			action: ctx => runConfig('set', ctx)
		},
		'@rm, delete, !remove, !unset <key>': {
			desc: 'Remove a config setting',
			action: ctx => runConfig('delete', ctx)
		},
		'push <key> <value>': {
			desc: 'Add a value to the end of a list',
			action: ctx => runConfig('push', ctx)
		},
		'pop <key>': {
			desc: 'Remove the last value in a list',
			action: ctx => runConfig('pop', ctx)
		},
		'shift <key>': {
			desc: 'Remove the first value in a list',
			action: ctx => runConfig('shift', ctx)
		},
		'unshift <key> <value>': {
			desc: 'Add a value ot the beginning of a list',
			action: ctx => runConfig('unshift', ctx)
		}
	},
	desc: 'Manage configuration options',
	options: {
		'--json': 'Outputs the config as JSON'
	}
};

async function runConfig(action, { argv, cmd, console, setExitCode }) {
	let { json, key, value } = argv;

	const print = ({ code = 0, key = null, value }) => {
		setExitCode(code);
		cmd.banner = false;

		if (json) {
			console.log(JSON.stringify(value, null, 2));
		} else if (value && typeof value === 'object') {
			let width = 0;
			const rows = [];

			(function walk(scope, segments) {
				if (Array.isArray(scope) && !scope.length) {
					const path = segments.join('.');
					width = Math.max(width, path.length);
					rows.push([ path, '[]' ]);
					return;
				}

				for (const key of Object.keys(scope).sort()) {
					segments.push(key);
					if (scope[key] && typeof scope[key] === 'object') {
						walk(scope[key], segments);
					} else {
						const path = segments.join('.');
						width = Math.max(width, path.length);
						rows.push([ path, scope[key] ]);
					}
					segments.pop();
				}
			}(value, key ? key.split('.') : []));

			if (rows.length) {
				for (const row of rows) {
					console.log(`${row[0].padEnd(width)} = ${row[1]}`);
				}
			} else {
				console.log('No config settings found');
			}
		} else {
			console.log(value);
		}
	};

	try {
		const { response } = await appcd.call('/appcd/config', {
			data: {
				action,
				key: /^titanium\./.test(key) ? key : key ? `titanium.${key}` : 'titanium',
				value
			}
		});

		print({ key, value: response });
	} catch (err) {
		if (err.status === 404) {
			return print({ code: 6, key });
		}
		err.json = json;
		throw err;
	}
}
