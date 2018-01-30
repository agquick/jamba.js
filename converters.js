const through = require('through2');
const path = require('path');
const haml = require('haml');
const utils = require('./utils');
const coffee = require('coffee-script');
const sass = require('node-sass');

const converters = {};

converters.sass_convert_old = function(opts) {
	return through.obj( function(file, enc, cb){
		const cargs = ["--from", "sass", "--to", "scss", "--stdin", "--no-cache"];
		const handler = function(code, output, err){
			if (code === 0) {
				file.contents = new Buffer(output);
				file.path = file.path.replace(".sass", ".scss");
			} else {
				console.log(err.toString());
			}
			//console.log file.contents.toString()
			//console.log code
			return cb(null, file);
		};
    return utils.getCommandOutput("sass-convert", cargs, handler, {input: file.contents});
  });
}

converters.sass_convert = function(opts) {
  return through.obj(function(file, enc, cb) {
    const ext = file.path.substring(file.path.length - 5);
    const ret = sass.renderSync({file: file.path, data: file.contents.toString('utf8'), indentedSyntax: (ext == ".sass")});
    file.contents = ret.css
    file.path = file.path.replace(ext, ".css");
    cb(null, file);
  });
}

converters.jhaml_convert = function(opts){
	const { base_path } = opts;
	return through.obj(function(file, enc, cb){
		const rel_path = path.relative(base_path, file.path).replace(".jhaml", "");
		const rel_name = rel_path.replace("/", "-");
		const html = haml.render(file.contents);
		const html_min = html.replace("\n", "").replace(/"/g, '\\"');
		const name = `view-${rel_name}`;
		const jst = `window.JST || window.JST = {}; window.JST['${name}'] = function() { return \"${html_min}\"; };`;
		file.contents = new Buffer(jst);
		file.path = file.path.replace(".jhaml", ".js");
		return cb(null, file);
	});
};

converters.qsc_convert = function(opts={}) {
  const lang = opts.lang || 'coffee'
  return through.obj(function(file, env, cb) {
    var output = "";
    var buffer = "";
    var ib = false;
    var pb = null;

    // parse template
    const text = file.contents.toString('utf8');
    for (var line of text.split("\n")) {
      line = line + "\n";   // add newline back
      if (line.startsWith("<") && !ib) {
        buffer = line;
        ib = true;
      } else if (line.startsWith("</") && ib) {
        buffer += line;
        var td = parseTag(buffer, {includePaths: opts.includePaths});
        if (td.tag_name == "template") {
          pb = `QS.utils.registerTemplate('${td.name}', ${JSON.stringify(td.processed_content)})\n`
        } else if (td.tag_name == "style") {
          pb = `QS.utils.registerStyle(${JSON.stringify(td.processed_content)})\n`
        } else {
          throw new Error("This tag is unknown: " + td.tag_name);
        }
        output += formatLine(pb, lang);
        ib = false;
      } else {
        if (ib) {
          buffer += line;
        } else {
          output += line;
        }
      }
    }

    // parse js
    if (lang == 'coffee') {
      output = coffee.compile(output); 
    }
		file.contents = new Buffer(output);
		file.path = file.path.replace(".qsc", ".js");
    cb(null, file);

  });
}

// helper functions

function parseTagAttribute(tag, attr) {
  if (tag.indexOf(`${attr}=`) == -1) { return null; }
  const p1 = tag.split(`${attr}=\"`)
  const p2 = p1[p1.length-1];
  return p2.split("\"")[0];
}

function parseTag(str, opts={}) {
  var lines = str.split("\n");
  if (lines[lines.length-1] == '') {
    lines = lines.slice(0, -1);
  }
  const tl = lines[0];
  var tname = null;
  var pc = null;

  if (tl.startsWith("<template")) {
    tname = "template";
  } else if (tl.startsWith("<style")) {
    tname = "style";
  }
  const lang = parseTagAttribute(tl, "lang");
  var name = null;
  if (tname == "template") {
    name = parseTagAttribute(tl, "name");
  }
  var content = lines.slice(1, -1).join("\n");
  if (lang == "haml") {
    //content = "%div(title='The title') Here is a div";
    pc = haml.render(content);
  } else if (lang == "sass" || lang == "scss") {
    const indented = lang == "sass";
    pc = sass.renderSync({data: content, indentedSyntax: indented, includePaths: opts.includePaths || []}).css.toString('utf8');
  } else if (lang == "html" || lang == "css") {
    pc = content;
  } else {
    throw new Error("This template language is unknown.");
  }
  return {tag_name: tname, lang: lang, name: name, processed_content: pc}
}

function formatLine(line, lang) {
  if (lang == 'coffee') {
    return line;
  } else {
    return line + ";";
  }
}

module.exports = converters;
