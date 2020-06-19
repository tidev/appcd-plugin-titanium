import { promptLoop } from '../../lib/prompt';

export default {
	desc: 'Builds a project',
	options: {
		'-d, --project-dir [path]': 'The directory containing the project; defaults to the current directory',
		'-f, --force':              'Force a full rebuild',
		'-p, --platform [name]':    'The target build platform'
	},
	async action(ctx) {
		await promptLoop({
			ctx,
			data: {
				cwd:          ctx.data.cwd,
				force:        ctx.argv.force,
				platform:     ctx.argv.platform,
				projectDir:   ctx.argv.projectDir
			},
			path: '/project/build',
			ns: 'cli:build'
		});
	}
};
