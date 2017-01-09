/**
 * Echoes Server
 *
 * @author  Adrian@Slacknet
 * @license http://www.gnu.org/licenses/gpl-3.0.txt GPLv3
 */

module.exports = EchoesServer;

var Nickname = require('./nickname.js');
var Channel = require('./channel.js');

/**
 * EchoesSeerver constructor=
 * 
 * @param {Array} nicknames An array of connected nicknames
 * @param {Array} channels  An array of created channels
 * @param {Socket} io       socket.io object
 */
function EchoesServer(nicknames, channels, io) {
    EchoesObject.call(this, 'server');

    this.nicknames = nicknames;
    this.channels = channels;
    this.io = io;
}

EchoesServer.prototype = Object.create(EchoesObject.prototype);
EchoesServer.prototype.constructor = EchoesServer;

/**
 * Verifies if 'nick' is a connected nickname. Does not verify if it 
 * is registered
 * 
 * @param  {string}  nick Nickname to check for
 * @returns {bool}      Is it a connected nickname?
 */
EchoesServer.prototype.is_nickname = function(nick) {
    nick = (typeof nick == 'object' && typeof nick.name != 'undefined' ? nick.name : nick);
    if (typeof this.nicknames != 'undefined' && 
        typeof this.nicknames[nick] == 'object') {
        return true;
    }
    return false;
};

/**
 * Checks if object is a string with non-zero length value
 * 
 * @param  {string}  string Value to check
 * @returns {bool}        Is it a string?
 */
EchoesServer.prototype.is_string = function(string) {
    return (typeof string == 'string' && string.length > 0);
};

/**
 * Verifies if the input is a created channel
 * 
 * @param  {string}  channel Channel name
 * @returns {bool}         Is it a channel?
 */
EchoesServer.prototype.is_channel = function(channel) {
    if (typeof this.channels[channel] == 'undefined') {
        return false;
    }
    return true;
};

/**
 * Checks if a nickname is in a channel
 * @param  {string}  nick    Nickname
 * @param  {string}  channel Channel
 * @returns {bool}         Is nick currently in channel?
 */
EchoesServer.prototype.is_in = function(nick, channel) {
    if (! this.is_channel(channel) || 
        typeof this.channels[channel].members[nick] == 'undefined') {
        return false;
    }
    return true;
};

/**
 * Return a list of channel members
 * @param  {string} nick Nickname, not used
 * @param  {string} chan Channel name
 * @returns {Array}      An array of nicknames currently in channel
 */
EchoesServer.prototype.who = function(nick, chan) {
    var nicks = [];

    nicks = Object.keys(this.channels[chan].members);
    //nicks.splice(nicks.indexOf(nick), 1); // let the client strip this out

    return nicks;
};

/**
 * Returns a list of created channels
 *
 * @returns {Array} An array of created channels
 */
EchoesServer.prototype.list = function() {
    var chans = Object.keys(this.channels);

    return chans;
};

/**
 * Returns a list of channels 'nick' has joined
 *
 * @param   {string} nick Nickname ot lookup
 *
 * @returns {Array}      An array of channels
 */
EchoesServer.prototype.ulist = function(nick) {
    var self = this;
    var chans = [];
        
    Object.keys(this.channels).forEach(function(chan){
        if (self.is_in(nick, chan)) {
            chans.push(chan);
        }
    });
    
    return chans;
};

/**
 * Cleans up the X-Forwarded-For header by removing ports:
 *
 * 127.0.0.1, 192.168.0.1:8443, 24.24.24.24 -> 127.0.0.1, 192.168.0.1, 24.24.24.24
 *
 * @param   {string} xff The XFF header in string format, values separated by commas
 *
 * @returns {string}     The cleaned up XFF string, sans port numbers
 */
EchoesServer.prototype.clean_xff_header = function(xff) {
    var hosts = xff.split(',');

    for (var h = 0; typeof hosts[h] != "undefined"; h++) {
        hosts[h] = hosts[h].split(':').shift(1);
    }

    return hosts.join(",");
};

/**
 * Attaches events to a connecting client
 *
 * Used to handle commands submitted to the server by each individual client
 * 
 * @param  {Socket} client The connecting socket.io client object
 * 
 * @returns {null}
 */
EchoesServer.prototype.attach_events = function(client) {
    var self = this;

    this.io.to(client.id).emit('*me', client.nickname);

    this.log('attaching events for ' + client.nickname + ' (' + client.id + ')', 1);

    /**
     * Route each message (echo) to either a channel, a pm, or an ecnrypted pm
     *
     * @param   {Object} echo  An JSON object containing the echo (msg) details
     * @returns {null}
     */
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

    /**
     * Route key exchange request from nick to nick
     *
     * @param   {Object} data  A JSON object containing route details
     *
     * @returns {null}
     */
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

/**
 * Send error message to client socket
 *
 * @param   {Socket} client  Socket.io object representation of a connected client
 * @param   {Object} message A JSON object containing error message details
 *
 * @returns {null}
 */
EchoesServer.prototype.error = function(client, message) {
    this.log('error to ' + client.nickname + ': ' + message, 1);
    this.io.to(client.id).emit('*error', message);
};
