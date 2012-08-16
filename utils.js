var config = require('./config.json')
	, common = require('./common');

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
 * Get Cominy User Info
 */

exports.getCominyUserInfo = function(req, res, next){
logger.info("+++ getCominyUserInfo +++");
	var cookieArray = req.headers.cookie.split(';');

logger.info(cookieArray);
	for(var i = 0; i < cookieArray.length; i++){
		if( cookieArray[i].indexOf(config.cominy.cookiekey) !== -1){
			var sid = cookieArray[i].split('=')[1];
		}
	}
	if (sid) {
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
				var rpcclient = xmlrpc.createClient(config.cominy.rpcclient);

				// Sends a method call to the XML-RPC server
	   		rpcclient.methodCall(config.cominy.rpcmethod, [param], function (error, value) {
					// Results of the method response
					// Store image_url
					req.session.image_url = value.image_url;
					next();
	  		})
			}, 1000)
		});
	} else {
		// TODO
		if (!req.session.image_url) {
			req.session.image_url = config.guest.image_url;
		}
		next();
	}
};

/*
 * Get Room Info
 */

exports.getRoomInfo = function(req, res, client, fn) { 
logger.info("+++ getRoomInfo start +++");
  client.hgetall('rooms:' + req.params.id + ':info', function(err, room) {
    if(!err && room && Object.keys(room).length) fn(room);
    else res.redirect('back');
  });
logger.info("+++ getRoomInfo end +++");
};

exports.getPublicRoomsInfo = function(client, fn) {
logger.info("+++ getPublicRoomsInfo start +++");
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
logger.info("+++ getPublicRoomsInfo end +++");
};

/*
 * Get connected users at room
 */

exports.getUsersInRoom = function(req, res, client, room, fn) {
logger.info("+++ getUserInRoom start +++");
  client.smembers('rooms:' + req.params.id + ':online', function(err, online_users) {
    var users = [];

    online_users.forEach(function(username, index) {
			client.get('users:' + username + ':status', function(err, status) {
        users.push({
            username: username
					,	image_url: req.session.image_url
          , status: status || 'available'
        });
      });
    });

    fn(users);
  });
logger.info("+++ getUserInRoom end +++");
};

/*
 * Get public rooms
 */

exports.getPublicRooms = function(client, fn){
logger.info("+++ getPublicRooms start +++");
  client.smembers("comima:public:rooms", function(err, rooms) {
    if (!err && rooms) fn(rooms);
    else fn([]);
  });
logger.info("+++ getPublicRooms end +++");
};

/*
 * Get User status
 */

exports.getUserStatus = function(req, client, fn){
logger.info("+++ getUserStatus start +++");
	client.get('users:' + req.session.username + ':status', function(err, status) {
    if (!err && status) fn(status);
    else fn('available');
  });
logger.info("+++ getUserStatus end +++");
};

/*
 * Enter to a room
 */

exports.enterRoom = function(req, res, client, room, users, rooms, status){
logger.info("+++ enterRoom start +++");
  res.locals({
    room: room,
    rooms: rooms,
    user: {
      nickname: req.session.username,
			image_url: req.session.image_url,
      status: status
    },
    users_list: users
  });
  res.render('room');
logger.info("+++ enterRoom end +++");
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


