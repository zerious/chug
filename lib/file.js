var fs = require('fs')
var chug = require('../chug')
var Asset = require('./asset')
var mime = require('lighter-mime')

/**
 * An Asset is an in-memory representation of a file.
 */
module.exports = Asset.extend(function File () {
  Asset.apply(this, arguments)
  this.readFile()
}, {

  /**
   * Read from the file system and set content on this asset.
   */
  readFile: function () {
    var self = this
    var path = this.location
    this.wait()
    fs.readFile(path, function (error, content) {
      if (error) {
        return chug.log.error('[Chug] Failed to load file: ' + path)
      }
      self.handleContent(content)
      self.unwait()
    })
    return this
  },

  /**
   * Handle a content buffer.
   */
  handleContent: function (content) {
    var type = mime[this.type] || 'text'
    if (/(text|json|svg)/.test(type)) {
      content = content.toString()
    }
    this.setContent(content)
    return this
  }

})
