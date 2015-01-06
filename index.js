/**
 * simple ws chat from socket.io :)
 *
 */

var Nickname = require('./lib/nickname.js');
var Channel = require('./lib/channel.js');
var nick = null;

var http = require('http').Server();
var io = require('socket.io')(http);


io.use(function(client, next) {
    var handshake = client.request;
    console.log(JSON.stringify(handshake._query));

    client.request.nickname = handshake._query.nickname;
    nick = new Nickname(client.request.nickname, client.id);

    next();
});

io.on('connection', function(client) {
    console.log(nick.name + ' connected');

    client.on('/echo', function(echo){
        if (echo.channel) {
            io.to(echo.channel).emit('*echo', echo);
        } else {
            io.emit('*echo', echo);
        }
        console.log('echo: ' + JSON.stringify(echo));
    });

    client.on('/join', function(args) {
        var channel = new Channel(args[0]);

        client.join(channel.name);
        io.to(channel.name).emit('*join', { nickname: nick.name, channel: channel.name });

        console.log(nick.name + ' joined ' + channel.name);
    });

    client.on('/part', function(args) {
        var channel = new Channel(args[0]);

        io.to(channel.name).emit('*part', { nickname: nick.name, channel: channel.name });
        client.leave(channel.name);

        console.log(nick.name + ' parted ' + channel.name);
    });

    client.on('/list', function(args) {
        var channels = JSON.parse(JSON.stringify(client.rooms)); // pass by value
        channels.splice(channels.indexOf(client.id), 1); // don't send back default client.id channel
        io.to(client.id).emit('*list', { channels: channels });

        console.log(nick.name + ' is in ' + JSON.stringify(channels));
    });

    client.on('disconnect', function() {
        console.log(nick.name + ' disconnected');
    });
});

http.listen(3000, function(){
    console.log('listening on *:3000');
});
