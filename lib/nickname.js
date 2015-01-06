module.exports = Nickname;
var Channel = require('./channel.js');

function Nickname(name, id) {
    this.name = name.replace(/[^a-z0-9\-\_]+/gi,'');
    this.id = id;
    this.channels = [];
};
