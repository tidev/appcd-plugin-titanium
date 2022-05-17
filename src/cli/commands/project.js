import { promptLoop } from '../../lib/prompt';

export default {
	desc: 'Manage project settings',
	options: {
		'-d, --project-dir [path]': 'The directory containing the project; defaults to the current directory'
	},
	async action(ctx) {
		await promptLoop({
			ctx,
			data: {
				cwd:        ctx.data.cwd,
				projectDir: ctx.argv.projectDir
			},
			path: '/project',
			ns: 'cli:project'
		});
	}
};
