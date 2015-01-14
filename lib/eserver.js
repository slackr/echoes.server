module.exports = EchoesServer;

function EchoesServer(nicknames, channels) {
    EchoesObject.call(this, 'server');

    this.nicknames = nicknames;
    this.channels = channels;
};

EchoesServer.prototype = Object.create(EchoesObject.prototype);
EchoesServer.prototype.constructor = EchoesServer;

EchoesServer.prototype.is_nickname = function(nick) {
    nick = (typeof nick == 'object' && typeof nick.name != 'undefined' ? nick.name : nick);
    if (typeof this.nicknames != 'undefined'
        && typeof this.nicknames[nick] == 'object') {
        return true;
    }
    return false;
}

EchoesServer.prototype.is_string = function(string) {
    return (typeof string == 'string' && string.length > 0);
}


EchoesServer.prototype.is_channel = function(channel) {
    if (typeof this.channels[channel] == 'undefined') {
        return false;
    }
    return true;
}

EchoesServer.prototype.is_nickname = function(nickname) {
    if (typeof this.nicknames[nickname] == 'undefined') {
        return false;
    }
    return true;
}

EchoesServer.prototype.is_in = function(nick, channel) {
    if (! this.is_channel(channel)
        || typeof this.channels[channel].members[nick] == 'undefined') {
        return false;
    }
    return true;
}

EchoesServer.prototype.who = function(nick) {
    var nicks = [];

    nicks = JSON.parse(JSON.stringify(Object.keys(this.nicknames))); // pass by value
    //nicks.splice(nicks.indexOf(nick), 1); // let the client strip this out

    return nicks;
}

EchoesServer.prototype.list = function() {
    var chans = Object.keys(this.channels);

    return chans;
};

EchoesServer.prototype.ulist = function(id, rooms) {
    var chans = [];

    chans = JSON.parse(JSON.stringify(rooms)); // pass by value
    chans.splice(chans.indexOf(id), 1); // don't send back default client.id channel

    return chans;
}
