module.exports = Channel;

function Channel(name) {
    this.name = '#' + name.replace(/[^a-z0-9\-\_]+/gi,'');
    this.members = {};
};

Channel.prototype.join = function(nick) {
    this.members[nick.name] = nick;
};

Channel.prototype.part = function(nick) {
    if (typeof this.members[nick.name] != 'undefined') {
        delete this.members[nick.name];
    }
};
