/**
 * simple ws chat from socket.io :)
 *
 */

var http = require('http').Server();
var io = require('socket.io')(http);

io.use(function(client, next) {
    var handshake = client.request;
    console.log(JSON.stringify(handshake._query));

    client.request.nickname = handshake._query.nickname;
    
    next();
});

io.on('connection', function(client) {
    var nickname = client.request.nickname ? client.request.nickname : client.id;
    console.log(nickname + ' connected');

    client.on('/echo', function(echo){
        if (echo.channel) {
            io.to(echo.channel).emit('*echo', echo);
        } else {
            io.emit('*echo', echo);
        }
        console.log('echo: ' + JSON.stringify(echo));
    });

    client.on('/join', function(args) {
        var channel = args[0];

        client.join(channel);
        io.to(channel).emit('*join', { nickname: nickname, channel: channel });

        console.log(nickname + ' joined ' + channel);
    });

    client.on('/part', function(args) {
        var channel = args[0];

        io.to(channel).emit('*part', { nickname: nickname, channel: channel });
        client.leave(channel);

        console.log(nickname + ' parted ' + channel);
    });

    client.on('/list', function(args) {
        var channels = JSON.parse(JSON.stringify(client.rooms)); // pass by value
        channels.splice(channels.indexOf(client.id), 1); // don't send back default client.id channel
        io.to(client.id).emit('*list', { channels: channels });

        console.log(nickname + ' is in ' + JSON.stringify(channels));
    });

    client.on('disconnect', function() {
        console.log(nickname + ' disconnected');
    });
});

http.listen(3000, function(){
    console.log('listening on *:3000');
});
