through = require 'through2'
path = require 'path'
haml = require 'hamljs'
utils = require './utils'

converters = {}

converters.sass_convert = (opts)->
	return through.obj (file, enc, cb)->
		cargs = ["--from", "sass", "--to", "scss", "--stdin", "--no-cache"]
		handler = (code, output, err)->
			if code == 0
				file.contents = new Buffer(output)
				file.path = file.path.replace(".sass", ".scss")
			else
				console.log err.toString()
			#console.log file.contents.toString()
			#console.log code
			cb(null, file)
		utils.getCommandOutput "sass-convert", cargs, handler, {input: file.contents}
		#file.contents = new Buffer("test")
		#file.path = file.path.replace(".sass", ".scss")
		#cb(null, file)
		#handler(0, "test2")

converters.jhaml_convert = (opts)->
	base_path = opts.base_path
	return through.obj (file, enc, cb)->
		rel_path = path.relative(base_path, file.path).replace(".jhaml", "")
		rel_name = rel_path.replace("/", "-")
		html = haml.render(file.contents)
		html_min = html.replace("\n", "").replace(/"/g, '\\"')
		name = "view-#{rel_name}"
		jst = "window.JST || window.JST = {}; window.JST['#{name}'] = function() { return \"#{html_min}\"; };"
		file.contents = new Buffer(jst)
		file.path = file.path.replace(".jhaml", ".js")
		cb(null, file)


module.exports = converters
