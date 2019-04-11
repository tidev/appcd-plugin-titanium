import android from '../info/android';
import genymotion from '../info/genymotion';
import ios from '../info/ios';
import jdk from '../info/jdk';
import os from '../info/os';
import titanium from '../info/titanium';
import windows from '../info/windows';

const types = {
	os,
	titanium,
	android,
	genymotion,
	ios,
	jdk,
	windows
};

export default {
	async action({ console, argv }) {
		console.log(argv);

		const selectedTypes = argv.types === 'all' ? 'all' : argv.types.split(',');
		const results = {};

		// load the data
		await Promise.all(
			Object
				.entries(types)
				.filter(([ type ]) => selectedTypes === 'all' || selectedTypes.includes(type))
				.map(async ([ type, obj ]) => {
					try {
						results[type] = await obj.fetch(argv);
					} catch (err) {
						results[type] = err;
					}
				})
		);

		if (argv.json) {
			console.log(JSON.stringify(results, null, '  '));
		} else {
			// render
			for (const type of Object.keys(results)) {
				types[type].render(console, results[type]);
			}
		}
	},
	desc: 'Display development environment information',
	options: {
		'--json': 'output info as JSON',

		// for backwards compatibility
		'-o, --output <format>': {
			hidden: true
		},

		'-t, --types <types>': {
			default: 'all',
			desc: 'information types to display; you may select one or more',
			values: [ 'all' ].concat(Object.keys(types))
		}
	}
};
