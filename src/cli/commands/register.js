import { promptLoop } from '../../lib/prompt';

export default {
	desc: 'Registers an existing app with the Axway platform',
	options: {
		'-d, --project-dir [path]': 'The directory containing the project; defaults to the current directory',
		'--force':                  'Forces an app to be re-registered',
		'--org [guid|id|name]':     'The organization to register the app with'
	},
	async action(ctx) {
		await promptLoop({
			ctx,
			data: {
				cwd:        ctx.data.cwd,
				force:      ctx.argv.force,
				org:        ctx.argv.org,
				projectDir: ctx.argv.projectDir
			},
			path: '/project/register',
			ns: 'cli:register'
		});
	}
};
