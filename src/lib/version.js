import semver from 'semver';

function format(ver, min, max, chopDash) {
	ver = ('' + (ver || 0));
	if (chopDash) {
		ver = ver.replace(/(-.*)?$/, '');
	}
	ver = ver.split('.');
	if (min !== undefined) {
		while (ver.length < min) {
			ver.push('0');
		}
	}
	if (max !== undefined) {
		ver = ver.slice(0, max);
	}
	return ver.join('.');
}

export function eq(v1, v2) {
	return semver.eq(format(v1, 3, 3), format(v2, 3, 3));
}

export function gte(v1, v2) {
	return semver.gte(format(v1, 3, 3), format(v2, 3, 3));
}

export function gt(v1, v2) {
	return semver.gt(format(v1, 3, 3), format(v2, 3, 3));
}

export function lte(v1, v2) {
	return semver.lte(format(v1, 3, 3), format(v2, 3, 3));
}

export function lt(v1, v2) {
	return semver.lt(format(v1, 3, 3), format(v2, 3, 3));
}

export function compare(v1, v2) {
	return eq(v1, v2) ? 0 : lt(v1, v2) ? -1 : 1;
}

export function rcompare(v1, v2) {
	return eq(v1, v2) ? 0 : lt(v1, v2) ? 1 : -1;
}

export function satisfies(ver, str) {
	ver = format(ver, 3, 3, true);
	str = str.replace(/(<=?\d+(\.\d+)*?)\.x/g, '$1.99999999').replace(/(>=?\d+(\.\d+)*?)\.x/g, '$1.0');
	try {
		if (str === '*' || eq(ver, str)) {
			return true;
		}
	} catch (ex) {
		// squelch
	}

	return str.split(/\s*\|\|\s*/).some(function (range) {
		// semver is picky with the '-' in comparisons and it just so happens when it
		// parses versions in the range, it will add '-0' and cause '1.0.0' != '1.0.0-0',
		// so we test our version with and without the '-9'
		return range === '*' || semver.satisfies(ver, range) || (ver.indexOf('-') === -1 && semver.satisfies(ver + '-0', range));
	});
}

export function parseMax(str, allowX) {
	let max, lt;

	for (const range of str.split(/\s*\|\|\s*/)) {
		let x = range.split(' ');
		x = x.length === 1 ? x.shift() : x.slice(1).shift();
		allowX || (x = x.replace(/.x$/i, ''));
		const y = x.replace(allowX ? /[^.xX\d]/g : /[^.\d]/g, '');
		if (!max || exports.gt(y, max)) {
			lt = /^<[^=]\d/.test(x);
			max = y.replace(/\.$/, '');
		}
	}

	return (lt ? '<' : '') + max;
}

export function parseMin(str) {
	let min;

	for (const range of str.split(/\s*\|\|\s*/)) {
		const x = range.split(' ').shift().replace(/[^.\d]/g, '');
		if (!min || exports.lt(x, min)) {
			min = x.replace(/\.$/, '');
		}
	}

	return min;
}
