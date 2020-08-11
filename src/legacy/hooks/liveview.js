exports.init = (logger, config, cli, appc) => {
	cli.on('build.config', data => {
		data.result.liveview = [
			'LiveView Options',
			{
				'--liveview': 'Enables LiveView hot reloading',
				'--liveview-ip [teams]': {
					desc: 'The LiveView server IP address',
					hidden: true
				},
				'--liveview-fport [text]': {
					desc: 'The LiveView file server port',
					hidden: true
				},
				'--liveview-eport [port]': {
					desc: 'The LiveView event server port',
					hidden: true
				}
			}
		];
	});
};
