export default {
	async fetch() {
		return (await appcd.call('/genymotion/1.x/info')).response;
	},
	render(console, info) {
		console.log('Genymotion');
		console.log('hi from genymotion info');
	}
};
