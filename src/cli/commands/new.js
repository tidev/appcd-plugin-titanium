export default {
	aliases: '!create',
	desc: 'Create a new project',
	options: {
		'-d, --workspace-dir':   'The directory to place the project in',
		'-f, --force':           'Force project creation even if path already exists',
		'--id [id]':             'A project ID in the format \'com.companyname.appname\'',
		'-n, --name [name]':     'The name of the project',
		'-p, --platform [name]': 'One or more target platforms; defaults to \'all\'',
		'-t, --type [type]':     'The type of project to create',
		'--template [name]':     'The name of a project template, path to a local dir/zip, url, git repo, or npm package',
		'-u, --url [value]':     'Your company/personal URL'
	},
	async action({ argv, console }) {
		const { prompt } = require('enquirer');

		console.log('CREATING NEW PROJECT!');
		console.log(argv);

		// const { response } = await appcd.call('/project/new', {
		// 	data: {
		// 		//
		// 	}
		// });

		// console.log(response);
	}
};
