/**
 * Constructs a shim for the `fields` package that translates prompt settings into `enquirer`
 * format.
 *
 * @returns {Object}
 */
export function patch() {
	return {
		setup() {},

		file(opts) {
			return {
				initial: opts.default,
				message: opts.title,
				name:    'foo',
				type:    'text'
			};
		},

		select(opts) {
			const choices = Array.isArray(opts.options) ? opts.options : [].concat(...Object.values(opts.options));
			const formatter = opts.formatters?.option || (option => option[opts.optionLabel || 'label']);

			return {
				choices: choices.map(choice => {
					return {
						message: formatter(choice, '', '').trim(),
						name: choice[opts.optionLabel || 'label'],
						value: choice[opts.optionValue || 'value']
					};
				}),
				initial: opts.default,
				message: opts.title,
				name:    'foo',
				type:    'select'
			};
		},

		text(opts) {
			return {
				initial: opts.default,
				message: opts.title,
				name:    'foo',
				type:    'text'
			};
		}
	};
}
