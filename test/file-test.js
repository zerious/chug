var chug = require('../chug')
var File = require('../lib/file')
var is = global.is || require('exam/lib/is')

describe('File', function () {
  var file = new File('test/file-test.js')
  it('should have its path as its location', function () {
    is(file.location, 'test/file-test.js')
  })
  it('should load content', function (done) {
    file.then(function () {
      is.string(file.content)
      is.true(file.content.length > 0)
      done()
    })
  })
  it('should load an icon without converting to string', function (done) {
    var icon = new File('test/icons/chug.ico')
    icon.then(function () {
      chug.enableShrinking()
      is.object(icon.content)

      // Shouldn't compile, shrink or minify.
      icon.compile().minify().then(function () {
        is(icon.getMinifiedContent(), icon.content)
        chug.shrinker = null
        done()
      })
    })
  })
})
