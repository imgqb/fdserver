/**
 * merge文件合并
 */

var Path = require('path'),
	utils = require('../utils');

exports = module.exports = function(config) {
	return function merge(req, res, next) {
		if (!config.merge || !req.url) {
			return next();
		}

		var ext = Path.extname(req.url.replace(/\?.*/, '')),
			pattern = ext === '.js' ?  /ImportJavscript\.url\(['"]([^'"]+)['"]\);?/g :
				ext === '.css' ? /@import\s+url\s*\(['"]?\s*([^'"]+)['"]?\s*\)\s*;/g : null;

		if (!pattern) {
			return next();
		}

		// disable cache
		delete req.headers['if-none-match'];
		delete req.headers['if-modified-since'];

		var write = res.write,
			end = res.end,
			list = [];

		res.write = function(chunk) {
			list.push(chunk);
		};

		res.end = function(chunk) {
			chunk && list.push(chunk);

			var buf = Buffer.concat(list),
				str = utils.bufToStr(buf);

			if (pattern.test(str)) {
				mergeStyle(str, pattern, function(e, body) {
					if (e) {
						console.log(e);
					}

					buf = new Buffer(body);
					res.setHeader('Content-Length', buf.length);
					end.call(res, buf);
				});
			} else {
				res.setHeader('Content-Length', buf.length);
				end.call(res, buf);
			}
		};

		next();
	}
};


function mergeStyle(body, pattern, fn) {
	var urls = [];

    body = body.replace(/\/\*[^*]*\*+([^\/*][^*]*\*+)*\//g, '');

	body.replace(pattern, function(m, url) {
		urls.push(url);
	});

	var parts = [];
	utils.getUrlsContent(urls, function(ret) {
		var i;

		for (i = 0, c = ret.length; i < c; i++) {
			var o = ret[i];
			if (o.error) {
				return fn(o.error);
			}
			
			parts.push(o.content);
		}

		i = 0;
		body = body.replace(pattern, function(m, url) {
			var str = utils.bufToStr(parts[i++]);
			return str ? str : m
		});

		fn(null, body);
	});

}

