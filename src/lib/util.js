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
