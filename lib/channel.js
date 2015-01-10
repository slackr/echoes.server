module.exports = Channel;

function Channel(name) {
    this.name = name;
    this.members = {};
    this.sane = false;

    this.sanity_check();
};

Channel.prototype.sanity_check = function() {
    this.sane = false;

    if (typeof this.name == 'string'
        || this.name instanceof String) {

        this.name = '#' + this.name.replace(/[^a-z0-9\-\_]+/gi,'');
        this.sane = true;
    }
}

Channel.prototype.join = function(nick) {
    this.members[nick.name] = nick;
};

Channel.prototype.part = function(nick) {
    if (typeof this.members[nick.name] != 'undefined') {
        delete this.members[nick.name];
    }
};
