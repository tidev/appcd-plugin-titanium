import DetectEngine from 'appcd-detect';
import fs from 'fs-extra';
import gawk from 'gawk';
import globalModules from 'global-modules';
import path from 'path';
import { DataServiceDispatcher } from 'appcd-dispatcher';
import { mergeDeep } from 'appcd-util';
import { templates } from 'titaniumlib';

/**
 * Detects global Titanium project templates.
 */
export default class TemplateService extends DataServiceDispatcher {
	/**
	 * Starts detecting templates.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async activate() {
		const keywordRE = /^titanium-(?:(\w*)-)?template$/;

		this.detectEngine = new DetectEngine({
			checkDir(dir) {
				try {
					const pkg = fs.readJsonSync(path.join(dir, 'package.json'));
					for (const keyword of pkg.keywords) {
						const m = keyword.match(keywordRE);
						if (m) {
							return {
								name: pkg.name,
								desc: pkg.description,
								path: dir,
								pkg,
								type: m[1] || undefined
							};
						}
					}
				} catch (e) {
					// 'dir' is not a template
				}
			},
			depth:    2, // allow for scoped packages
			multiple: true,
			name:     'titanium:templates',
			paths:    [ globalModules ],
			processResults(results) {
				results.sort((a, b) => {
					return a.name.localeCompare(b.name);
				});
			},
			redetect:            true,
			watch:               true
		});

		const format = results => {
			const data = mergeDeep({}, templates);
			for (const template of results) {
				let type = template.type || 'other';
				if (!data[type]) {
					data[type] = [];
				}
				data[type].push(template);
			}
			return data;
		};

		this.detectEngine.on('results', results => gawk.set(this.data, format(results)));
		this.data = gawk(format(await this.detectEngine.start()));
	}

	/**
	 * Stops the detect engine.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async deactivate() {
		if (this.detectEngine) {
			await this.detectEngine.stop();
			this.detectEngine = null;
		}
	}
}
