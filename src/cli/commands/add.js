export default {
	desc: 'Add a component to a project',
	options: {
		'-d, --project-dir [path]': 'The directory containing the project; defaults to the current directory'
	},
	action({ console }) {
		console.log('Add!');
	}
};
