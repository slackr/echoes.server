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
var EchoesServer = require('./lib/echoes.js');

var express = require('express');
var app = express();
//app.use('/lib', express.static(__dirname + '/lib'));

var request = require('request');
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
    var incoming_ip = client.handshake.headers['x-forwarded-for'] || client.handshake.address.address;

    var nick = new Nickname(incoming_nickname, client.id);
    client.fatal_error = '';
    if (! nick.sane) {
        client.fatal_error = 'nick_invalid';
        $server.log('invalid nick: ' + nick.name, 3);
    }

    $server.log(nick.name + ' (' + client.id + '@' + incoming_ip + ') is attempting to connect via: ' + client.request._query.transport);

    if ($server.is_nickname(nick.name)) {
        client.fatal_error = 'nick_exists';
        $server.log('nick exists: ' + nick.name, 3);
    }

    client.nickname = nick.name;
    client.session_id = incoming_session_id;
    client.session_ip = incoming_ip;

    return next();
});

io.on('connection', function(client) {
    if (client.fatal_error != '') {
        io.to(client.id).emit('*fatal', client.fatal_error);
        client.disconnect();
        return;
    }

    request.post(AppConfig.PARALLAX_AUTH + '/verify-session/', {
        form: {
            identity: client.nickname,
            session_id: client.session_id,
            session_ip: client.session_ip,
        }},
        (function(client, io) {
            return function(error, status, response) {
                if (error) {
                    io.to(client.id).emit('*fatal', 'auth_http_error');
                    client.disconnect();
                    return;
                }

                try {
                    response = JSON.parse(response);
                } catch(e) {
                    response = { status: 'error', message: e.message };
                }

                $server.log('auth response: ' + JSON.stringify(response), 0);

                if (response.status != 'success') {
                    io.to(client.id).emit('*fatal', 'auth_invalid_session');
                    client.disconnect();
                    return;
                }

                $server.attach_events(client);

                $server.log(client.nickname + ' (' + client.id + '@' + client.handshake.address + ') connected via: ' + client.request._query.transport);
                client.broadcast.emit('*connect', { nickname: client.nickname });

                $nicknames[client.nickname] = new Nickname(client.nickname, client.id);
            }
        })(client, io)
    );

    client.on('disconnect', function() {
        $server.log(client.nickname + ' disconnected');
        client.broadcast.emit('*disconnect', { nickname: client.nickname });

        if (typeof $nicknames[client.nickname] != 'undefined') {

            $server.log('on disconnect: parting ' + client.nickname + ' from joined channels', 0);

            for (var i in $nicknames[client.nickname].channels) {
                $channels[$nicknames[client.nickname].channels[i]].part($nicknames[client.nickname]);
            }

            $server.log('on disconnect: forgetting ' + client.nickname, 0);
            delete $nicknames[client.nickname];
        } else {
            $server.log('on disconnect: ' + client.nickname + ' was not tracked', 0);
        }
    });
});

http.listen(port, function(){
    $server.log('listening on *:' + port);
});
