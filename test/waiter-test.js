var chug = require('../chug')
var Waiter = require('../lib/Waiter')
var is = global.is || require('exam/lib/is')

describe('Waiter', function () {
  before(function () {
    chug.waits = 0
    chug.finished = false
    chug.thenQueue = []
    chug.queue = []
  })
  describe('wait/unwait', function() {
    it('should increment/decrement', function () {
      var w = new Waiter()
      w.wait()
      is(w.waits, 1)
      is(w.getFlag('finished'), false)
      w.wait()
      is(w.waits, 2)
      w.unwait()
      is(w.waits, 1)
      is(w.getFlag('finished'), false)
      w.unwait()
      is(w.waits, 0)
      is(w.getFlag('finished'), true)
      w.setFlag('finished', false)
    })
  })
  describe('then', function() {
    var w = new Waiter()
    it('should have a method', function () {
      is.function(w.then)
    })
    it('should have a queue', function () {
      is.array(w.queue)
      w.then(function() { })
      is(w.queue.length, 1)
    })
    it('should execute callbacks', function () {
      var calls = 0
      var fn1 = function () {
        calls++
      }
      var fn2 = function () {
        calls++
      }
      var fn3 = function () {
        calls++
      }
      // If nothing is waiting, the callback should execute.
      w.then(fn1)
      is(calls, 1)

      // When waiting, a call will not execute.
      w.wait()
      is(calls, 1)
      w.then(fn2)
      is(calls, 1)

      // Once async calls finish, callbacks will execute.
      w.unwait()
      is(calls, 2)

      // Initial load is completed, so callbacks execute immediately again.
      w.then(fn3)
      is(calls, 3)

      // When the waiter becomes ready again, nothing should re-execute.
      w.wait()
      w.unwait()
      is(calls, 3)
    })
  })
  describe('parent', function() {
    it('should link wait counts', function (done) {
      var parent = new Waiter()
      var child = new Waiter()
      child.wait(2)
      child.parent(parent)
      is(parent.waits, 2)
      parent.then(done)
      child.unwait(2)
    })
  })
})
