var socketio = require('socket.io');
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};

exports.listen = function(server) {
  // Start the Socket.io server, allowing it to piggyback on the existing HTTP server
  io = socketio.listen(server);

  // reduce logging warn
  // https://github.com/LearnBoost/Socket.IO/wiki/Configuring-Socket.IO
  io.set('log level', 1);
  // -----
  io.sockets.on('connection', function(socket){ // Define how each user connection will be handled
    // Assign user a guest name when they connect
    guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);

      // Place user in the "Lobby" room when they connect
      joinRoom(socket, 'Lobby');

      // Handle user messages
      handleMessageBroadcasting(socket, nickNames);
       // name change attempts
      handleNameChangeAttempts(socket, nickNames, namesUsed);
      // room creation/changes.
      handleRoomJoining(socket);

        // Provide user with a list of occupied rooms on request.
        socket.on('rooms', function(){
          socket.emit('rooms', io.sockets.manager.rooms);
        });

        // Define "cleanup" logic for when a user disconnects
        handleClientDisconnection(socket, nickNames, namesUsed);
  });

};

function assignGuestName(socket, guestNumber, nickNames, namesUsed){
  // https://github.com/LearnBoost/socket.io/wiki/Rooms

  // Generate new guest name
  var name = 'Guest'+ guestNumber;
  // Associate guest name with client connection ID
  nickNames[socket.id] = name;

  // Let user know their guest name
  socket.emit('nameResult',{
    success: true,
    name: name
  });

  // Note that guest name is now used
  namesUsed.push(name);

  return guestNumber + 1; // Increment counter used to generate guest names
}

function joinRoom(socket, room){

  // https://github.com/LearnBoost/socket.io/wiki/Rooms

  // Make user join room
  socket.join(room);

  // Note that user is now in this room
  currentRoom[socket.id] = room;

  // Let user know they're now in a new room
  socket.emit('joinRoom', {room: room});

    // Let other users in room know that a user has joined
  socket.broadcast.to(room).emit('message', {
        text: nickNames[socket.id] + ' has joined ' + room + '.'
  });
    
    // This will return Socket instances of all clients in the room.
     var usersInRoom = io.sockets.clients(room);


    // If other users exist, summarize who they are
    if (usersInRoom.length > 1) {
      var usersInRoomSummary = 'Users Currently in ' + room + ': ';
      for(var index in usersInRoom){
        var userSocketId = usersInRoom[index].id;

        if (userSocketId != socket.id) {

          if (index > 1) {
            usersInRoomSummary += ', ';
          }

          usersInRoomSummary += nickNames[userSocketId];
        }
      }
      usersInRoomSummary += '.';

      // Send the summary of other users in the room to the user
      socket.emit('message', {text: usersInRoomSummary});
    }
}
function handleNameChangeAttempts(socket, nickNames, namesUsed){
    // Added listener for nameAttempt events
    socket.on('nameAttempt', function(name){
      // String.prototypeindexOf()
      // str.indexOf(searchValue[, fromIndex])
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/
      // Global_Objects/String/indexOf?redirectlocale=en-US&redirectslug=JavaScript%2
      // FReference%2FGlobal_Objects%2FString%2FindexOf

      // Don't allow nickNames to begin with "Guest"
      if (name.indexOf('Guest') == 0) {
        socket.emit('nameResult', {
            success: false,
            message: 'Names cannot begin with "Guest".'
        });

      } else {
        if (namesUsed.indexOf() == -1) {
          var previousName = nickNames[socket.id];
          var previousNameIndex = namesUsed.indexOf(previousName);

          namesUsed.push(name);
          nickNames[socket.id] = name;

          delete previousName[previousNameIndex];

          socket.emit('nameResult', {
            success: true,
            name: name
          });
          socket.broadcast.to(currentRoom[socket.id]).emit('message', {
            text: previousName + ' is now know as ' + name + '.'
          });
        } else {
          socket.emit('nameResult', {
            success: false,
            message: 'That name is already in use.'
          });
        }
      }
    });
}

function handleMessageBroadcasting(socket, nickNames) {
  socket.on('message', function(message){
    socket.broadcast.to(message.room).emit('message', {
      text: nickNames[socket.id] + ' : ' + message.text
    });
  });
}

function handleRoomJoining(socket) {
  socket.on('join', function(room) {
    // Leaving a room is achieved by calling the
    // leave() function on a connected socket object.
    socket.leave(currentRoom[socket.id]);
    joinRoom(socket, room.newRoom);
  });
}

function handleClientDisconnection(socket) {
  socket.on('disconnect', function(){
    var nameIndex = namesUsed.indexOf(nickNames);
    delete namesUsed[nameIndex];
    delete nickNames[socket.id];
  });
}



