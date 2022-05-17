import { promptLoop } from '../../lib/prompt';

export default {
	desc: 'Add a component or service to a project',
	options: {
		'-d, --project-dir [path]': 'The directory containing the project; defaults to the current directory'
	},
	async action(ctx) {
		await promptLoop({
			ctx,
			data: {
				cwd: ctx.data.cwd,
				...ctx.argv
			},
			path: '/project/add',
			ns: 'cli:add'
		});
	}
};
