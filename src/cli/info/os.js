import fs from 'fs';
import os from 'os';

import { arch } from 'appcd-util';
import { isFile } from 'appcd-fs';
import { run } from 'appcd-subprocess';

export default {
	async fetch() {
		const { platform } = process;
		const info = {
			platform,
			name:     'Unknown',
			version:  '',
			arch:     arch(),
			numcpus:  os.cpus().length,
			memory:   os.totalmem()
		};

		switch (platform) {
			case 'darwin':
				{
					const { stdout } = await run('sw_vers');
					let m = stdout.match(/ProductName:\s+(.+)/i);
					if (m) {
						info.name = m[1];
					}
					m = stdout.match(/ProductVersion:\s+(.+)/i);
					if (m) {
						info.version = m[1];
					}
				}
				break;

			case 'linux':
				info.name = 'GNU/Linux';

				if (isFile('/etc/lsb-release')) {
					const contents = fs.readFileSync('/etc/lsb-release', 'utf8');
					let m = contents.match(/DISTRIB_DESCRIPTION=(.+)/i);
					if (m) {
						info.name = m[1].replace(/"/g, '');
					}
					m = contents.match(/DISTRIB_RELEASE=(.+)/i);
					if (m) {
						info.version = m[1].replace(/"/g, '');
					}
				} else if (isFile('/etc/system-release')) {
					const parts = fs.readFileSync('/etc/system-release', 'utf8').split(' ');
					if (parts[0]) {
						info.name = parts[0];
					}
					if (parts[2]) {
						info.version = parts[2];
					}
				}
				break;

			case 'win32':
				{
					const { stdout } = await run('wmic', [ 'os', 'get', 'Caption,Version' ]);
					const s = stdout.split('\n')[1].split(/ {2,}/);
					if (s.length > 0) {
						info.name = s[0].trim() || 'Windows';
					}
					if (s.length > 1) {
						info.version = s[1].trim() || '';
					}
				}
				break;
		}

		return info;
	},

	render(console, info) {
		console.log('Operating System');
		console.log(JSON.stringify(info));
	}
};
