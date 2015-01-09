/**
 * simple ws chat from socket.io :)
 *
 */

var Nickname = require('./lib/nickname.js');
var Channel = require('./lib/channel.js');

var http = require('http').Server();
var io = require('socket.io')(http);

var $nicknames = {};
var $channels = {};

io.use(function(client, next) {
    var handshake = client.request;
    console.log(JSON.stringify(handshake._query));

    client.request.nickname = handshake._query.nickname;
    client.nick = new Nickname(client.request.nickname, client.id)
    $nicknames[client.nick.name] = client.nick;

    next();
});

io.on('connection', function(client) {
    console.log(client.nick.name + ' connected');

    client.on('/echo', function(echo) {
        if (is_channel(echo.channel)
            && is_in(client.nick.name, echo.channel)) {
            io.to(echo.channel).emit('*echo', {
                nickname: client.nick.name,
                echo: echo.echo,
                channel: echo.channel
            });
        } else {
            io.emit('*echo', {
                nickname: client.nick.name,
                echo: echo.echo
            });
        }

        console.log('echo (' + client.nick.name + '): ' + JSON.stringify(echo));
    });

    client.on('!keyx', function(data){
        var nick = data.to;
        var pubkey = data.pubkey;

        if (typeof $nicknames[nick] != 'object') {
            error('No such nickname: ' + nick);
            return;
        }

        var broadcast = { to: nick, from: client.nick.name, pubkey: pubkey };
        io.to($nicknames[nick].id).emit('*keyx', broadcast);
        io.to(client.id).emit('*keyx_sent', broadcast);

        console.log('keyx: ' + JSON.stringify(broadcast));
    });
    client.on('!eecho', function(eecho){
        var nick = eecho.to;
        var echo = eecho.echo;

        if (typeof $nicknames[nick] != 'object') {
            error('No such nickname: ' + nick);
            return;
        }

        var broadcast = { to: nick, from: client.nick.name, echo: echo };
        io.to($nicknames[nick].id).emit('*eecho', broadcast);
        io.to(client.id).emit('*eecho_sent', broadcast);

        console.log('eecho: ' + JSON.stringify(broadcast));
    });

    client.on('/join', function(args) {
        if (! is_string(args[0])) {
            error('Invalid channel name: ' + args[0]);
            return;
        }
        var chan = new Channel(args[0]);

        if (is_in(client.nick.name, chan.name)) {
            error('You are already in ' + chan.name);
            return;
        }

        client.join(chan.name);

        if (! is_channel(chan.name)) {
            $channels[chan.name] = chan;
        }

        $channels[chan.name].join(client.nick);
        client.nick.channels.push(chan.name);

        io.to(chan.name).emit('*join', { nickname: client.nick.name, channel: chan.name });
        console.log(client.nick.name + ' joined ' + chan.name);
    });

    client.on('/part', function(args) {
        if (! is_string(args[0])) {
            error('Invalid channel name: ' + args[0]);
            return;
        }
        var chan = new Channel(args[0]);
        args.shift();
        var reason = args.join(' ');

        if (! is_in(client.nick.name, chan.name)) {
            error('You are not in ' + chan.name);
            return;
        }

        io.to(chan.name).emit('*part', { nickname: client.nick.name, channel: chan.name, reason: reason });

        client.leave(chan.name);
        $channels[chan.name].part(client.nick);
        delete $nicknames[client.nick.name].channels[$nicknames[client.nick.name].channels.indexOf(chan.name)];

        console.log(client.nick.name + ' parted ' + chan.name);
    });

    client.on('/list', function(args) {
        var chans = list();

        io.to(client.id).emit('*list', { channels: chans });
    });

    client.on('/ulist', function(args) {
        var chans = ulist();

        if (chans.length == 0) {
            error('You are not in any channels. /join one first');
            return;
        }
        io.to(client.id).emit('*ulist', { channels: chans });
    });

    client.on('/who', function(args) {
        var nicks = who();

        io.to(client.id).emit('*who', { nicknames: nicks });
    });

    client.on('disconnect', function() {
        if (typeof $nicknames == 'undefined'
            || typeof $nicknames[client.nick.name] == 'undefined') {
            console.log('undefined in nicks: ' + $nicknames);
        } else {
            console.log(client.nick.name + ' disconnected');

            $nicknames[client.nick.name].channels.forEach(function(val, index) {
                $channels[val].part($nicknames[client.nick.name]);
            });
            delete $nicknames[client.nick.name];
        }

    });

    function list() {
        var chans = [];
        chans = Object.keys($channels);

        console.log('list: ' + JSON.stringify(chans));
        return chans;
    };

    function ulist() {
        var chans = [];

        chans = JSON.parse(JSON.stringify(client.rooms)); // pass by value
        console.log(chans);
        chans.splice(chans.indexOf(client.id), 1); // don't send back default client.id channel

        console.log('list (' + client.nick.name + '): ' + JSON.stringify(chans));
        return chans;
    }

    function who() {
        var nicks = Object.keys($nicknames);

        console.log('who: ' + JSON.stringify(nicks));
        return nicks;
    }

    function error(message) {
        console.log('to ' + client.nick.name + ': ' + message);
        io.to(client.id).emit('*error', message);
    }

    function is_in(nick, channel) {
        if (! is_channel(channel)
            || typeof $channels[channel].members[nick] == 'undefined') {
            console.log(nick + ' is not in ' + channel);
            return false;
        }
        return true;
    }

    function is_channel(channel) {
        if (typeof $channels[channel] == 'undefined') {
            return false;
        }
        return true;
    }

    function is_string(string) {
        return (typeof string == 'string' && string.length > 0);
    }
});

http.listen(3000, function(){
    console.log('listening on *:3000');
});
