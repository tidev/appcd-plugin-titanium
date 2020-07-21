/**
 * A helper function that creates an error and defines an optional code and prompt metadata.
 *
 * @param {Object} opts - Various options.
 * @param {String} [opts.code] - A custom error code. This value should begin with an `E`.
 * @param {String} opts.message - The error message.
 * @param {Object} [opts.option] - A CLI option to autogenerate the prompt metadata from.
 * @param {Object} [opts.prompt] - Prompt metadata.
 * @returns {Error}
 */
export function INVALID_ARGUMENT({ code, msg, option, prompt }) {
	const err = new TypeError(msg);
	if (code !== undefined) {
		err.code = code;
	}
	if (option?.values) {
		err.prompt = {
			choices:  option.values.map(value => ({ value })),
			message:  `Please select a valid ${option.name} value`,
			name:     option.name,
			required: true,
			type:     'select'
		};
	} else if (option) {
		err.prompt = {
			message:  `Please enter a valid ${option.name}`,
			name:     option.name,
			required: true,
			type:     'text'
		};
	} else if (prompt !== undefined) {
		err.prompt = prompt;
	}
	return err;
}
