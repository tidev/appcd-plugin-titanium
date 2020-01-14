export default {
	async action({ console, argv }) {
		const { response } = await appcd.call('/sdk/install', {
			data: {
				keep:      argv.keep,
				overwrite: argv.force,
				progress:  argv.progress,
				uri:       argv.version || 'latest'
			}
		});

		return new Promise((resolve, reject) => {
			let tasks = [];

			response
				.on('data', evt => {
					switch (evt && evt.type) {
						case 'tasks':
							tasks = evt.tasks;
							break;

						case 'task-start':
							const name = tasks[evt.task - 1];
							if (name) {
								console.log(`${name}...`);
							}
							break;

						case 'task-progress':
							// evt.progress
							break;

						case 'task-end':
							break;

						default:
							console.log(evt.message || evt);
					}
				})
				.once('end', resolve)
				.once('error', reject);
		});
	},
	args: [
		{
			name: 'version',
			desc: 'The version to install, "latest", URL, or zip file'
		}
	],
	desc: 'Download the latest Titanium SDK or a specific version.',
	options: {
		'-b, --branch [name]': 'The branch to install from or "latest" (stable)',
		'-f, --force': 'Force re-install',
		'-k, --keep': {
			aliases: '!--keep-files',
			desc: 'Keep downloaded files after install'
		},
		'--no-progress': 'Disables progress bars'
	}
};
