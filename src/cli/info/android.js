export default {
	async fetch() {
		return (await appcd.call('/android/1.x/info')).response;
	},
	render(console, info) {
		console.log('Android');
		console.log('hi from android info');
	}
};
