import install from '../sdk/install';
import list from '../sdk/list';
import select from '../sdk/select';
import uninstall from '../sdk/uninstall';

export default {
	commands: {
		install,
		list,
		select,
		uninstall
	},
	defaultCommand: 'list',
	desc: 'Manage Titanium SDKs.'
};
