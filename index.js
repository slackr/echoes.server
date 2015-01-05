/**
 * simple ws chat from socket.io :)
 *
 */

var http = require('http').Server();
var io = require('socket.io')(http);

io.use(function(client, next) {
    var handshake = client.request;
    console.log(handshake.query);
    next();
});

io.on('connection', function(client) {
    console.log('nick connected');

    client.on('echo', function(echo){
        console.log('echo: ' + echo);
        io.emit('echo', echo);
    });

    client.on('/join', function(channel) {
        client.join(channel);
    });
    client.on('/part', function(channel) {
        client.leave(channel);
    });


    client.on('disconnect', function() {
        console.log('nick disconnected');
    });
});

http.listen(3000, function(){
    console.log('listening on *:3000');
});
