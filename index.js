/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const concat = require('gulp-concat');
const tap = require('gulp-tap');
const path = require('path');
const plumber = require('gulp-plumber');
const gutil = require('gulp-util');
const fs = require('fs');
const glob = require('glob');
const uglify = require('gulp-uglify');

const converters = require('./converters');

class Jamba {
  constructor() {
    this.modules = {};
    this.moduleDir = "modules";
    this.destDir = "dist";
    this.converters = [];
    this.converters.push(new converters.CoffeeConverter());
    this.converters.push(new converters.SassConverter());
    this.converters.push(new converters.QscConverter());
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
    this.jamba = module.jamba;
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
  orderedFiles(opts={}) {
    var use_globs = opts.globs == true;
    var files = [];
    // lib files
    for (let lib of Array.from(this.libs)) {
      const fp = `node_modules/${lib}`;
      if (!fs.existsSync(fp)) {
        throw new Error(`Library file ${lib} could not be found.`);
      }
      files.push(fp);
    }
    // source files
    for (let source of Array.from(this.sources)) {
      const fp = `${this.module.sourceDir}/${this.sourceDir}/${source}`;
      if (!fs.existsSync(fp)) {
        throw new Error(`Source file ${source} could not be found.`);
      }
      files.push(fp);
    }
    // ordered glob files
    var gp = `${this.module.sourceDir}/${this.sourceDir}/**/*.*`;
    if (!use_globs) {
      var gfiles = glob.sync(gp).sort();
      files = files.concat(gfiles);
    } else {
      files.push(gp);
    }
    //console.log(files);
    return files;
  }
  get dest() {
    return `${this.module.destDir}/${this.name}`;
  }
  get sourcePath() {
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
      console.log(`Building ${this.name} in ${this.module.name} to file ${this.dest}`);
      let gt = gulp.src(this.orderedFiles({globs: false}));
      for(let jc of jamba.converters) {
        gt = gt.pipe( tap(function(file, t) {
          jc.tap(file, t, product);
        }));
      };
      if (type === 'directory') {
        return gt = gt.pipe(gulp.dest(this.dest));
      } else {
        // minify if set
        if (product.minify == true) {
          gt = gt.pipe(uglify(product.minifyOptions || {}));
        }
        gt = gt.pipe(concat(this.name));
        return gt = gt.pipe(gulp.dest(this.module.destDir));
      }
    });
    return task_name;
  }
  registerWatchTask(gulp){
    const tn = `watch-${this.taskName}`;
    const btn = `build-${this.taskName}`;
    gulp.task(tn, () => {
      //console.log "Watching #{@name}..."
      return gulp.watch(this.orderedFiles({globs: true}), ()=> {
        setTimeout(()=> {
          gulp.start(btn);
        }, 100);
      });
    });
    return tn;
  }
}

module.exports = new Jamba();


