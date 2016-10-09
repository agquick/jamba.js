# Jamba

Jamba is an asset module manager for Node.js. It's designed to be used with Rails, but can be used in a standalone manner.

## Quick Start

Install,

```
$ npm install --save agquick/jamba.js
```

Setup your project directory,

```
web/
├── modules/
│   ├── shared/
|		|		├── javascripts/
|		|		├── stylesheets/
|		|		├── views/
|		|		└── images/
│   └── main/
└── gulpfile.js
```

Setup your `gulpfile.js`,

```
gulp = require 'gulp'
jamba = require 'jamba'

# basic configuration
jamba.dest_dir = "../public/assets"


# add a module
jamba.addModule 'shared', (m)->

	# add a project:
	#		- by default, all files in `source_dir` are included,
	#		- use `source` to specify any specific ordering
	m.addProduct 'shared.js', (p)->
		p.source_dir = 'javascripts'
		p.lib 'bootstrap/dist/js/bootstrap.min.js'
		p.source 'init.js.coffee'

	m.addProduct 'shared.css', (p)->
		p.source_dir = 'stylesheets'
		p.lib 'bootstrap/dist/css/boostrap.min.css'
		p.source 'mixins.css.sass'

	m.addProduct 'shared-views.js', (p)->
		p.source_dir = 'views'

	m.addProduct 'images', (p)->
		p.source_dir = 'images'

jamba.registerTasks(gulp)
```

Now build,

```
$ gulp build
```

And watch your sources for changes
```
$ gulp watch
```
