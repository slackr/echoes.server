/**
 * Echoes Server
 *
 * @author  Adrian@Slacknet
 * @license http://www.gnu.org/licenses/gpl-3.0.txt GPLv3
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
var $server = new EchoesServer($nicknames, $channels, io);

io.use(function(client, next) {
    var handshake = client.request;
    var incoming_nickname = handshake._query.nickname;
    var incoming_session_id = handshake._query.session_id;

    var nick = new Nickname(incoming_nickname, client.id);
    client.fatal_error = '';
    if (! nick.sane) {
        client.fatal_error = 'nick_invalid';
        $server.log('invalid nick: ' + nick.name, 3);
    }

    $server.log(nick.name + ' (' + client.id + ') is attempting to connect via: ' + client.request._query.transport);

    if ($server.is_nickname(nick.name)) {
        client.fatal_error = 'nick_exists';
        $server.log('nick exists: ' + nick.name, 3);
    }

    client.nickname = nick.name;
    client.session_id = incoming_session_id;

    return next();
});

io.on('connection', function(client) {
    if (client.fatal_error != '') {
        io.to(client.id).emit('*fatal', client.fatal_error);
        client.disconnect();
        return;
    }

    $server.attach_events(client);

    $server.log(client.nickname + ' (' + client.id + ') connected via: ' + client.request._query.transport);
    client.broadcast.emit('*connect', { nickname: client.nickname });

    $nicknames[client.nickname] = new Nickname(client.nickname, client.id);

    client.on('disconnect', function() {
        if (typeof $nicknames == 'undefined'
            || typeof client == 'undefined'
            || typeof client.nickname == 'undefined'
            || typeof $nicknames[client.nickname] == 'undefined') {
            $server.log('undefined catch: ' + JSON.stringify($nicknames));
            $server.log('undefined catch: ' + JSON.stringify(client));
        } else {
            $server.log(client.nickname + ' disconnected');
            client.broadcast.emit('*disconnect', { nickname: client.nickname });

            $nicknames[client.nickname].channels.forEach(function(chan, index) {
                $channels[chan].part($nicknames[client.nickname]);
            });
            delete $nicknames[client.nickname];
        }
    });
});

http.listen(port, function(){
    $server.log('listening on *:' + port);
});
