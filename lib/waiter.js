var Type = require('../common/object/type')

/**
 * Waiter is a poor-man's async with good performance and no external dependencies.
 * It counts async operations in progress and runs queued callbacks once the count is zero.
 */
module.exports = Type.extend({

  /**
   * Constructor.
   */
  init: function (parent) {

    /**
     * Count the number of waiting operations in progress.
     * When this number reaches zero, we've gone from initial loading to watching.
     */
    this.waitCount = 0

    /**
     * Other waiters may depend on this one.
     */
    this.parents = []

    /**
     * Indicate whether we have ready the initial load.
     */
    this.isReady = false

    /**
     * Keep a queue of callbacks to be run when the initial load is ready.
     */
    this.onceReadyQueue = []

    /**
     * Keep a queue of callbacks to be run each time the load becomes ready again.
     */
    this.onReadyQueue = []

    // If this waiter has a parent, it's waiting should make the parent wait.
    if (parent) {
      this.addParent(parent)
    }
  },

  /**
   * Parents of this waiter must wait for this ones operations.
   */
  addParent: function (parent) {
    this.parents.push(parent)
    if (this.waitCount) {
      parent.wait(this.waitCount)
    }
  },

  /**
   * Increment the number of waiting operations in progress.
   */
  wait: function (count) {
    this.parents.forEach(function (waiter) {
      waiter.wait(count)
    })
    this.waitCount += count || 1
    return this
  },

  /**
   * Decrement the number of waiting operations in progress.
   * If no operations are in progress, we're ready.
   */
  unwait: function (count) {
    this.waitCount -= count || 1
    if (!this.waitCount) {
      this.isReady = true
      this.onReady()
    }
    this.parents.forEach(function (waiter) {
      waiter.unwait(count)
    })
    return this
  },

  /**
   * Run a callback once this is ready.
   */
  onceReady: function (callback) {
    if (this.isReady && !this.waitCount) {
      callback()
    } else {
      this.onceReadyQueue.push(callback)
    }
    return this
  },

  /**
   * Decrement the number of waiting operations in progress.
   */
  onReady: function (callback) {
    if (callback) {
      this.onReadyQueue.push(callback)
      if (this.isReady && !this.waitCount) {
        callback()
      }
    } else {
      this.onceReadyQueue.forEach(function (callback) {
        callback()
      })
      this.onceReadyQueue = []
      this.onReadyQueue.forEach(function (callback) {
        callback()
      })
    }
    return this
  }
})
