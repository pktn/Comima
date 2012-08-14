var config = require('./config.json');

/*
 * Restrict paths
 */

exports.restrict = function(req, res, next){
next();
//  if(req.isAuthenticated()) next();
//  else res.redirect('/');
};

/*
 * Generates a URI Like key for a room
 */       

exports.genRoomKey = function(roomName) {
  return roomName.replace(/[^a-zA-Z0-9-_]/g, '');
};

/*
 * Room name is valid
 */

exports.validRoomName = function(req, res, fn) {
  var roomKey = exports.genRoomKey(req.body.room_name)
    , keyLen = roomKey.length
    , nameLen = req.body.room_name.length;

  if(nameLen < 255 && keyLen >0) {
    fn(roomKey);
  } else {
    res.redirect('back');
  }
};

/*
 * Checks if room exists
 */

exports.roomExists = function(req, res, client, roomKey, fn) {
  client.exists('rooms:' + req.body.roomKey + ':info', function(err, exists) {
    if(!err && exists) {
      res.redirect( '/rooms/' + req.body.roomKey );
    } else {
      fn()
    }
  });
};

/*
 * Creates a room
 */       
exports.createRoom = function(req, res, client, roomKey) {
  var room = {
    key: roomKey,
    name: req.body.room_name,
    admin: req.body.username,
    locked: 0,
    online: 0
  };

	// save
  client.hmset('rooms:' + roomKey + ':info', room, function(err, ok) {
    if(!err && ok) {
      client.sadd('comima:public:rooms', roomKey);
			// store username
			req.session.username = req.body.username;
      res.redirect('/rooms/' + roomKey);
    } else {
      res.send(500);
    }
  });

};

/*
 * Get Room Info
 */

exports.getRoomInfo = function(req, res, client, fn) { 
  client.hgetall('rooms:' + req.params.id + ':info', function(err, room) {
    if(!err && room && Object.keys(room).length) fn(room);
    else res.redirect('back');
  });
};

exports.getPublicRoomsInfo = function(client, fn) {
  client.smembers('comima:public:rooms', function(err, publicRooms) {
    var rooms = []
      , len = publicRooms.length;
    if(!len) fn([]);

    publicRooms.sort(exports.caseInsensitiveSort);

    publicRooms.forEach(function(roomKey, index) {
      client.hgetall('rooms:' + roomKey + ':info', function(err, room) {
        // prevent for a room info deleted before this check
        if(!err && room && Object.keys(room).length) {
          // add room info
          rooms.push({
            key: room.key || room.name, // temp
            name: room.name,
            online: room.online || 0
          });

          // check if last room
          if(rooms.length == len) fn(rooms);
        } else {
          // reduce check length
          len -= 1;
        }
      });
    });
  });
};
/*
 * Get connected users at room
 */

exports.getUsersInRoom = function(req, res, client, room, fn) {
  client.smembers('rooms:' + req.params.id + ':online', function(err, online_users) {
    var users = [];

    online_users.forEach(function(username, index) {
      client.get('users:' + username + ':status', function(err, status) {
        users.push({
            username: username
          , status: status || 'available'
        });
      });
    });

    fn(users);

  });
};

/*
 * Get public rooms
 */

exports.getPublicRooms = function(client, fn){
  client.smembers("comima:public:rooms", function(err, rooms) {
    if (!err && rooms) fn(rooms);
    else fn([]);
  });
};
/*
 * Get User status
 */

exports.getUserStatus = function(req, client, fn){
  client.get('users:' + req.session.username + ':status', function(err, status) {
    if (!err && status) fn(status);
    else fn('available');
  });
};

/*
 * Enter to a room
 */

exports.enterRoom = function(req, res, client, room, users, rooms, status){
  res.locals({
    room: room,
    rooms: rooms,
    user: {
      nickname: req.session.username,
      status: status
    },
    users_list: users
  });
  res.render('room');
};

/*
 * Get Cominy User Info
 */

exports.getCominyUserInfo = function(req, res, next){
	var cookieArray = req.headers.cookie.split(';');

	for(var i = 0; i < cookieArray.length; i++){
		if( cookieArray[i].indexOf(config.cominy.cookiekey) !== -1){
			var sid = cookieArray[i].split('=')[1];

			// Fetch Cominy Session File
			var xmlrpc = require('xmlrpc');
			var fs = require('fs');

			fs.readFile(config.cominy.sessionfilepath + sid, function(err, data){
  			if(err) {
					logger.error("Could not open file: " + err);
					process.exit(1);
				}
				var uid_str = data.toString().split('|')[2];
				var uid = uid_str.match(/s:6:"(\d+)"/)[1];

				// Waits briefly to give the XML-RPC server time to start up and start
				// listening
				setTimeout(function () {

					// Creates an XML-RPC client. Passes the host information on where to
					// make the XML-RPC calls.
					var param = {};
					param.target_c_member_id = param.my_c_member_id = uid;
					var client = xmlrpc.createClient(config.cominy.rpcclient);

					// Sends a method call to the XML-RPC server
   				client.methodCall(config.cominy.rpcmethod, [param], function (error, value) {
						// Results of the method response
						if (value.image_url) {
							logger.info(value.image_url);
						}
		  		})
				}, 1000)
			});
		}
	}
	next();
};

/*
 * Sort Case Insensitive
 */

exports.caseInsensitiveSort = function (a, b) { 
   var ret = 0;

   a = a.toLowerCase();
   b = b.toLowerCase();

   if(a > b) ret = 1;
   if(a < b) ret = -1; 

   return ret;
};

/*
 * Dump Object
 */

exports.dumpObject = function (o) {
	var str = "";
	for(var i in o) {
		str = str + "\n" + i + "\t"+ o[i];
	}
	logger.debug(str);
};
