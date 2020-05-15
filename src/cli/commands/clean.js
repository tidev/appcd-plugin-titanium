export default {
	desc: 'Remove previous build directories',
	options: {
		'-d, --project-dir [path]': 'The directory containing the project; defaults to the current directory',
		'-p, --platforms [names]': 'One or more platforms to clean or empty for all'
	},
	action({ console }) {
		// read the tiapp
		// load the sdk
		// validate the platform names
		// run the clean logic

		console.log('Cleaning!');
	}
};
