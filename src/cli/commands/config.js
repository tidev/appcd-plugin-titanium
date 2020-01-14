const readActions = {
	get:     'get',
	ls:      'get',
	list:    'get'
};

const writeActions = {
	set:     'set',

	delete:  'delete',
	rm:      'delete',
	unset:   'delete',

	push:    'push',
	pop:     'pop',
	shift:   'shift',
	unshift: 'unshift'
};

export default {
	aliases: 'conf',
	args: [
		{
			name: '<action>',
			desc: 'the action to run',
			values: {
				'ls, list': 'display all settings',
				get: 'display a specific setting',
				set: 'change a setting',
				'rm, delete': 'remove a setting',
				push: 'add a value to the end of a list',
				pop: 'remove the last value in a list'
			}
		},
		{ name: 'key', desc: '' },
		{ name: 'value', desc: '' }
	],
	desc: 'Get and set Titanium config settings.',
	options: {
		'--json': 'outputs the config as JSON'
	},
	async action({ argv, console }) {
		let { action, key, value } = argv;

		if (!readActions[action] && !writeActions[action]) {
			throw new Error(`Unknown action: ${action}`);
		}

		let { response } = await appcd.call('/appcd/config', {
			data: {
				action: readActions[action] || writeActions[action] || action,
				key: /^titanium\./.test(key) ? key : key ? `titanium.${key}` : 'titanium',
				value
			}
		});

		let result = 'Saved';
		if (response !== 'OK') {
			result = response;
		} else if (argv.json) {
			// if a pop() or shift() returns OK, then that means there's no more items and
			// thus we have to force undefined
			if (/^pop|shift$/.test(action)) {
				result = '';
			}
		}

		if (argv.json) {
			console.log(JSON.stringify({ code: 0, result }, null, 2));
		} else if (result && typeof result === 'object') {
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
			}(result, key ? key.split('.') : []));

			if (rows.length) {
				for (const row of rows) {
					console.log(`${row[0].padEnd(width)} = ${row[1]}`);
				}
			} else {
				console.log('No config settings found');
			}
		} else {
			console.log(result);
		}
	}
};
