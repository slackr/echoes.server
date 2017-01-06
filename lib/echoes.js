/**
 * Echoes Server
 *
 * @author  Adrian@Slacknet
 * @license http://www.gnu.org/licenses/gpl-3.0.txt GPLv3
 */

module.exports = EchoesServer;

var Nickname = require('./nickname.js');
var Channel = require('./channel.js');

function EchoesServer(nicknames, channels, io) {
    EchoesObject.call(this, 'server');

    this.nicknames = nicknames;
    this.channels = channels;
    this.io = io;
}

EchoesServer.prototype = Object.create(EchoesObject.prototype);
EchoesServer.prototype.constructor = EchoesServer;

EchoesServer.prototype.is_nickname = function(nick) {
    nick = (typeof nick == 'object' && typeof nick.name != 'undefined' ? nick.name : nick);
    if (typeof this.nicknames != 'undefined' && 
        typeof this.nicknames[nick] == 'object') {
        return true;
    }
    return false;
};

EchoesServer.prototype.is_string = function(string) {
    return (typeof string == 'string' && string.length > 0);
};


EchoesServer.prototype.is_channel = function(channel) {
    if (typeof this.channels[channel] == 'undefined') {
        return false;
    }
    return true;
};

EchoesServer.prototype.is_nickname = function(nickname) {
    if (typeof this.nicknames[nickname] == 'undefined') {
        return false;
    }
    return true;
};

EchoesServer.prototype.is_in = function(nick, channel) {
    if (! this.is_channel(channel) || 
        typeof this.channels[channel].members[nick] == 'undefined') {
        return false;
    }
    return true;
};

EchoesServer.prototype.who = function(nick, chan) {
    var nicks = [];

    nicks = Object.keys(this.channels[chan].members);
    //nicks.splice(nicks.indexOf(nick), 1); // let the client strip this out

    return nicks;
};

EchoesServer.prototype.list = function() {
    var chans = Object.keys(this.channels);

    return chans;
};

EchoesServer.prototype.ulist = function(nick) {
    var chans = [];
        
    Object.keys(this.channels).forEach(function(chan){
        if (this.is_in(nick, chan)) {
            chans.push(chan);
        }
    });
    
    return chans;
};

EchoesServer.prototype.clean_xff_header = function(xff) {
    var hosts = xff.split(',');

    for (var h = 0; typeof hosts[h] != "undefined"; h++) {
        hosts[h] = hosts[h].split(':').shift(1);
    }

    return hosts.join(",");
};

