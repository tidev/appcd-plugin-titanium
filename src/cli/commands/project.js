export default {
	desc: 'Manage project settings',
	options: {
		'-d, --project-dir [path]': 'The directory containing the project; defaults to the current directory'
	},
	action({ console }) {
		console.log('Project info!');
	}
};
