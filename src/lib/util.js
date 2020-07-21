/**
 * Capitalizes a string.
 *
 * @param {String} str - The string to capitalize.
 * @returns {String}
 */
export function capitalize(str) {
	return typeof str === 'string' ? `${str[0].toUpperCase()}${str.substring(1)}` : str;
}

/**
 * Parses the Titanium CLI version from the user agent.
 *
 * @param {String} userAgent - The Titanium CLI user agent.
 * @returns {String}
 */
export function parseVersion(userAgent) {
	const m = String(userAgent).match(/titanium-cli\/([^ ]+)/);
	return m ? m[1] : userAgent;
}
