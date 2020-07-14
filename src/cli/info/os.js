import getOSInfo from '../../lib/os';

export default {
	fetch() {
		return getOSInfo();
	},

	render(console, info) {
		const filesize = require('filesize');
		const { bold, magenta } = require('chalk');

		console.log(bold('Operating System'));
		console.log(`  Name                  = ${magenta(info.name)}`);
		console.log(`  Version               = ${magenta(info.version)}`);
		console.log(`  Architecture          = ${magenta(info.arch === 'x64' ? '64-bit' : '32-bit')}`);
		console.log(`  # CPUs                = ${magenta(info.numcpus)}`);
		console.log(`  Memory                = ${magenta(filesize(info.memory))}`);
		console.log();
	}
};
