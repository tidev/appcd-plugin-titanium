import { parseVersion } from '../../lib/util';

export default {
	async fetch(data) {
		return {
			cli: {
				version: parseVersion(data.userAgent)
			},
			plugin: {
				version: data.pluginVersion
			},
			sdks: (await appcd.call('/sdks')).response
		};
	},
	render(console, info) {
		console.log('Titanium CLI');
		console.log('hi from titanium cli info');

		console.log('Titanium SDK');
		console.log('hi from titanium sdk info');
	}
};
