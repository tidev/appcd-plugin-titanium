import { promptLoop } from '../../lib/prompt';

export default {
	aliases: '!create',
	desc: 'Create a new project',
	options: {
		'-d, --workspace-dir [path]': 'The directory to place the project in',
		'-f, --force':                'Force project creation even if path already exists',
		'--id [id]':                  'A project ID in the format \'com.companyname.appname\'',
		'-n, --name [name]':          'The name of the project',
		'--template [name]':          'The name of a project template, path to a local dir/zip, url, git repo, or npm package'
	},
	async action(ctx) {
		const { blue, bold, cyan, green, note } = appcd.logger.styles;

		await promptLoop({
			ctx,
			data: {
				cwd:          ctx.data.cwd,
				force:        ctx.argv.force,
				id:           ctx.argv.id,
				name:         ctx.argv.name,
				template:     ctx.argv.template,
				workspaceDir: ctx.argv.workspaceDir
			},
			header: `${bold(blue('Welcome! Let\'s create a new Titanium project!'))}
First, we need to ask you a few questions about your project:
`,
			footer: proj => proj && `
${green('Success!')}

Next steps:

  ${cyan(`cd ${proj.name}`)}
  ${cyan('ti run -p android')}
  ${note(' or ')}
  ${cyan('ti run -p ios')}

For help, visit: https://docs.axway.com/category/appdev
` || `
Failed to create project!
`,
			path: '/project/new',
			ns: 'cli:new'
		});
	}
};
