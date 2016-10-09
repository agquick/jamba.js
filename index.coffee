concat = require 'gulp-concat'
coffee = require 'gulp-coffee'
tap = require 'gulp-tap'
sass = require 'gulp-sass'
path = require 'path'

converters = require './converters'

class Jamba
	constructor: ->
		@modules = {}
		@module_dir = "modules"
		@dest_dir = "dist"
		@taps = []
		coffee_tap = (file, t, product)->
			if path.extname(file.path) == '.coffee'
				return t.through(coffee, [])
		sass_tap = (file, t, product)->
			if path.extname(file.path) == '.sass'
				return t.through(converters.sass_convert, [])
		sass_tap.tap_name = "sass_tap"
		jhaml_tap = (file, t, product)->
			if path.extname(file.path) == '.jhaml'
				return t.through(converters.jhaml_convert, [{base_path: product.source_path()}])
		@taps.push(coffee_tap)
		@taps.push(sass_tap)
		@taps.push(jhaml_tap)
	addModule : (name, cb)->
		mod = new JambaModule(this, name)
		cb(mod)
		@modules[name] = mod
	registerTasks : (gulp)->
		@gulp = gulp
		bts = []
		wts = []
		for mname, mod of @modules
			mod.registerTasks(gulp)
			bts.push(mod.name)
			wts.push("watch-#{mod.name}")
		gulp.task "build", bts
		gulp.task "watch", wts

class JambaModule
	constructor: (@jamba, @name)->
		@products = {}
	source_dir : ->
		return "#{@jamba.module_dir}/#{@name}"
	addProduct : (name, cb)->
		p = new JambaProduct(this, name)
		cb?(p)
		@products[name] = p
	dest_dir : ->
		"#{@jamba.dest_dir}/#{@name}"
	registerTasks : (gulp)->
		names = []
		wnames = []
		for pname, product of @products
			names.push product.registerBuildTask(gulp)
			wnames.push product.registerWatchTask(gulp)
		gulp.task @name, names
		gulp.task "watch-#{@name}", wnames

class JambaProduct
	constructor: (@module, @name)->
		@source_dir = '.'
		@libs = []
		@sources = []
	lib : (files...)->
		@libs.push(files...)
	source : (files...)->
		@sources.push(files...)
	taskName : ->
		"#{@module.name}-#{@name}"
	orderedFiles : ->
		files = []
		for lib in @libs
			files.push("node_modules/#{lib}")
		for source in @sources
			files.push("#{@module.source_dir()}/#{@source_dir}/#{source}")
		files.push("#{@module.source_dir()}/#{@source_dir}/**/*")
		return files
	dest : ->
		return "#{@module.dest_dir()}/#{@name}"
	source_path : ->
		"#{@module.source_dir()}/#{@source_dir}"
	type : ->
		if path.extname(@name) == '.js'
			return "javascript"
		else if path.extname(@name) == '.css'
			return "stylesheet"
		else
			return "directory"
	registerBuildTask : (gulp)->
		jamba = @module.jamba
		type = @type()
		task_name = @taskName()
		product = this
		gulp.task task_name, =>
			#console.log @orderedFiles()
			console.log "Buildling #{@name} in #{@module.name} to #{@dest()}"
			gt = gulp.src(@orderedFiles())
			jamba.taps.forEach (jt)->
				gt = gt.pipe(tap ((file, t)-> return jt(file, t, product)) )
			if type == 'directory'
				gt = gt.pipe(gulp.dest(@dest()))
			else
				gt = gt.pipe(concat(@name))
				if type == 'stylesheet'
					gt = gt.pipe(sass(includePaths: [@source_path()]))
				gt = gt.pipe(gulp.dest(@module.dest_dir()))
		return task_name
	registerWatchTask : (gulp)->
		tn = @taskName()
		wtn = "watch-#{tn}"
		gulp.task wtn, =>
			#console.log "Watching #{@name}..."
			gulp.watch(@orderedFiles(), [tn])
		return wtn

module.exports = new Jamba()

