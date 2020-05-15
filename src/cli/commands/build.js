export default {
	desc: 'Builds a project',
	options: {
		'-d, --project-dir [path]': 'The directory containing the project; defaults to the current directory',
		'-f, --force': 'Force a full rebuild',
		'-p, --platform [name]': 'The target build platform'
	},
	action({ console }) {
		console.log('Building!');

		// read the tiapp
		// load the sdk
		// validate
		// run the build logic
	}
};
