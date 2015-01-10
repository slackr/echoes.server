module.exports = Tools;

function Tools(nicknames, channels) {
    this.nicknames = nicknames;
    this.channels = channels;
};

Tools.prototype.is_nickname = function(nick) {
    nick = (typeof nick == 'object' && typeof nick.name != 'undefined' ? nick.name : nick);
    if (typeof this.nicknames != 'undefined'
        && typeof this.nicknames[nick] == 'object') {
        return true;
    }
    return false;
}

Tools.prototype.is_string = function(string) {
    return (typeof string == 'string' && string.length > 0);
}


Tools.prototype.is_channel = function(channel) {
    if (typeof this.channels[channel] == 'undefined') {
        return false;
    }
    return true;
}

Tools.prototype.is_in = function(nick, channel) {
    if (! this.is_channel(channel)
        || typeof this.channels[channel].members[nick] == 'undefined') {
        return false;
    }
    return true;
}

Tools.prototype.who = function() {
    var nicks = Object.keys(this.nicknames);

    return nicks;
}

Tools.prototype.list = function() {
    var chans = Object.keys(this.channels);

    return chans;
};

Tools.prototype.ulist = function(id, rooms) {
    var chans = [];

    chans = JSON.parse(JSON.stringify(rooms)); // pass by value
    chans.splice(chans.indexOf(id), 1); // don't send back default client.id channel

    return chans;
}
