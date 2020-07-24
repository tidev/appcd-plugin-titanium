/**
 * Installr integration ported from https://github.com/jeffbonnes/appc-app-preview-cli-hook.
 * Jeff Bonnes <jeffb@geeksinc.com.au>, MIT License
 * Installr API docs: https://help.installrapp.com/api/
 *
 * This is the App Preview CLI and validation code. The App Preview Titanium CLI plugin is located
 * in `src/legacy/hooks/app-preview-hook.js`.
 */

const { log } = appcd.logger('app-preview');
const { highlight } = appcd.logger.styles;

export const endpoint = 'https://appbeta.axway.com';

export const options = [
	'App Preview Options',
	{
		'--app-preview':              'Deploy a build to App Preview',
		'--add [teams]':              'A comma-separated list of team names to add access to the App Preview build',
		'--release-notes [text]':     'Release notes for the App Preview build',
		'--invite [email_addresses]': 'A comma-separated list of email addresses to send the App Preview invites to',
		'--notify [teams]':           'A comma-separated list of team names that have been previously invited to notify of App Preview build'
	}
];

function INVALID_ARGUMENT({ msg, code, prompt }) {
	const err = new TypeError(msg);
	if (code !== undefined) {
		err.code = code;
	}
	if (prompt !== undefined) {
		err.prompt = prompt;
	}
	return err;
}

export async function validate(argv) {
	if (!argv.appPreview) {
		return;
	}

	const { response: account } = await appcd.call('/amplify/1.x/auth/active');

	if (!account) {
		throw new Error('App Preview requires you to be logged in\nPlease login by running: ti login');
	}

	if (!account.org?.entitlements?.appPreview) {
		// eslint-disable-next-line no-throw-literal
		const err = new Error('Your account is not entitled to use App Preview');
		err.code = 'ENOTENT';
		err.details = `Your current organization is ${highlight(`"${account.org.name}"`)}.\n`;
		if (account.orgs.length > 1) {
			err.details += `If this is not the correct organization, run ${highlight('"ti switch"')} to change to another organization.\n`;
		}
		err.details += 'To upgrade your account, visit https://billing.axway.com/.';
		err.showHelp = false;
		throw err;
	}

	log(`Active account org ${highlight(`"${account.org.name}"`)} is entitled to App Preview!`);

	if (argv.releaseNotes === undefined) {
		throw INVALID_ARGUMENT({
			msg: 'Expected App Preview release notes or path to release notes file',
			prompt: {
				message: 'Please enter release notes or a path to a release notes file',
				name:    'releaseNotes',
				type:    'text'
			}
		});
	}

	if (argv.notify === undefined) {
		throw INVALID_ARGUMENT({
			msg: 'Expected App Preview notification preference',
			prompt: {
				disabled: 'No',
				enabled:  'Yes',
				initial:  true,
				message:  'Do you want to notify previous testers on upload?',
				name:     'notify',
				required: true,
				type:     'toggle'
			}
		});
	}
}
