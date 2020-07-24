import { options as appPreviewOptions } from '../../lib/app-preview';
import { promptLoop } from '../../lib/prompt';

export default {
	desc: 'Builds a project',
	options: [
		{
			'-d, --project-dir [path]': 'The directory containing the project; defaults to the current directory',
			'-f, --force':              'Force a full rebuild',
			'-p, --platform [name]':    'The target build platform'
		},
		...appPreviewOptions
	],
	async action(ctx) {
		await promptLoop({
			ctx,
			data: {
				...ctx.argv,
				cwd: ctx.data.cwd
			},
			path: '/project/build',
			ns:   'cli:build'
		});
	}
};
