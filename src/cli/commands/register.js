import { promptLoop } from '../../lib/prompt';

export default {
	desc: 'Registers an existing app with the Axway platform',
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
			path: '/project/register',
			ns: 'cli:register'
		});
	}
};