EchoesServer.prototype.attach_events = function(client) {
    var self = this;

    this.io.to(client.id).emit('*me', client.nickname);

    this.log('attaching events for ' + client.nickname + ' (' + client.id + ')', 1);

    client.on('/echo', function(echo) {
        if (self.is_channel(echo.to)) {
            if (! self.is_in(client.nickname, echo.to)) {
                self.error(client, 'You are not in ' + echo.to + '. /join first');
                return;
            }

            client.broadcast.to(echo.to).emit('*echo', {
                from: client.nickname,
                echo: echo.echo,
                to: echo.to,
                type: 'channel',
            });
        } else if (self.is_nickname(echo.to)) {
            var broadcast = {
                from: client.nickname,
                echo: echo.echo,
                to: echo.to,
                type: (echo.type == 'encrypted' ? 'encrypted' : 'pm'),
            };

            self.io.to(self.nicknames[echo.to].id).emit('*echo', broadcast);
            if (echo.type == 'encrypted') {
                self.io.to(client.id).emit('*eecho_sent', broadcast);
            }
        } else {
            client.broadcast.emit('*echo', {
                from: client.nickname,
                echo: echo.echo,
                to: echo.to,
                type: 'all',
            });
        }

        self.log('echo (' + client.nickname + '): ' + JSON.stringify(echo), 0);
    });

    client.on('!keyx', function(data) {
        var nick = data.to;
        var pubkey = data.pubkey;
        var keychain = data.keychain;
        var symkey = data.symkey;

        if (! self.is_nickname(nick)) {
            self.error(client, 'No such nickname: ' + nick);
            return;
        }
        if (typeof pubkey != 'object' && 
            typeof pubkey != 'string') {
            self.error(client, 'Invalid pubkey. Will not broadcast key exchange to: ' + nick);
            return;
        }
        if (typeof keychain != 'object' && 
            typeof keychain != 'string') {
            self.error(client, 'Invalid keychain. Will not broadcast key exchange to: ' + nick);
            return;
        }

        var broadcast = {
            to: nick,
            from: client.nickname,
            pubkey: pubkey,
            keychain: keychain,
            symkey: symkey
        };

        self.io.to(self.nicknames[nick].id).emit('*keyx', broadcast);
        self.io.to(client.id).emit('*keyx_sent', broadcast);

        self.log('keyx: ' + JSON.stringify(broadcast));
    });
    client.on('!keyx_off', function(data) {
        var nick = data.to;

        if (! self.is_nickname(nick)) {
            error('No such nickname: ' + nick);
            return;
        }

        var broadcast = { to: nick, from: client.nickname };
        self.io.to(self.nicknames[nick].id).emit('*keyx_off', broadcast);

        self.log('keyx_off: ' + JSON.stringify(broadcast));
    });
    client.on('!keyx_unsupported', function(data){
        var nick = data.to;

        if (! self.is_nickname(nick)) {
            self.error(client, 'No such nickname: ' + nick);
            return;
        }

        var broadcast = { to: nick, from: client.nickname };
        self.io.to(self.nicknames[nick].id).emit('*keyx_unsupported', broadcast);

        self.log('keyx_unsupported ' + JSON.stringify(broadcast));
    });

    client.on('/join', function(args) {
        var chan = new Channel(args[0]);
        if (! chan.sane) {
            self.error(client, 'Invalid channel name: ' + args[0]);
            return;
        }

        if (self.is_in(client.nickname, chan.name)) {
            self.error(client, 'You are already in ' + chan.name);
            return;
        }

        client.join(chan.name);

        if (! self.is_channel(chan.name)) {
            self.channels[chan.name] = chan;
        }

        self.channels[chan.name].join(self.nicknames[client.nickname]);
        self.nicknames[client.nickname].channels.push(chan.name);

        self.io.to(chan.name).emit('*join', { nickname: client.nickname, channel: chan.name });
        self.log(client.nickname + ' joined ' + chan.name);
    });

    client.on('/part', function(args) {
        var chan = new Channel(args[0]);
        if (! chan.sane) {
            self.error(client, 'Invalid channel name: ' + args[0]);
            return;
        }

        args.shift();
        var reason = args.join(' ');

        if (! self.is_in(client.nickname, chan.name)) {
            self.error(client, 'You are not in ' + chan.name);
            return;
        }

        self.io.to(chan.name).emit('*part', { nickname: client.nickname, channel: chan.name, reason: reason });

        client.leave(chan.name);
        self.channels[chan.name].part(self.nicknames[client.nickname]);
        delete self.nicknames[client.nickname].channels[self.nicknames[client.nickname].channels.indexOf(chan.name)];

        self.log(client.nickname + ' parted ' + chan.name);
    });

    client.on('/list', function(args) {
        var chans = self.list();

        self.io.to(client.id).emit('*list', { channels: chans });
    });

    client.on('/ulist', function(args) {
        var chans = self.ulist(client.nickname);

        if (chans.length === 0) {
            self.error(client, 'You are not in any channels. /join one first');
            return;
        }
        self.io.to(client.id).emit('*ulist', { channels: chans });
    });

    client.on('/who', function(chan) {
        if (! self.is_channel(chan)) {
            self.error(client, 'No such channel: ' + chan);
            return;
        }
        var nicks = self.who(client.nickname, chan);

        self.io.to(client.id).emit('*who', { nicknames: nicks, channel: chan });
    });

    client.on('/pm', function(nick) {
        if (! self.is_nickname(nick)) {
            self.error(client, 'No such nickname: ' + nick);
            return;
        }
        self.log('pm request from ' + client.nickname + ' to ' + nick);
        self.io.to(client.id).emit('*pm', nick);
    });
};

EchoesServer.prototype.error = function(client, message) {
    this.log('error to ' + client.nickname + ': ' + message, 1);
    this.io.to(client.id).emit('*error', message);
};
