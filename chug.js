// Require modules in order to prevent circular dependency problems.
var Class = require('./lib/Class');
var Waiter = require('./lib/Waiter');
var Asset = require('./lib/Asset');
var File = require('./lib/File');
var Load = require('./lib/Load');
var Cache = require('./lib/Cache');

/**
 * Expose a function that creates a new "Load" of files.
 * @param path
 * @returns {Load}
 */
var api = module.exports = function load(location) {
	return new Load(location, api);
};

/**
 * Turn the API into a waiter so we can bind onReady tasks to it.
 */
var waiter = new Waiter();
for (var property in waiter) {
	api[property] = waiter[property];
}

/**
 * Expose the version to module users.
 * @type {string}
 */
api.version = require('./package.json').version;

/**
 * Allow module users to decide which paths don't get walked.
 */
api.ignorePattern = /^(\.+)$/;

/**
 * Allow module users to decide what happens with errors.
 */
api.error = console.error;

/**
 * Cache all assets so each one only needs to be loaded once.
 */
api.cache = new Cache();
api.onReady(function () {
	api.cache.write();
});

/**
 * By default, we'll look up compilers at compile time.
 * For example, a .jade file will trigger us to require('jade') and use that.
 * There are two ways to override:
 *  - When api.compiler[fileType] === false, the content will not be compiled.
 *  - When typeof api.compiler[fileType] == 'string', we will require(api.compiler[fileType]).
 */
api._compilers = {
	txt: false,
	html: false,
	htm: false,
	js: false,
	css: false,
	gif: false,
	jpg: false,
	jpeg: false,
	png: false,
	svg: false,
	md: 'markdown',
	ts: 'typescript.api',
	coffee: 'coffee-script',
	scss: 'node-sass',
	styl: 'stylus'
};

/**
 * Add a compiler for a type of file, specifying the module name.
 * @param fileType
 * @param moduleName
 */
api.addCompiler = function addCompiler(fileType, moduleName) {
	var compiler = false;
	try {
		compiler = require(moduleName);
	}
	catch (e) {
		api.error('Could not load compiler: ' + moduleName);
	}
	api._compilers[fileType] = compiler;
	return compiler;
};

/**
 * JavaScript and CSS can be minified.
 */
api._minifiers = {
	js: 'uglify-js',
	css: 'clean-css'
};

/**
 * Several languages compile to HTML, JavaScript or CSS.
 */
api._targetLanguages = {
	ltl: 'html',
	jade: 'html',
	haml: 'html',
	md: 'html',
	markdown: 'html',
	ts: 'js',
	coffee: 'js',
	iced: 'js',
	litcoffee: 'js',
	less: 'css',
	scss: 'css',
	styl: 'css'
};

/**
 * Add a minifier for a type of file, specifying the module name.
 * @param fileType
 * @param moduleName
 */
api.addMinifier = function addMinifier(fileType, moduleName) {
	var minifier = require(moduleName);
	api._minifiers[fileType] = minifier;
	return minifier;
};

/**
 * Express or similar app with app.get(path, callback) routing.
 * @type {App}
 */
api._app = null;

/**
 * Add a minifier for a type of file, specifying the module name.
 * @param fileType
 * @param moduleName
 */
api.setApp = function setApp(app) {
	api._app = app;
};