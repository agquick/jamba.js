const through = require('through2');
const path = require('path');
const haml = require('haml');
const utils = require('./utils');
const coffee = require('coffee-script');
const sass = require('node-sass');


class Converter {
  get sourceExtension() { return null; }
  get destExtension() { return null; }

  tap(file, t, product) {
    if (path.extname(file.path) === this.sourceExtension) {
      try {
        this.convert({file: file, product: product});
      } catch (err) {
        console.log(`Syntax error in file: ${file.path}`);
        console.log(err.toString());
        file.contents = new Buffer("");
        file.path = file.path.replace(this.sourceExtension, this.destExtension);
      }
    }
  }
}

class CoffeeConverter extends Converter {
  get sourceExtension() { return ".coffee"; }
  get destExtension() { return ".js"; }
  convert(opts) {
    var file = opts.file;
    //console.log("Processing qsc file " + file.path);
    file.contents = new Buffer(coffee.compile(file.contents.toString()));
    file.path = file.path.replace(this.sourceExtension, this.destExtension);
  }
}

class SassConverter extends Converter {
  get sourceExtension() { return ".sass"; }
  get destExtension() { return ".css"; }
  convert(opts) {
    var file = opts.file;
    const jamba = opts.product.jamba;
    const ext = file.path.substring(file.path.length - 5);
    const ret = sass.renderSync({file: file.path, data: file.contents.toString('utf8'), indentedSyntax: (ext == ".sass"), includePaths: jamba.sassIncludePaths});
    file.contents = ret.css
    file.path = file.path.replace(ext, ".css");
  }
}

class JhamlConverter extends Converter{
  convert(opts) {
    var base_path = opts.product.source_path();
    var file = opts.file;
    const rel_path = path.relative(base_path, file.path).replace(".jhaml", "");
    const rel_name = rel_path.replace("/", "-");
    const html = haml.render(file.contents);
    const html_min = html.replace("\n", "").replace(/"/g, '\\"');
    const name = `view-${rel_name}`;
    const jst = `window.JST || window.JST = {}; window.JST['${name}'] = function() { return \"${html_min}\"; };`;
    file.contents = new Buffer(jst);
    file.path = file.path.replace(".jhaml", ".js");
  };
}

class QscConverter extends Converter {
  get sourceExtension() { return ".qsc"; }
  get destExtension() { return ".js"; }
  convert(opts) {
    const jamba = opts.product.jamba;
    const lang = opts.lang || 'coffee'
    var file = opts.file;
    var output = "";
    var buffer = "";
    var ib = false;
    var pb = null;
    //console.log("Processing coffee file " + file.path);

    // parse template
    const text = file.contents.toString('utf8');
    for (var line of text.split("\n")) {
      line = line + "\n";   // add newline back
      if (line.startsWith("<") && !ib) {
        buffer = line;
        ib = true;
      } else if (line.startsWith("</") && ib) {
        buffer += line;
        var td = this.parseTag(buffer, {includePaths: jamba.sassIncludePaths});
        if (td.tag_name == "template") {
          pb = `QS.utils.registerTemplate('${td.name}', ${JSON.stringify(td.processed_content)})\n`
        } else if (td.tag_name == "style") {
          pb = `QS.utils.registerStyle(${JSON.stringify(td.processed_content)})\n`
        } else {
          throw new Error("This tag is unknown: " + td.tag_name);
        }
        output += this.formatLine(pb, lang);
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
  }

  // helper functions

  parseTagAttribute(tag, attr) {
    if (tag.indexOf(`${attr}=`) == -1) { return null; }
    const p1 = tag.split(`${attr}=\"`)
    const p2 = p1[p1.length-1];
    return p2.split("\"")[0];
  }

  parseTag(str, opts={}) {
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
    const lang = this.parseTagAttribute(tl, "lang");
    var name = null;
    if (tname == "template") {
      name = this.parseTagAttribute(tl, "name");
    }
    var content = lines.slice(1, -1).join("\n");
    if (lang == "haml") {
      //content = "%div(title='The title') Here is a div";
      pc = haml.render(content);
      if (pc.startsWith("\n<pre class='error'>")) {
        throw new Error(pc);
      }
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

  formatLine(line, lang) {
    if (lang == 'coffee') {
      return line;
    } else {
      return line + ";";
    }
  }
}

var converters = { CoffeeConverter, SassConverter, QscConverter };
module.exports = converters;
