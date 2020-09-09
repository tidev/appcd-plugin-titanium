import getOSInfo from '../../lib/os';

export default {
	fetch() {
		return getOSInfo();
	},

	render(console, info) {
		const filesize = require('filesize');
		const { cyan, magenta } = require('chalk');

		console.log(magenta('Operating System'.toUpperCase()));
		console.log(`  Name                  = ${cyan(info.name)}`);
		console.log(`  Version               = ${cyan(info.version)}`);
		console.log(`  Architecture          = ${cyan(info.arch === 'x64' ? '64-bit' : '32-bit')}`);
		console.log(`  # CPUs                = ${cyan(info.numcpus)}`);
		console.log(`  Memory                = ${cyan(filesize(info.memory))}`);
		console.log();
	}
};
