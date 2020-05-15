export default {
	aliases: '!create',
	desc: 'Create a new project',
	options: {
		'-d, --workspace-dir': 'The directory to place the project in',
		'-f, --force': 'Force project creation even if path already exists',
		// '--id <id>'
		// '--url <url>'
		// '--name <name>'
		'--template <name>': '?',
		'-t, --type <name>': {
			default: 'app',
			desc: 'The type of project to create'
		}
	},
	action({ console }) {
		console.log('Hi from new');
	}
};
