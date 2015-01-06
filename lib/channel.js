module.exports = Channel;
var Nickname = require('./nickname.js');

function Channel(name) {
    this.name = '#' + name.replace(/[^a-z0-9\-\_]+/gi,'');
    this.nicknames = [];
};
