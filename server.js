/**
 * simple ws chat from socket.io :)
 *
 */

var config_exists = function() {
    var f = null;
    try {
        f = require('fs').statSync('./lib/config.js').isFile();
        return true;
    } catch (e) {
        console.log('./lib/config.js not found (did you make one?), will use defaults...');
        return false;
    }
};

global.AppConfig = require((config_exists() ? './lib/config.js' : './lib/config.js.sample'));
global.EchoesObject = require('./lib/object.js');
var Nickname = require('./lib/nickname.js');
var Channel = require('./lib/channel.js');
var EchoesServer = require('./lib/eserver.js');

var express = require('express');
var app = express();
//app.use('/lib', express.static(__dirname + '/lib'));

var http = require('http').Server(app);
var io = require('socket.io')(http, {
    transports: AppConfig.ALLOWED_TRANSPORTS
});

var port = process.env.PORT || AppConfig.SERVER_PORT; // for azure's sake

var $nicknames = {};
var $channels = {};
var $s = new EchoesServer($nicknames, $channels);

io.use(function(client, next) {
    var handshake = client.request;

    var nick = new Nickname(handshake._query.nickname, client.id);
    client.fatal_error = '';
    if (! nick.sane) {
        client.fatal_error = 'nick_invalid';
        $s.log('invalid nick: ' + nick.name, 3);
    }

    $s.log(nick.name + ' (' + client.id + ') is attempting to connect via: ' + client.request._query.transport);

    if ($s.is_nickname(nick.name)) {
        client.fatal_error = 'nick_exists';
        $s.log('nick exists: ' + nick.name, 3);
    }

    client.nickname = nick.name;

    return next();
});

io.on('connection', function(client) {
    if (client.fatal_error != '') {
        io.to(client.id).emit('*fatal', client.fatal_error);
        client.disconnect();
        return;
    }

    io.to(client.id).emit('*me', client.nickname);

    $s.log(client.nickname + ' (' + client.id + ') connected via: ' + client.request._query.transport);
    client.broadcast.emit('*connect', { nickname: client.nickname });

    $nicknames[client.nickname] = new Nickname(client.nickname, client.id);

    client.on('/echo', function(echo) {
        if ($s.is_channel(echo.to)
            && $s.is_in(client.nickname, echo.to)) {
            client.broadcast.to(echo.to).emit('*echo', {
                from: client.nickname,
                echo: echo.echo,
                to: echo.to,
                type: 'channel',
            });
        } else if ($s.is_nickname(echo.to)) {
            var broadcast = {
                from: client.nickname,
                echo: echo.echo,
                to: echo.to,
                type: (echo.type == 'encrypted' ? 'encrypted' : 'pm'),
            };

            io.to($nicknames[echo.to].id).emit('*echo', broadcast);
            if (echo.type == 'encrypted') {
                io.to(client.id).emit('*eecho_sent', broadcast);
            }
        } else {
            client.broadcast.emit('*echo', {
                from: client.nickname,
                echo: echo.echo,
                to: echo.to,
                type: 'all',
            });
        }

        $s.log('echo (' + client.nickname + '): ' + JSON.stringify(echo), 0);
    });

    client.on('!keyx', function(data){
        var nick = data.to;
        var pubkey = data.pubkey;

        if (! $s.is_nickname(nick)) {
            error('No such nickname: ' + nick);
            return;
        }
        if (typeof pubkey != 'object'
            && typeof pubkey != 'string') {
            error('Invalid pubkey. Will not broadcast key exchange to: ' + nick);
            return;
        }

        var broadcast = { to: nick, from: client.nickname, pubkey: pubkey };
        io.to($nicknames[nick].id).emit('*keyx', broadcast);
        io.to(client.id).emit('*keyx_sent', broadcast);

        $s.log('keyx: ' + JSON.stringify(broadcast));
    });
    client.on('!keyx_off', function(data){
        var nick = data.to;

        if (! $s.is_nickname(nick)) {
            error('No such nickname: ' + nick);
            return;
        }

        var broadcast = { to: nick, from: client.nickname };
        io.to($nicknames[nick].id).emit('*keyx_off', broadcast);

        $s.log('keyx_off: ' + JSON.stringify(broadcast));
    });

    client.on('/join', function(args) {
        var chan = new Channel(args[0]);
        if (! chan.sane) {
            error('Invalid channel name: ' + args[0]);
            return;
        }

        if ($s.is_in(client.nickname, chan.name)) {
            error('You are already in ' + chan.name);
            return;
        }

        client.join(chan.name);

        if (! $s.is_channel(chan.name)) {
            $channels[chan.name] = chan;
        }

        $channels[chan.name].join($nicknames[client.nickname]);
        $nicknames[client.nickname].channels.push(chan.name);

        io.to(chan.name).emit('*join', { nickname: client.nickname, channel: chan.name });
        $s.log(client.nickname + ' joined ' + chan.name);
    });

    client.on('/part', function(args) {
        var chan = new Channel(args[0]);
        if (! chan.sane) {
            error('Invalid channel name: ' + args[0]);
            return;
        }

        args.shift();
        var reason = args.join(' ');

        if (! $s.is_in(client.nickname, chan.name)) {
            error('You are not in ' + chan.name);
            return;
        }

        io.to(chan.name).emit('*part', { nickname: client.nickname, channel: chan.name, reason: reason });

        client.leave(chan.name);
        $channels[chan.name].part($nicknames[client.nickname]);
        delete $nicknames[client.nickname].channels[$nicknames[client.nickname].channels.indexOf(chan.name)];

        $s.log(client.nickname + ' parted ' + chan.name);
    });

    client.on('/list', function(args) {
        var chans = $s.list();

        io.to(client.id).emit('*list', { channels: chans });
    });

    client.on('/ulist', function(args) {
        var chans = $s.ulist(client.id, client.rooms);

        if (chans.length == 0) {
            error('You are not in any channels. /join one first');
            return;
        }
        io.to(client.id).emit('*ulist', { channels: chans });
    });

    client.on('/who', function(args) {
        var nicks = $s.who(client.nickname);

        io.to(client.id).emit('*who', { nicknames: nicks });
    });

    client.on('/pm', function(nick) {
        if (! $s.is_nickname(nick)) {
            error('No such nickname: ' + nick);
            return;
        }
        $s.log('pm request from ' + client.nickname + ' to ' + nick);
        io.to(client.id).emit('*pm', nick);
    });

    client.on('disconnect', function() {
        if (typeof $nicknames == 'undefined'
            || typeof client == 'undefined'
            || typeof client.nickname == 'undefined'
            || typeof $nicknames[client.nickname] == 'undefined') {
            $s.log('undefined catch: ' + JSON.stringify($nicknames));
            $s.log('undefined catch: ' + JSON.stringify(client));
        } else {
            $s.log(client.nickname + ' disconnected');
            client.broadcast.emit('*disconnect', { nickname: client.nickname });

            $nicknames[client.nickname].channels.forEach(function(chan, index) {
                $channels[chan].part($nicknames[client.nickname]);
            });
            delete $nicknames[client.nickname];
        }
    });

    function error(message) {
        $s.log('error to ' + client.nickname + ': ' + message, 1);
        io.to(client.id).emit('*error', message);
    }
});

http.listen(port, function(){
    $s.log('listening on *:' + port);
});
