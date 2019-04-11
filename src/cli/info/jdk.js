export default {
	async fetch() {
		return (await appcd.call('/jdk/1.x/info')).response;
	},
	render(console, info) {
		console.log('Java Development Kit');
		console.log('hi from jdk info');
	}
};
