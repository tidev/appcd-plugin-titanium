export default {
	async action({ console, data }) {
		const fetch = async type => ({
			type,
			results: (await appcd.call(`/${type}/1.x/info`)).response
		});

		const tasks = [
			{
				type: 'os',
				results: {
					name: 'macOS'
				}
			},
			{
				type: 'titanium',
				results: {
					cliVer: data.userAgent,
					pluginVer: data.version
				}
			},
			fetch('android'),
			fetch('ios'),
			fetch('jdk')
		];

		await tasks.reduce((promise, info) => {
			return promise
				.then(async () => {
					const result = await info;
					console.log(result);
				});
		}, Promise.resolve());
	},
	desc: 'Display development environment information'
};
