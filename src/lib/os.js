import fs from 'fs';
import os from 'os';

import { arch } from 'appcd-util';
import { isFile } from 'appcd-fs';
import { spawnSync } from 'child_process';

/**
 * Detects operating system information.
 *
 * @returns {Object}
 */
export default function getOSInfo() {
	const info = {
		platform: process.platform,
		name:     'Unknown',
		version:  '',
		arch:     arch(),
		numcpus:  os.cpus().length,
		memory:   os.totalmem()
	};

	switch (process.platform) {
		case 'darwin':
			{
				const stdout = spawnSync('sw_vers').stdout.toString();
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
				const stdout = spawnSync('wmic', [ 'os', 'get', 'Caption,Version' ]).stdout.toString();
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
}
