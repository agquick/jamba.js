spawnSync = require('child_process').spawnSync

utils = {}

utils.getCommandOutput = (cmd, args, callback, opts={})->
	child = spawnSync(cmd, args, shell: true, input: opts.input)
	output = ""
	err = ""
	callback(child.status, child.stdout, child.stderr, child.error)
	return
	child.stdout.on 'data', (buffer)->
		output += buffer.toString()
	child.stdout.on 'data', (buffer)->
		err += buffer.toString()
	child.on 'close', (code, signal)->
		callback(code, output, err)
	if opts.inputFile?
		child.stdin.write(opts.inputFile.contents)
		child.stdin.end()
		#opts.inputFile.pipe(child.stdin)


module.exports = utils
