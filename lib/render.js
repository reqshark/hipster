var keypress = require('keypress')

module.exports = function (doc, rc) {

  var c = require('charm')(process.stdout)
  var iq = require('insert-queue')

  //this will be reserved space for message bars etc.

  var renderers = []
  var offset = 0

  var previousLine = 1

  rc.rightMargin = 5

  var R = {
    redraw: redraw,
    header: rc.header || 0,
    footer: rc.footer || 0,
    _header: 'hipster...',
    _footer: '...hipster',
    updateLine: updateLine,
    renderers: renderers,
    write: c.write.bind(c),
    reset: c.erase.bind(c, 'screen'),
    cursor: function (x, y) {
      cursor('', x, y)
    },
    updateHeader: updateHeader,
    updateFooter: updateFooter
  }

  //this gets updated when you call redraw()
  var height = (process.stdout.rows || 24) - (R.header + R.footer)
  rc.rows    = (process.stdout.rows || 24)
  rc.columns = (process.stdout.columns || 80)

  process.stdout.on('resize', redraw)

  function render (line, x, y) {
    if(!line) return

    //don't render the '\n'. this can mess-up escape codes.
    line = line.substring(0, line.length - 1)

    //.substring(0, rc.columns)

    var length = rc.columns - +rc.margin
    var pos = Math.max(0, doc.column)
    var start = doc.row+1 === y ? Math.max(doc.column + rc.rightMargin - length, 0) : 0
    console.error('TRUNCATE', rc.rightMargin, start, length, [doc.column, rc.columns, rc.margin])


    //truncate line so that the part containing the cursor is visible.
    //if this is not the line you are editing, from the start.


    if((rc.margin + line.length) > (rc.columns || 80)) {
      l = line.length
      line = line.substring(start, start + length)
      //TODO: if you can't see the end of the line, add ...
    
    }
    var q = iq(line)

    //iterate over the renderers, each gets to modify the line.
    renderers.forEach(function (render) {
      if(render) render(q, x, y)
    })
    return q.apply()
  }

  function updateLine(line, x, y, noErase) {
    if(y < offset || y > offset + height + 1) {
      console.error('OFF SCREEN UPDATE!!!', line, y)
      return
    }
    if(!line) return
    line = render(line, x, y)
    if(R.header + y - offset < R.header)
      throw new Error('OUT OF BOUNDS')
    console.error('WRITE TO', R.header + y - offset, offset)

    c.position(1, R.header + y - offset)

    if(!noErase)
      c.erase('line')

    c.write(line).display('reset')
  }

  function redraw () {
    
    rc.rows    = (process.stdout.rows || 24)
    rc.columns = (process.stdout.columns || 80)

    height = rc.rows - (R.header + R.footer)
    //forget everything we've drawn recently
    already = []
    c.erase('screen')

    keypress.enableMouse(process.stdout)

    if(R.header)
      c.position(1, R.header).write(R._header)

    c.position(1, R.header + 1)
    //scroll(_, doc.column + 1, doc.row + 1)
    for (var i = offset; i < offset + height && doc.lines[i]; i++)
      if(i < doc.lines.length) updateLine(doc.lines[i], 1, i + 1)

    if(R.footer)
      c.position(1, height + R.header + 1).write(R._footer)
    c.position(doc.column + 1 + rc.margin, doc.row + 1 + R.header)

  }
  function eraseLine (line, x, y) {
    c.position(1, R.header + y - offset).erase('line')
  }

  //delete a line from the bottom, and insert one on the top.
  function scrollUpLine () {//works
    c //delete line from bottom.
      .position(1, R.header + height).delete('line')
      //insert line at top.
      .position(1, R.header + 1).insert('line')
      console.error('SCRLUP', doc.lines[offset], 1, offset)
      updateLine(doc.lines[offset - 1], 1, offset + 1)
  }

  //delete a line from the top, and insert one on the bottom.
  function scrollDownLine () { //this works
    c //insert line at top.
      .position(1, R.header + 1).delete('line')
      .position(1, R.header + height).insert('line') //WORKS WITH FOOTER
      //delete line from bottom.
      
      updateLine(doc.lines[offset + height], 1, offset + height)
  }

  function deleteLastLine () {
    c.position(1, R.header + height - offset)
     .delete('line')
    //'when the document is shortened, add a new line at the bottom
  }

  function newLine (line, x, y) {
//    deleteLastLine('', 1, offset + height + 1)
    c.position(1, R.header + height).delete('line')
    c.position(1, R.header + y - offset)
      .insert('line')
    updateLine(line, x, y, true)
  }

  function deleteLine (line, x, y) {
    c.position(1, R.header + y - offset)
     .delete('line')
     .position(1, R.header + height).insert('line')
    //'when the document is shortened, add a new line at the bottom
      updateLine(doc.lines[offset + height], 1, offset + height)
  }

  function smaller (m, M) {
    if(!m) return false
    return m.y == M.y ? m.x < M.x : m.y < M.y
  }

  function eq(m, M) {
    return m.y == M.y && m.x == M.x
  }

  var _min, _max
  function updateMark (min, max) {
    var m, M

    console.error(['OLD', _min, _max, 'NEW', min, max])

    if(_min == null && _max == null)
      m = min, M = max
    else if(!eq(min, _min))
      m = _min, M = min
    else if(!eq(max, _max))
      m = _max, M = max
    
    var s
    if(smaller(M, m)) {
      s = M; M = m; m = s
    }

    console.error('UPDATE>>>', m, M, smaller(m, M))

    if(m && M)
      for(var i = m.y; i <= M.y; i ++)
        updateLine(doc.lines[i], 1, i+1)

    _min = min; _max = max
  }

  function clearMark () {
    c.cursor(true)
    for(var i = _min.y; i <= _max.y; i ++)
      updateLine(doc.lines[i], 1, i+1)
    _min = _max = null
  }

  doc.on('update_line', updateLine)
  doc.on('redraw', redraw)
  doc.on('new_line', newLine)
  doc.on('mark', updateMark)
  doc.on('unmark', clearMark)
  doc.on('delete_line', deleteLine)

  var count = 0

  //cursor has moved.
  function cursor (line, x, y) {
    console.error('CURSOR_MOVES', ++count)
    scroll(line, x, y)

    //if this line is longer than the screen,
    //redraw that line.
    
    // NOTE TO SELF. REMEBER PREVIOUS LINE.
    // CHECK IF IT'S TOO LONG, UPDATE...
    // HANG ON, WEIRDNESS. 
    //AHA, there is a bug here, where the cursor event is updated twice per move.
    //FIX THIS!!!

    var length = rc.columns - rc.margin - rc.rightMargin

//      console.error('update previous?', previousLine, y, _line.length, length, _line.substring(0 , 20))
//    if(previousLine !== y/* && (_line.length > length)*/) {
////      console.error('update previous!', _line)
//      updateLine(_line, 1, previousLine - 1)
//    }
//
    if(line.length > length) {
      updateLine(line, Math.min(x, rc.columns - rc.rightMargin), y, false)
    }

    previousLine = y
    //position cursor on screen.
    c.position(Math.min(x, rc.columns - rc.rightMargin + 1) + rc.margin, R.header + y - offset)
  }
  
  doc.on('cursor', cursor)
  c.cursor(true)

  function scroll (line, x, y) {
    var target = offset
    //there is an off by one error in here somewhere.
    //when I scroll down,
    if ((y + 1) - (offset + height) > 0) 
      target = (y + 1) - height
    else if ((y) - offset <= 1) 
      target = (y) - 1

    //if there was lots of scrolling, redraw the whole screen
    if(Math.abs(target - offset) >= rc.page) {
      offset = target
      return redraw()
    }

    //there are event listeners that pop off the lines at the other end
    //when scrolling happens.
    if(target != offset) {
      while(offset !== target) {
        if(target > offset) {
          //scrolling down, delete line from TOP.
          scrollDownLine()
          offset ++
        } 
        else if(target < offset){
          //scrolling up, add line to top.
          scrollUpLine()
          offset --
        }
      } while(offset !== target);
    }
  }

  function updateHeader (header) {
    R._header = header = (header || R._header).trimRight() //don't want trailing newlines.
    c.push().position(1,1)
      .position(1, R.header + height + 1)
      .write(header).pop()
  }
  function updateFooter (footer) {
    R._footer = footer = (footer || R._footer).trimRight() //don't want trailing newlines.
    c.push()
      .position(1, R.header + height + 1)
      .erase('line').write(footer).pop()
  }

  setInterval(function () {
    if(doc.marks)
      c.cursor(~~(Date.now()/333) % 2)

  }, 333)

  return R
}
