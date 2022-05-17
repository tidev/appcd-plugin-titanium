import ProgressBar from 'progress';

import { ansi } from 'cli-kit';
import { arrowRight, bullet, tick } from 'figures';

const { log } = appcd.logger('sdk:install');
const { alert, cyan, gray, green, highlight } = appcd.logger.styles;

export default {
	async action({ argv, console, terminal }) {
		const { response } = await appcd.call('/sdk/install', {
			data: {
				keep:      argv.keep,
				overwrite: argv.force,
				progress:  argv.progress,
				uri:       argv.version || 'latest'
			}
		});

		try {
			if (argv.progress) {
				terminal.stderr.write(ansi.cursor.hide);
			}

			await new Promise((resolve, reject) => {
				let bar = null;
				let tasks = [];
				const tokens = {};

				response
					.on('data', evt => {
						if (!evt || typeof evt !== 'object') {
							return;
						}

						try {
							switch (evt.type) {
								case 'tasks':
									tasks = evt.tasks;
									log('Received tasks:', tasks);
									break;

								case 'task-start':
								{
									const name = tasks[evt.task - 1] || null;
									log(`Starting task: ${highlight(name)}`);

									if (argv.progress) {
										tokens.name = name;
										tokens.paddedPercent = '  0%';
										tokens.symbol = cyan(arrowRight);

										if (evt.hasProgress) {
											bar = new ProgressBar(' :symbol :name  :paddedPercent [:bar]', {
												clear:      true,
												complete:   cyan('='),
												incomplete: gray('.'),
												stream:     terminal.stderr,
												total:      100,
												width:      40
											});
											bar.render(tokens);
										} else {
											terminal.stderr.write(` ${tokens.symbol} ${name}`);
										}
									} else {
										console.log(` ${green(bullet)} ${name}...`);
									}
									break;
								}

								case 'task-progress':
									if (bar) {
										tokens.paddedPercent = (evt.progress * 100).toFixed(0).padStart(3) + '%';
										bar.update(evt.progress, tokens);
									}
									break;

								case 'task-end':
								default:
								{
									if (bar || evt.type === 'task-end') {
										terminal.stderr.cursorTo(0);
										terminal.stderr.clearLine();
										bar = null;
									}

									if (evt.type === 'task-end') {
										const name = tasks[evt.task - 1] || null;
										log(`Finished task: ${highlight(name)}`);
										console.log(` ${green(tick)} ${name}`);
									} else if (evt instanceof Error) {
										console.error(`\n${alert(`Error: ${evt.message}`)}`);
									} else {
										console.log(`\n${evt.message || evt}`);
									}
									break;
								}
							}
						} catch (e) {
							reject(e);
						}
					})
					.once('end', resolve)
					.once('error', reject);
			});
		} finally {
			if (argv.progress) {
				terminal.stderr.write(ansi.cursor.show);
			}
		}
	},
	aliases: [ 'i' ],
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
