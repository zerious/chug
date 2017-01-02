var fs = require('fs')
var Asset = require('./asset')
var File = require('./file')
var Type = require('lighter-type')
var path = require('path')

/**
 * A Pack runs webpack and outputs the resulting file content.
 */
module.exports = File.extend(function Pack (path, stat, load) {
  var self = this
  var webpack = require('webpack')
  Asset.init.apply(this, arguments)
  this.wait()
  dive(path, function (paths) {
    var fs = new BypassFs()

    var fn = function (ignore, stats) {
      var name = stats.toJson().assets[0].name
      var type = name.replace(/^.*\./, '')
      if (self.type !== type) {
        self.type = type
        self.path += '.' + type
        self.location += '.' + type
      }
      self.handleContent(fs.content)
      self.unwait()
    }

    var compiler = webpack({entry: paths}, fn)
    compiler.outputFileSystem = fs

    // Check for changes once every 200ms.
    // TODO: Handle entry point changes in packed directories.
    compiler.watch(200, function (err, stats) {
      // Wait for compilation to return assets, and call the handler.
      self.wait()
      fn(err, stats)

      // Replay anything that depends on changes in this asset's load.
      load.then(function () {
        load.replay(self.location)
      })
    })
  })
})

/**
 * Bypass the file system with a fake one of our own.
 */
var BypassFs = Type.extend({

  // Remember the content, and call back without an error.
  writeFile: function (path, content, fn) {
    this.content = content
    fn()
  },

  // Call back without an error.
  mkdirp: function (path, fn) {
    fn()
  },

  // Join a directory and filename, and return a path.
  join: function (dir, file) {
    return path.join(dir, file)
  }

})

/**
 * Dive down a directory.
 */
function dive (path, fn) {
  var list = []
  var wait = 0
  got(path)
  function got (path) {
    wait++
    fs.lstat(path, function (error, stat) {
      if (!error) {
        if (stat.isFile()) {
          list.push(path)
        }
        if (stat.isDirectory()) {
          wait++
          fs.readdir(path, function (error, files) {
            if (!error) {
              files.forEach(function (file) {
                got(path + '/' + file)
              })
            }
            if (!--wait) done()
          })
        }
      }
      if (!--wait) done()
    })
  }
  function done () {
    list.sort()
    fn(list)
  }
}
