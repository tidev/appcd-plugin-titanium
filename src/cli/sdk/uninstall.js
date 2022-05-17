import { codes } from 'appcd-response';
import { unique } from 'appcd-util';

export default {
	async action({ console, argv }) {
		try {
			const { highlight } = appcd.logger.styles;
			const { response } = await appcd.call('/sdk/uninstall', { data: { uri: argv.version } });
			console.log(`Titanium SDK ${unique(response.map(r => highlight(r.name))).sort().join(', ')} uninstalled`);
		} catch (e) {
			if (e.status === codes.NOT_FOUND) {
				console.error(e.message);
			} else {
				throw e;
			}
		}
	},
	aliases: [ 'rm' ],
	args: [
		{
			name: 'version',
			desc: 'The version to uninstall',
			required: true
		}
	],
	desc: 'Remove a specific Titanium SDK version.'
};
