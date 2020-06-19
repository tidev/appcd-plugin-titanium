import { promptLoop } from '../../lib/prompt';

export default {
	desc: 'Remove previous build directories',
	options: {
		'-d, --project-dir [path]': 'The directory containing the project; defaults to the current directory',
		'-p, --platforms [names]':  'A comma separated list of platforms; defaults to all platforms'
	},
	async action(ctx) {
		await promptLoop({
			ctx,
			data: {
				cwd:        ctx.data.cwd,
				platforms:  ctx.argv.platforms,
				projectDir: ctx.argv.projectDir
			},
			path: '/project/clean',
			ns: 'cli:clean'
		});
	}
};
