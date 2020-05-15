export default {
	desc: 'Build and runs a project',
	options: {
		'--build-only': 'Builds the project without running it in the simulator/emulator or installing it on device',
		'-d, --project-dir [path]': 'The directory containing the project; defaults to the current directory',
		'-f, --force': 'Force a full rebuild',
		'-p, --platform [name]': 'The target build platform'
	},
	action({ console }) {
		console.log('Building and running!');

		// read the tiapp
		// load the sdk
		// validate
		// run the build logic
		// run the app
	}
};
