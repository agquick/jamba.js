/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { spawnSync } = require('child_process');

const utils = {};

utils.getCommandOutput = function(cmd, args, callback, opts){
	if (opts == null) { opts = {}; }
	const child = spawnSync(cmd, args, {shell: true, input: opts.input});
	let output = "";
	let err = "";
	callback(child.status, child.stdout, child.stderr, child.error);
	return;
	child.stdout.on('data', buffer=> output += buffer.toString());
	child.stdout.on('data', buffer=> err += buffer.toString());
	child.on('close', (code, signal)=> callback(code, output, err));
	if (opts.inputFile != null) {
		child.stdin.write(opts.inputFile.contents);
		return child.stdin.end();
	}
};
		//opts.inputFile.pipe(child.stdin)


module.exports = utils;

