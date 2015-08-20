var Flagger = require('../common/event/flagger')

/**
 * Waiter is a poor-man's async with good performance and no external dependencies.
 * It counts async operations in progress and runs queued callbacks once the count is zero.
 */
module.exports = Flagger.extend({

  /**
   * Constructor.
   */
  init: function (parent) {

    // Count the number of waiting operations in progress.
    this.waits = 0

    // Other waiters may depend on this one.
    this.parents = []

    // A list of actions to run and potentially replay later.
    this.queue = []
    this.queue.nextIndex = 0

    // If this waiter has a parent, it's waiting should make the parent wait.
    if (parent) {
      this.parent(parent)
    }

    // Indicate that we're not finished loading.
    this.setFlag('finished', false)
  },

  /**
   * Parents of this waiter must wait for this one's operations.
   */
  parent: function (parent) {
    this.parents.push(parent)
    if (this.waits) {
      parent.wait(this.waits)
    }
  },

  /**
   * Increment the number of waiting operations in progress.
   */
  wait: function (count) {
    this.parents.forEach(function (waiter) {
      waiter.wait(count)
    })
    this.waits += count || 1
    return this
  },

  /**
   * Decrement the number of waiting operations in progress.
   * If no operations are in progress, run the next queued action.
   */
  unwait: function (count) {
    this.waits -= count || 1
    this.next()
    this.parents.forEach(function (waiter) {
      waiter.unwait(count)
    })
    return this
  },

  /**
   * Add a function to the queue of runnable actions (without duplication).
   * If we're not waiting for something, run the function now.
   */
  then: function (fn) {
    var queue = this.queue
    var length = queue.length
    for (var index = 0; index < length; index++) {
      if (queue[index] == fn) {
        return this
      }
    }
    queue.push(fn)
    this.next()
    return this
  },

  /**
   * If we're not waiting for something, run the next action.
   */
  next: function () {
    if (!this.waits) {
      var queue = this.queue
      var action = queue[queue.nextIndex]
      if (action) {
        ++queue.nextIndex
        action.apply(this)
        this.next()
      }
      else {
        this.setFlag('finished', true)
      }
    }
    return this
  },

  /**
   * If the queue is finished, reset it and start replaying actions.
   */
  replay: function () {
    if (this.getFlag('finished')) {
      this.setFlag('finished', false)
      this.queue.nextIndex = 0
      this.next()
      return this
    }
  }

})
