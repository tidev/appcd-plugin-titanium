import install from '../sdk/install';
import list from '../sdk/list';
import select from '../sdk/select';
import uninstall from '../sdk/uninstall';

export default {
	action: list.action,
	commands: {
		install,
		list,
		select,
		uninstall
	},
	desc: 'Manage Titanium SDKs.'
};
