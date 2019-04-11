export default {
	fetch: process.platform === 'win32' && (async () => (await appcd.call('/windows/1.x/info')).response),
	render(console, info) {
		console.log('Windows');
		console.log('hi from windows info');
	}
};
