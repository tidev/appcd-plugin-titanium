export function patch() {
	const dummy = { prompt() {} };
	return {
		setup() {},
		file: () => dummy,
		select: () => dummy,
		text: () => dummy
	};
}
