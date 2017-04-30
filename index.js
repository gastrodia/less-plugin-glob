var Promise = require('promise');
var globby = require('globby');
var path = require('path');
var eol = require('os').EOL;
var globbyPromise = Promise.denodeify(globby);

function processPaths(paths) {
    return paths.filter(function(filepath) {
        var ext = path.extname(filepath);
        if(ext === '.less' || ext === '.css') {
            return true;
        }
        console.warn('Here is non-less file: ' + filepath + ', ignored');
        return false;
    });
}

module.exports = {
    install: function(less, pluginManager) {
        function GlobFileManager() {

        }
        GlobFileManager.prototype = new less.FileManager();
        GlobFileManager.prototype.constructor = GlobFileManager;
        GlobFileManager.prototype.supports = function(filename) {
            return (filename).indexOf('*') > -1;
        };
        GlobFileManager.prototype.searchInPath = function(basePath, glob) {
            return globbyPromise(glob, {cwd: basePath}).then(function(files) {
                return files.map(function(file) {
                    return path.join(basePath, file);
                });
            });
        };
        GlobFileManager.prototype.searchPaths = function(paths, glob) {
            var doSearch = (function() {
                if(paths.length === 0) {
                    console.warn('There are no files matching', glob);
                    return Promise.resolve([]);
                }
                return this.searchInPath(path.resolve(paths.shift()), glob).then(function(results) {
                    results = processPaths(results);
                    if(results.length === 0) {
                      return doSearch();
                    }
                    return results;
                });
            }).bind(this);
            paths = paths.slice();
            return doSearch();
        };
        GlobFileManager.prototype.loadFile = function(filename, currentDirectory, options) {
            var paths = [currentDirectory];
            if (!this.isPathAbsolute(filename) && paths.indexOf('.') === -1) {
                paths.push('.');
            }
            if (options.paths && options.paths.length > 0) {
                paths.push.apply(paths, options.paths);
            }
            return this.searchPaths(paths, filename).then(function(paths) {
                paths = Array.prototype.concat.apply([], paths);
                return processPaths(paths);
            }).then(function(files) {
                return {
                    contents: files
                        .map(function(file) {
                            return '@import (less) "' + file + '";';
                        })
                        .join(eol),
                    filename: filename
                };
            });
        };
        GlobFileManager.prototype.loadFileSync = function(filename, currentDirectory) {
            var paths = globby.sync(filename, {cwd: currentDirectory});
            paths = processPaths(paths);
            return paths.map(function(file) {
                return '@import "' + file + '";';
            }, this).join(eol);
        };
        GlobFileManager.prototype.supportsSync = GlobFileManager.prototype.supports;
        pluginManager.addFileManager(new GlobFileManager());
    }
};
