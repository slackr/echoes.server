/**
 * simple ws chat from socket.io :)
 *
 */

var http = require('http').Server();
var io = require('socket.io')(http);

io.on('connection', function(socket) {
    console.log('nick connected');

    socket.on('echo', function(echo){
        console.log('echo: ' + echo);
        io.emit('echo', echo);
    });

    socket.on('disconnect', function() {
        console.log('nick disconnected');
    });
});

http.listen(3000, function(){
    console.log('listening on *:3000');
});
