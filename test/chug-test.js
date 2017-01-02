/* global describe before it */

var chug = require('../chug')
var is = global.is || require('exam-is')

describe('API', function () {
  before(function () {
    chug.waits = 0
    chug.finished = false
    chug.thenQueue = []
  })
  it('should be a function', function () {
    is.function(chug)
  })
  describe('setCompiler', function () {
    it('should be a function', function () {
      is.function(chug.setCompiler)
    })
    it('should set a compiler', function () {
      chug.setCompiler('coffee', 'coffee-script')
      is.function(chug._compilers.coffee.compile)
    })
  })
  describe('setMinifier', function () {
    it('should be a function', function () {
      is.function(chug.setMinifier)
    })
    it('should set a minifier', function () {
      chug.setMinifier('js', 'uglify-js')
      is.function(chug._minifiers.js.minify)
    })
  })
  describe('setServer', function () {
    var server = require('express')()
    it('should be a function', function () {
      is.function(chug.setServer)
    })
    it('should set the server', function () {
      chug.setServer(server)
      is.function(chug.server.get)
    })
  })
})
