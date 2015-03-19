/**
 * Create an array, decorated with a method for key-value mappings.
 *
 * @origin https://github.com/lighterio/lighter-common/common/object/array-map.js
 * @version 0.0.1
 * @import object/type
 */

module.exports = ArrayMap;

function ArrayMap() {
  var map = [];
  map.set = set;
  map.get = get;
  map.remove = remove;
  return map;
}

function set(key, value) {
  var self = this;
  var found = self[key];
  if (found === undefined) {
    self.push(value);
  }
  else {
    self.remove(key);
  }
  self[key] = value;
}

function get(key) {
  var self = this;
  return self[key];
}

function remove(key) {
  var self = this;
  return self[key];
}
