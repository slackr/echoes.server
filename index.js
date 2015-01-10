/**
 * simple ws chat from socket.io :)
 *
 */

var Nickname = require('./lib/nickname.js');
var Channel = require('./lib/channel.js');
var Tools = require('./lib/tools.js');

var express = require('express');
var app = express();
//app.use('/lib', express.static(__dirname + '/lib'));

var http = require('http').Server(app);
var io = require('socket.io')(http);

var $nicknames = {};
var $channels = {};
var $tools = new Tools($nicknames, $channels);

io.use(function(client, next) {
    var handshake = client.request;

    var nick = new Nickname(handshake._query.nickname, client.id);
    if (! nick.sane) {
        return next(new Error('Invalid nickname. Please try again'));
    }
    if ($tools.is_nickname(nick.name)) {
        return next(new Error('Nickname already exists. Please try something else'));
    }

    client.nickname = nick.name;
    $nicknames[nick.name] = nick;

    return next();
});

io.on('connection', function(client) {
    io.to(client.id).emit('*me', client.nickname);

    console.log(client.nickname + ' connected');

    client.on('/echo', function(echo) {
        if ($tools.is_channel(echo.channel)
            && $tools.is_in(client.nickname, echo.channel)) {
            io.to(echo.channel).emit('*echo', {
                nickname: client.nickname,
                echo: echo.echo,
                channel: echo.channel
            });
        } else {
            io.emit('*echo', {
                nickname: client.nickname,
                echo: echo.echo
            });
        }

        console.log('echo (' + client.nickname + '): ' + JSON.stringify(echo));
    });

    client.on('!keyx', function(data){
        var nick = data.to;
        var pubkey = data.pubkey;

        if (! $tools.is_nickname(nick)) {
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

        console.log('keyx: ' + JSON.stringify(broadcast));
    });
    client.on('!eecho', function(eecho){
        var nick = eecho.to;
        var echo = eecho.echo;

        if (! $tools.is_nickname(nick)) {
            error('No such nickname: ' + nick);
            return;
        }

        var broadcast = { to: nick, from: client.nickname, echo: echo };
        io.to($nicknames[nick].id).emit('*eecho', broadcast);
        io.to(client.id).emit('*eecho_sent', broadcast);

        console.log('eecho: ' + JSON.stringify(broadcast));
    });

    client.on('/join', function(args) {
        var chan = new Channel(args[0]);
        if (! chan.sane) {
            error('Invalid channel name: ' + args[0]);
            return;
        }

        if ($tools.is_in(client.nickname, chan.name)) {
            error('You are already in ' + chan.name);
            return;
        }

        client.join(chan.name);

        if (! $tools.is_channel(chan.name)) {
            $channels[chan.name] = chan;
        }

        $channels[chan.name].join($nicknames[client.nickname]);
        $nicknames[client.nickname].channels.push(chan.name);

        io.to(chan.name).emit('*join', { nickname: client.nickname, channel: chan.name });
        console.log(client.nickname + ' joined ' + chan.name);
    });

    client.on('/part', function(args) {
        var chan = new Channel(args[0]);
        if (! chan.sane) {
            error('Invalid channel name: ' + args[0]);
            return;
        }

        args.shift();
        var reason = args.join(' ');

        if (! $tools.is_in(client.nickname, chan.name)) {
            error('You are not in ' + chan.name);
            return;
        }

        io.to(chan.name).emit('*part', { nickname: client.nickname, channel: chan.name, reason: reason });

        client.leave(chan.name);
        $channels[chan.name].part($nicknames[client.nickname]);
        delete $nicknames[client.nickname].channels[$nicknames[client.nickname].channels.indexOf(chan.name)];

        console.log(client.nickname + ' parted ' + chan.name);
    });

    client.on('/list', function(args) {
        var chans = $tools.list();

        io.to(client.id).emit('*list', { channels: chans });
    });

    client.on('/ulist', function(args) {
        var chans = $tools.ulist(client.id, client.rooms);

        if (chans.length == 0) {
            error('You are not in any channels. /join one first');
            return;
        }
        io.to(client.id).emit('*ulist', { channels: chans });
    });

    client.on('/who', function(args) {
        var nicks = $tools.who();

        io.to(client.id).emit('*who', { nicknames: nicks });
    });

    client.on('disconnect', function() {
        if (typeof $nicknames == 'undefined'
            || typeof client == 'undefined'
            || typeof client.nick == 'undefined'
            || typeof $nicknames[client.nickname] == 'undefined') {
            console.log('undefined catch: ' + $nicknames);
            console.log('undefined catch: ' + $client);
        } else {
            console.log(client.nickname + ' disconnected');

            $nicknames[client.nickname].channels.forEach(function(chan, index) {
                $channels[chan].part($nicknames[client.nickname]);
            });
            delete $nicknames[client.nickname];
        }
    });

    function error(message) {
        console.log('to ' + client.nickname + ': ' + message);
        io.to(client.id).emit('*error', message);
    }
});

http.listen(3000, function(){
    console.log('listening on *:3000');
});
