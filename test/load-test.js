var fs = require('fs')
var http = require('http')
var zlib = require('zlib')
var chug = require('../chug')
var Asset = require('../lib/asset')
var exec = require('child_process').exec
var cwd = process.cwd()
var is = global.is || require('exam/lib/is')

var express, server
chug.enableShrinking()

var mockStat = function (path, callback) {
  callback(null, {
    dev: 16777219,
    mode: 33188,
    nlink: 1,
    uid: 501,
    gid: 20,
    rdev: 0,
    blksize: 4096,
    ino: 3063360,
    size: 50,
    blocks: 8,
    atime: 'Wed Mar 19 2014 00:50:13 GMT-0700 (PDT)',
    mtime: 'Mon Mar 17 2014 17:25:29 GMT-0700 (PDT)',
    ctime: 'Mon Mar 17 2014 17:25:29 GMT-0700 (PDT)',
    isDirectory: function () {
      return path.indexOf('.') < 0
    }
  })
}

describe('Load', function () {

  before(function () {
    express = require('express')()
    server = express.listen(8999)
    chug.setServer(express)
  })

  after(function () {
    if (server) {
      server.close()
      server = null
    }
  })

  it('should load nothing if no path is passed', function () {
    var empty = chug()
    is(empty.assets.length, 0)
  })

  it('should load views', function (done) {
    var views = chug('test/views')
    views.then(function () {
      is(views.assets.length, 2)
      var hasCachedItems = false

      // Pollute Object so we'll touch hasOwnProperty code paths.
      Object.prototype.polluted = true
      chug.cache.each(function () {
        hasCachedItems = true
      })
      delete Object.prototype.polluted

      is(hasCachedItems, true)
      done()
    })
  })

  it('should log an error for an invalid location', function () {
    var errors = 0
    chug.setLog({error: function () {
      errors++
    }})
    chug({})
    is(errors, 1)
  })

  it('should load views as an array', function (done) {
    var views = chug(['test/views/hello.ltl', 'test/views/base/page.ltl'])
    views.then(function () {
      is(views.assets.length, 2)
      done()
    })
  })

  it('should ignore a non-existent path', function () {
    chug('./test/non-existent-path')
  })

  it('should resolve a node_modules path', function () {
    chug('node_modules/istanbul/lib/hook.js')
  })

  it('should load an absolute path', function () {
    var path = require.resolve('exam')
    chug(path)
  })

  it('should skip . and .. "files"', function() {
    var readdir = fs.readdir
    fs.readdir = function (dir, callback) {
      callback(null, ['.', '..', 'mock.txt'])
    }
    var stat = fs.stat
    fs.stat = mockStat
    var temp = chug('test/nonexistent')
    is(temp.assets.length, 1)
    fs.readdir = readdir
    fs.stat = stat
  })

  it('should log an error when a directory can\'t be read', function() {
    var readdir = fs.readdir
    fs.readdir = function (dir, callback) {
      callback('ERROR')
    }
    var stat = fs.stat
    fs.stat = mockStat
    var errors = 0
    chug.setLog({
      error: function error () {
        errors++
      }
    })
    chug('test/nonexistent')
    is(errors, 1)
    fs.readdir = readdir
    fs.stat = stat
  })

  it('should iterate over views', function (done) {
    var count = 0
    chug('test/views')
      .each(function (view) {
        is(view.content.length > 0, true)
        ++count
      })
      .then(function () {
        is(count, 2)
        is(this.assets.length, 2)
        done()
      })
  })

  it('should compile views', function (done) {
    chug('test/views/hello.ltl')
      .compile()
      .each(function (view) {
        is.function(view.compiledContent)
      })
      .then(done)
  })

  it('should compile and minify', function (done) {
    chug('test/views/hello.ltl').compile().minify().then(done)
  })

  it('should cull content', function (done) {
    chug.cache.clear()
    chug('test/views/hello.ltl').cull().compile().each(function (h) {
      is(h.cullTarget, 'content')
      done()
    })
  })

  it('should cull compiled content', function (done) {
    chug.cache.clear()
    chug('test/scripts/a.coffee').compile().cull().each(function (a) {
      is(a.cullTarget, 'compiledContent')
      done()
    })
  })

  it('should not cull binary content', function (done) {
    chug('test/icons/chug.ico').cull().each(function (i) {
      is(typeof i[i.cullTarget], 'object')
      done()
    })
  })

  it('should not gzip binary content', function (done) {
    chug('test/icons/chug.ico').gzip().each(function (i) {
      is(typeof i[i.gzippedContent], 'undefined')
      done()
    })
  })

  it('should concatenate scripts', function (done) {
    chug('test/scripts')
      .concat()
      .then(function () {
        done()
      })
  })

  it('should concatenate scripts with a name', function (done) {
    var scripts = chug('test/scripts')
      .concat()
      .then(function () {
        var first = scripts.assets[0]
        is(first.content.split('=').length, 4)
        done()
      })
  })

  it('should serve compiled CoffeeScript with Express', function (done) {
    chug('test/scripts')
      .compile()
      .concat()
      .then(function () {
        chug.setServer(express)
      })
      .route('/core.js')
      .then(function () {
        http.get('http://127.0.0.1:8999/core.js', function (response) {
          response.on('data', function (chunk) {
            var data = '' + chunk
            is.in(data, /var a;/)
            done()
          })
        })
      })
  })

  it('should route ltl', function (done) {
    chug.enableShrinking()
    chug('test/views')
      .compile({space: '  '})
      .minify()
      .then(function () {
        chug.setServer(express)
      })
      .route()
      .then(function () {
        chug.shrinker = null
        http.get('http://127.0.0.1:8999/test/views/hello.ltl.html', function (response) {
          response.on('data', function (chunk) {
            var data = '' + chunk
            is(/DOCTYPE/.test(data), true)
            done()
          })
        })
      })
  })

  it('should not route until a server is set', function (done) {
    chug.server = null
    var errors = 0
    chug.setLog({
      error: function error () {
        errors++
      }
    })
    chug('test/scripts/b.js')
      .route()
      .then(function () {
        is(errors, 1)
        done()
      })
  })

  describe('with Za', function () {

    it('should compress when routing', function (done) {
      var za = require('za')()
      var decorations = require.resolve('za/lib/response')
      delete require.cache[decorations]
      require(decorations)
      za.log = {info: function () {}}
      za.listen(8998)
      chug('test/scripts/b.js')
        .minify()
        .gzip()
        .then(function () {
          chug.setServer(za)
        })
        .route()
        .then(function () {
          http.get({
            hostname: '127.0.0.1',
            port: 8998,
            path: '/test/scripts/b.js',
            method: 'GET',
            headers: {'accept-encoding': 'gzip'}
          }, function (response) {
            response.on('data', function (chunk) {
              zlib.gunzip(chunk, function (err, data) {
                is('' + data, 'var b=2;')
                za.close()
                delete http.ServerResponse.prototype.zip
                done()
              })
            })
          })
        })
    })

    it('should set an expires header when queried with a version', function (done) {
      var za = require('za')()
      var decorations = require.resolve('za/lib/response')
      delete require.cache[decorations]
      require(decorations)
      za.log = {info: function () {}}
      za.listen(8997)
      chug('test/scripts/b.js')
        .then(function () {
          chug.setServer(za)
        })
        .route('/b.js')
        .then(function () {
          http.get('http://127.0.0.1:8997/b.js?v=1234', function (response) {
            response.on('data', function (chunk) {
              var data = '' + chunk
              is.in(data, /var b/)
              is.defined(response.headers.expires)
              za.close()
              delete http.ServerResponse.prototype.zip
              done()
            })
          })
        })
    })

  })

  it('should wrap js but not css', function (done) {
    var load = chug()
    var js = load.addAsset(Asset, 'test.js')
    js.setContent('var a = 1;')
    var styl = load.addAsset(Asset, 'test.styl')
    styl.setContent('body\n color #fff')
    load
      .wait()
      .wrap()
      .compile()
      .wrap()
      .then(function () {
        done()
      })
      .unwait()
  })

  it('should write', function (done) {
    chug('test/scripts/b.js')
      .minify()
      .write()
      .write('build', 'b.js')
      .write('build', 'b.min.js', 'minified')
      .then(function () {
        done()
      })
  })

  it('should return locations', function (done) {
    var scripts = chug('test/scripts')
      .getLocations(function (locations) {
        is(locations.length, 3)
      })
      .then(function () {
        is(scripts.getLocations().length, 3)
        done()
      })
    is(scripts.getLocations().length, 0)
  })

  it('should return tags', function (done) {
    var load = chug([
      'test/scripts/a.coffee',
      'test/scripts/b.js',
      'test/styles/a.css',
      'test/styles/b.styl',
      'test/views/hello.ltl'])
      .getTags(function (tags) {
        verify(tags, '')
      })
      .then(function () {
        verify(load.getTags(), '')
        verify(load.getTags('blah'), 'blah')
        done()
      })
    function verify (html, path) {
      is.in(html, '<script src="' + path + '/test/scripts/a.coffee.js"></script>')
      is.in(html, '<script src="' + path + '/test/scripts/b.js"></script>')
      is.in(html, '<link rel="stylesheet" href="' + path + '/test/styles/a.css">')
      is.in(html, '<link rel="stylesheet" href="' + path + '/test/styles/b.styl.css">')
    }
    is(load.getTags(), '')
  })

  it('should require modules', function (done) {
    chug('test/modules')
      .require()
      .then(function () {
        is(marco, 'polo')
      })
      .require(function (module) {
        is(module.name, 'marco')
        done()
      })
  })

  it('should sort files', function (done) {
    var readdir = fs.readdir
    var stat = fs.stat
    var readFile = fs.readFile
    fs.readdir = function (path, callback) {
      callback(null, ['a.js', 'b.js', 'c.js'])
    }
    fs.stat = function (path, callback) {
      var stat = {
        isDirectory: function () {
          return !/\.js$/.test(path)
        }
      }
      if (/a\.js$/.test(path)) {
        setTimeout(function () {
          callback(null, stat)
        }, 20)
      } else {
        callback(null, stat)
      }
    }
    fs.readFile = function (path, callback) {
      if (/b\.js$/.test(path)) {
        setTimeout(function () {
          callback(null, 'var b = 2;')
        }, 40)
      } else {
        callback(null, /a\.js/.test(path) ? 'var a = 1;' : 'var c = 3;')
      }
    }
    chug('mock')
      .sort()
      .then(function () {
        var joined = this.getLocations().join(',')
        is(joined, cwd + '/mock/a.js,' + cwd + '/mock/b.js,' + cwd + '/mock/c.js')
        chug.cache.clear()
        chug('test/mock').sort().concat().each(function (asset) {
          is(asset.content, 'var a = 1;\nvar b = 2;\nvar c = 3;\n')
          fs.readdir = readdir
          fs.stat = stat
          fs.readFile = readFile
          done()
        })
      })
  })

  it('should ignore filenames and patterns', function (done) {
    var readdir = fs.readdir
    var stat = fs.stat
    var readFile = fs.readFile
    var firstReaddir = true
    fs.readdir = function (path, callback) {
      setImmediate(function () {
        callback(null, [
          '.DS_Store',
          '.gitignore',
          'a.js',
          'node_modules',
          'ignoreMe'
        ])
      })
    }
    fs.stat = function (path, callback) {
      callback(null, {
        isDirectory: function () {
          return path.indexOf('.') < 0
        }
      })
    }
    fs.readFile = function (path, callback) {
      callback(null, 'CONTENT')
    }
    chug('mock').ignore('node_modules').ignore(/ignore/)
      .then(function (load) {
        is(this.assets.length, 1)
        fs.readdir = readdir
        fs.stat = stat
        fs.readFile = readFile
        done()
      })
  })
})
