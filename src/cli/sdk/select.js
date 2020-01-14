export default {
	action({ console }) {
		const { cyan } = require('chalk');
		console.log('The "select" command is no longer required.');
		console.log(`Simply set the ${cyan('"<sdk-version>"')} in your tiapp.xml.`);
	},
	hidden: true
};
