var fs = require('fs')
var chug = require('../chug')
var File = require('./file')
var Asset = require('./asset')
var Flagger = require('lighter-flagger')
var fileRoot = process.cwd() + '/'

/**
 * A load is a set of assets on which chaining operations can be performed.
 */
var Load = module.exports = Flagger.extend(function Load (location, parent) {
  Flagger.call(this, parent)
  this.locations = []
  this.assets = []
  this.changedLocation = ''
  this.ignoreList = []
  this.concatWithLineBreaks = true
  this.language = undefined

  this.wait()
  if (location) {
    this.add(location)
  }
  this.ready(function () {
    this.sort()
  })
  this.unwait()
}, {

  /**
   * Add an asset, array, file or directory of assets to the Load.
   */
  add: function (item) {
    var self = this

    // An asset can be mapped if it hasn't been already.
    if (item.setContent) {
      var location = item.location
      var mapped = this.assets[location]
      if (!mapped) {
        this.assets.push(item)
        this.assets[location] = item
        this.waitFor(item)
        item.use()
      }

    // Arrays' items can be iteratively added.
    } else if (item instanceof Array) {
      item.forEach(function (path) {
        self.add(path)
      })

    // Strings can be added as file or filter locations.
    } else if (typeof item === 'string') {
      // Extract a filter, such as "pack" for webpack.
      var filter
      item = item.replace(/^([a-z]+):/, function (match, name) {
        filter = name
        return ''
      })

      // Build an absolute path.
      var path = item
      if (path[0] !== '/') {
        path = fileRoot + path
      }
      var star = path.indexOf('*')
      if (star >= 0) {
        var pattern = path
          .replace(/\*/g, '~')
          .replace(/([^\d\w_-])/gi, '\\$1')
          .replace(/\\~/g, '.*')
        this.pattern = new RegExp('^' + pattern + '$')
        path = path.replace(/\/?\*.*$/, '')
      }

      if (!this.finished) {
        this.locations.push(path)
      }

      this.addPath(path, filter, 0)
    } else {
      chug.log.error('[Chug] Unexpected location type: ' + JSON.stringify(item))
    }
    return this
  },

  /**
   * Load a file with a given path, populating this Load with File assets.
   */
  addPath: function (path, filter, dirDepth) {
    var self = this
    this.wait()
    fs.stat(path, function (err, stat) {
      if (err) {
        chug.log.error('[Chug] Could not stat file: ' + path, err.stack)
      } else if (filter) {
        var AssetType = chug._filters[filter]
        self.addAsset(AssetType, path, stat)
      } else if (stat.isDirectory()) {
        self.addDir(path, dirDepth, stat)
      } else if (!self.pattern || self.pattern.test(path)) {
        self.addAsset(File, path, stat)
      }
      self.unwait()
    })
    return this
  },

  /**
   * Read a directory, adding its files and subdirectories to the Load.
   */
  addDir: function (dir, dirDepth, stat) {
    var self = this
    this.wait()
    fs.readdir(dir, function (err, files) {
      if (err) {
        self.unwait()
        chug.log.error('[Chug] Could not load directory: ' + dir, err)
        return
      }
      files.forEach(function (name) {
        var shouldIgnore = chug._ignorePattern.test(name)
        self.ignoreList.forEach(function (filenameOrPattern) {
          if (typeof filenameOrPattern === 'string') {
            shouldIgnore = shouldIgnore || (name === filenameOrPattern)
          } else {
            shouldIgnore = shouldIgnore || filenameOrPattern.test(name)
          }
        })
        if (!shouldIgnore) {
          var path = dir + '/' + name
          self.addPath(path, null, dirDepth + 1)
        }
      })
      self.unwait()
    })
    return this
  },

  /**
   * Get an asset from cache if possible, otherwise create it.
   */
  addAsset: function (Type, location, stat) {
    var asset = chug.cache.get(location)
    if (asset) {
      this.waitFor(asset)
    } else {
      asset = new Type(location, stat, this)
      chug.cache.set(location, asset)
    }
    this.add(asset)
    return asset
  },

  /**
   * Ignore files with a given name or matching a pattern.
   */
  ignore: function (spec) {
    this.ignoreList.push(spec)
    return this
  },

  /**
   * Run a function on each asset in the load once they're all loaded.
   */
  each: function (fn) {
    this.then(function () {
      this.assets.forEach(fn)
    })
    return this
  },

  /**
   * Return a list of asset locations, or pass the list to a function.
   */
  getLocations: function (fn) {
    var locations = []

    function pushLocation (asset) {
      locations.push(asset.location)
    }

    // If a function is passed in, pass the list after iterating asynchronously.
    if (fn) {
      return this
        .each(pushLocation)
        .then(function () {
          fn(locations)
        })
    }

    // If there was no fn, just return the list of assets that are already loaded.
    this.assets.forEach(pushLocation)
    return locations
  },

  /**
   * Return a string of HTML tags to refer to the assets in this load.
   */
  getTags: function (path, fn) {
    var tags = ''

    // Path is optional, so the first argument might actually be the function.
    if (typeof path === 'function') {
      fn = path
      path = null
    }

    // Path defaults to empty string.
    if (typeof path !== 'string') {
      path = ''
    }

    function appendTag (asset) {
      asset.eachTarget('compiled', function (target, content, url) {
        if (target === 'js') {
          tags += '<script src="' + path + url + '"></script>'
        } else if (target === 'css') {
          tags += '<link rel="stylesheet" href="' + path + url + '">'
        }
      })
    }

    // If a function is passed in, pass the tags after iterating asynchronously.
    if (fn) {
      return this
        .each(appendTag)
        .then(function () {
          fn(tags)
        })
    }

    // If there was no fn, just return tags for assets that are already loaded.
    this.assets.forEach(appendTag)
    return tags
  },

  /**
   * Concatenate assets into a new asset in a new or existing load.
   */
  concat: function (load) {
    var self = this
    var isExistingLoad = load instanceof Load

    // Get or create the load that will contain the concatenated content.
    load = isExistingLoad ? load : new Load(chug)

    // Create a reference to the load that was concatenated.
    load.sourceLoad = self

    // Sort if we haven't already.
    if (!self.hasOwnProperty('customSort')) {
      self.sort()
    }

    load.wait()
    self.then(function () {
      var content = ''
      self.assets.forEach(function (asset) {
        var compiled = asset.getCompiledContent(self.language)
        if (compiled instanceof Buffer) {
          compiled = compiled.toString()
        }
        if (typeof compiled === 'string') {
          content += compiled.replace(/@use /g, '@uses ')
          if (self.concatWithLineBreaks && (content[content.length - 1] !== '\n')) {
            content += '\n'
          }
        }
      })
      if (load.assets.length < 1) {
        load.addAsset(Asset, '')
      }
      var asset = load.assets[0]
      asset.setContent(content)
      if (isExistingLoad) {
        load.replay(asset.location)
      }
      load.unwait()
    })
    return load
  },

  /**
   * Handle a change to a location after an fs.watch event.
   */
  handleChange: function (location) {
    var self = this

    // The location may have been deleted or moved, so we need to check its existence.
    self.wait()
    fs.exists(location, function (exists) {

      // If the location exists, it may or may not be new.
      if (exists) {

        // The location exists, so re-read it or any sub-directory assets.
        var matchCount = 0
        self.assets.forEach(function (asset) {
          if (asset.location.indexOf(location) === 0) {
            asset.readFile()
            matchCount++
          }
        })

        // If there were no matches, this thing is new, so add it.
        if (!matchCount) {
          self.add(location)
        }

      // The location no longer exists, so we need to get rid of its assets.
      } else {

        // Get rid of it by rebuilding the asset array.
        var assets = []
        self.assets.forEach(function (asset) {

          // Assets that are under (or are) the deleted location must be
          // removed from cache and not added to the assets array.
          if (asset.location.indexOf(location) === 0) {
            chug.cache.remove(asset.location)

          // Assets that didn't match are unaffected, so reference them.
          } else {
            self.add(asset)
          }
        })
        self.assets = assets
      }
      self.unwait()
    })

    // Once changes have been applied, we can replay previously-run queue.
    self.then(function () {
      //self.replay(location)
    })

    return self
  },

  /**
   * Apply a custom sorting function.
   */
  sort: function () {
    // Use a custom sort function if one exists.
    var fn = this.customSort
    if (!fn) {
      // If "@use" annotations are enabled, order by useIndex.
      if (this.isUsing) {
        var assets = this.assets
        var change = 1
        var passes = 0
        while (change && (++passes < 1e3)) {
          change = 0
          for (var i = 0, l = assets.length; i < l; i++) {
            var asset = assets[i]
            for (var location in asset.uses) {
              var dependency = chug.cache.get(location)
              if (dependency.useIndex >= asset.useIndex) {
                change = asset.useIndex = dependency.useIndex + 1
              }
            }
          }
        }
        fn = function (a, b) {
          return (a.useIndex - b.useIndex) ||
            (a.sortIndex - b.sortIndex) ||
            (a.location > b.location ? 1 : -1)
        }

      // Otherwise, order by automatic sortIndex and location.
      } else {
        fn = function (a, b) {
          return (a.sortIndex - b.sortIndex) ||
            (a.location > b.location ? 1 : -1)
        }
      }
    }
    this.assets.sort(fn)
    return this
  },

  /**
   * Remove assets whose contents are duplicative.
   */
  dedupe: function () {
    var self = this
    this.isDeduping = true

    // Build a new array of assets, mapped by CRC32 and location.
    var assets = []
    var index

    // De-dupe asynchronously because calculations can be CPU-intensive.
    this.wait()
    next()

    // Handle the next asset.
    function next () {
      var asset = self.assets[index++]

      // Add each unique asset to the assets array.
      if (asset) {
        var key = '_' + asset.getCrc32()
        if (!assets[key]) {
          assets.push(asset)
          assets[key] = asset
          assets[asset.location] = asset
        }
        setImmediate(next)
      } else {
        self.assets = assets
        self.unwait()
      }
    }

    return this
  },

  /**
   * Set use indexes for each asset based on dependencies.
   */
  use: function () {
    this.isUsing = true
    return this
  }

})

var methods = ['compile', 'cull', 'wrap', 'minify', 'gzip', 'replace', 'route', 'write', 'require']
methods.forEach(function (method) {
  Load.prototype[method] = function () {
    var self = this
    var args = arguments
    return this.each(function (asset) {
      asset.load = self
      asset[method].apply(asset, args)
    })
  }
})

Load.maxAssets = 1e6
