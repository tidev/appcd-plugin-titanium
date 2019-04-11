export default {
	fetch: process.platform === 'darwin' && (async () => (await appcd.call('/ios/1.x/info')).response),
	render(console, info) {
		console.log('iOS');
		console.log('hi from ios info');
	}
};
