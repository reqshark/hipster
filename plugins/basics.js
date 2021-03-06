module.exports = function (doc, _, cursor) {

  var fs = require('fs')
  var join = require('path').join
  var rc = this.config

  //if an argument was specified, pass it in
  var file = rc._[0] || rc.file || 
    join(__dirname, '..', 'README.md'), title = file

  rc.file = file

  function toLines(data) {
    
    return data.split('\t').join('  ').split('\n')
      .map(function (e, i, a) {
      //add \n to every line
      return e + '\n'
    })
  }

  //try and open the file the user past in
  //if it doesn't exit yet, we will write 
  //to it on Ctrl-S (see plugins/control)

  try {
    var stat = fs.statSync(file)
    if(stat.isDirectory()) {
      console.error(file, 'is a directory')
      process.exit(1)
    }
    doc.lines = toLines(fs.readFileSync(file, 'utf-8'))
    var last = doc.lines.pop()
    if(last != '\n')
      doc.lines.push(last)
  } catch (_) { }

  if(rc.file) title = file
  else        rc.noSave = true, title = 'README'

  rc.title = rc.title || title

  cursor.
    write('\x1b]0;hip - ' + (rc.title) + '\007')

  //setup debugging
  if(!rc.debug)
    log = console.error = function noop(){}

  //log to a file
  else if('string' == typeof rc.debug) {
    var inspect = require('util').inspect
    var ds = fs.createWriteStream(rc.debug)
    log = console.error = function () {
      ds.write(
        [].slice.call(arguments)
          .map(inspect).join(' ')
        +'\n'
      )
    }
  }

  //log to stderr.
  //hipster file 2> debug.log
  else log = console.error

}
