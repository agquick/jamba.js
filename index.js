/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const concat = require('gulp-concat');
const coffee = require('gulp-coffee');
const tap = require('gulp-tap');
const sass = require('gulp-sass');
const path = require('path');

const converters = require('./converters');

class Jamba {
	constructor() {
		this.modules = {};
		this.moduleDir = "modules";
		this.destDir = "dist";
		this.taps = [];
		const coffee_tap = function(file, t, product){
			if (path.extname(file.path) === '.coffee') {
				return t.through(coffee, []);
			}
		};
		const sass_tap = function(file, t, product){
			if (path.extname(file.path) === '.sass') {
				return t.through(converters.sass_convert, []);
			}
		};
		sass_tap.tap_name = "sass_tap";
		const jhaml_tap = function(file, t, product){
			if (path.extname(file.path) === '.jhaml') {
				return t.through(converters.jhaml_convert, [{base_path: product.source_path()}]);
			}
		};
    const qsc_tap = function(file, t, product) {
      if (path.extname(file.path) === ".qsc") {
        return t.through(converters.qsc_convert, []);
      }
    }
		this.taps.push(coffee_tap);
		this.taps.push(sass_tap);
		this.taps.push(jhaml_tap);
		this.taps.push(qsc_tap);
	}
	addModule(name, cb){
		const mod = new JambaModule(this, name);
		cb(mod);
		return this.modules[name] = mod;
	}
	registerTasks(gulp){
		this.gulp = gulp;
		const bts = [];
		const wts = [];
		for (let mname in this.modules) {
			const mod = this.modules[mname];
			mod.registerTasks(gulp);
			bts.push(`build-${mod.name}`);
			wts.push(`watch-${mod.name}`);
		}
		gulp.task("build-jamba", bts);
		gulp.task("watch-jamba", wts);
	}
}

class JambaModule {
	constructor(jamba, name){
		this.jamba = jamba;
		this.name = name;
		this.products = {};
	}
	get sourceDir() {
		return `${this.jamba.moduleDir}/${this.name}`;
	}
	addProduct(name, cb){
		const p = new JambaProduct(this, name);
		if (typeof cb === 'function') {
			cb(p);
		}
		return this.products[name] = p;
	}
	get destDir() {
		return `${this.jamba.destDir}/${this.name}`;
	}
	registerTasks(gulp){
		const names = [];
		const wnames = [];
		for (let pname in this.products) {
			const product = this.products[pname];
			names.push(product.registerBuildTask(gulp));
			wnames.push(product.registerWatchTask(gulp));
		}
		gulp.task(`build-${this.name}`, names);
		gulp.task(`watch-${this.name}`, wnames);
	}
}

class JambaProduct {
	constructor(module, name){
		this.module = module;
		this.name = name;
		this.sourceDir = '.';
		this.libs = [];
		this.sources = [];
	}
	lib(...files){
		return this.libs.push(...Array.from(files || []));
	}
	source(...files){
		return this.sources.push(...Array.from(files || []));
	}
	get taskName() {
		return `${this.module.name}-${this.name}`;
	}
	orderedFiles() {
		const files = [];
		for (let lib of Array.from(this.libs)) {
			files.push(`node_modules/${lib}`);
		}
		for (let source of Array.from(this.sources)) {
			files.push(`${this.module.sourceDir}/${this.sourceDir}/${source}`);
		}
		files.push(`${this.module.sourceDir}/${this.sourceDir}/**/*`);
		return files;
	}
	get dest() {
		return `${this.module.destDir}/${this.name}`;
	}
	sourcePath() {
		return `${this.module.sourceDir}/${this.sourceDir}`;
	}
	type() {
		if (path.extname(this.name) === '.js') {
			return "javascript";
		} else if (path.extname(this.name) === '.css') {
			return "stylesheet";
		} else {
			return "directory";
		}
	}
	registerBuildTask(gulp){
		const { jamba } = this.module;
		const type = this.type();
		const task_name = `build-${this.taskName}`;
		const product = this;
		gulp.task(task_name, () => {
			//console.log @orderedFiles()
			console.log(`Buildling ${this.name} in ${this.module.name} to ${this.dest}`);
			let gt = gulp.src(this.orderedFiles());
			jamba.taps.forEach(jt=> gt = gt.pipe(tap(((file, t)=> jt(file, t, product))) ));
			if (type === 'directory') {
				return gt = gt.pipe(gulp.dest(this.dest));
			} else {
				gt = gt.pipe(concat(this.name));
				if (type === 'stylesheet') {
					gt = gt.pipe(sass({includePaths: [this.sourcePath]}));
				}
				return gt = gt.pipe(gulp.dest(this.module.destDir));
			}
		});
		return task_name;
	}
	registerWatchTask(gulp){
		const tn = `watch-${this.taskName}`;
		gulp.task(tn, () => {
			//console.log "Watching #{@name}..."
			return gulp.watch(this.orderedFiles(), [`build-${this.taskName}`]);
		});
		return tn;
	}
}

module.exports = new Jamba();


