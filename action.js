var config = require('./config.json')
	, utils = require('./utils');

/*
 * Restrict paths
 */

exports.restrict = function(req, res, next){
	next();
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
    admin: req.body.nickname,
    locked: 0,
    online: 0
  };

	// save
  client.hmset('rooms:' + roomKey + ':info', room, function(err, ok) {
    if(!err && ok) {
      client.sadd('comima:public:rooms', roomKey);
			// store nickname
			req.session.nickname = req.body.nickname;
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
	log.debug("+++ getCominyUserInfo +++");

	if (req.headers.cookie) {
		var cookieArray = req.headers.cookie.split(';') ;
		var sid;

		for(var i = 0; i < cookieArray.length; i++){
			if( cookieArray[i].indexOf(config.cominy.cookiekey) !== -1){
				sid = cookieArray[i].split('=')[1];
			}
		}
	}

	if (sid) {
		// Fetch Cominy Session File
		var xmlrpc = require('xmlrpc');
		var fs = require('fs');

		fs.readFile(config.cominy.sessionfilepath + sid, function(err, data){
  		if(err) {
				log.debug("could not open file : " + err);
				req.session.is_guest = true;
				next();
				return;
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
					// Store nickname and image_url
					req.session.user_id = value.c_member_id;
					req.session.nickname = value.nickname;
					req.session.image_url = value.image_url;
					req.session.is_guest = false;

					next();
	  		})
			}, 1000)
		});

	} else {
		req.session.is_guest = true;
		next();
	}
};

/*
 * Set Image Url
 */

exports.getUserInfo = function(req, res, client, next) {
	log.debug("+++ getUserInfo start +++");

	// set userinfo of new guest
	if (req.session.is_guest && !req.session.user_id) {
		client.incrby('comima:guest-num', 1, function(err, num) {
  	  req.session.user_id = req.session.nickname = 'guest-' + num;
			req.session.image_url = config.guest.image_url;
			req.session.status = 'available';
	  });
	}

	// status
	req.session.status = req.session.status || 'available';

	client.hgetall('users:' + req.session.user_id + ':info', function(err, user) {
		// first access or if user info is changed
		if (!user || 
				user.image_url !== req.session.image_url ||
				user.nickname  !== req.session.nickname) {

			// set user info
			client.hmset(
				'users:' + req.session.user_id + ':info',
				'user_id', req.session.user_id,
				'image_url', req.session.image_url,
				'nickname', req.session.nickname,
				'status', req.session.status,

				function(err, ok) {
					log.debug("+++ getUserInfo end (set value) +++");
					next();
				}
			);
		} else {
			log.debug("+++ getUserInfo end (not set value) +++");
			next();
		}
	});
};

/*
 * Get Room Info
 */

exports.getRoomInfo = function(req, res, client, fn) { 
	log.debug("+++ getRoomInfo start +++");

  client.hgetall('rooms:' + req.params.id + ':info', function(err, room) {
    if(!err && room && Object.keys(room).length) fn(room);
    else res.redirect('back');
  });

	log.debug("+++ getRoomInfo end +++");
};

exports.getPublicRoomsInfo = function(client, fn) {
	log.debug("+++ getPublicRoomsInfo start +++");

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
	log.debug("+++ getPublicRoomsInfo end +++");
};

/*
 * Get connected users at room
 */

exports.getUsersInRoom = function(req, res, client, room, fn) {
	log.debug("+++ getUserInRoom start +++");

  client.smembers('rooms:' + req.params.id + ':online', function(err, online_users) {
    var users = [];
    online_users.forEach(function(user_id, index) {
			utils.getUserInfo(user_id, function(user) {
	      users.push(user);
			});
    });

    fn(users);
  });
	log.debug("+++ getUserInRoom end +++");
};

/*
 * Get public rooms
 */

exports.getPublicRooms = function(client, fn){
	log.debug("+++ getPublicRooms start +++");

  client.smembers("comima:public:rooms", function(err, rooms) {
    if (!err && rooms) fn(rooms);
    else fn([]);
  });

	log.debug("+++ getPublicRooms end +++");
};

/*
 * Enter to a room
 */

exports.enterRoom = function(req, res, client, room, users, rooms){
	log.debug("+++ enterRoom start +++");

  res.locals({
    room: room,
    rooms: rooms,
    user: {
			user_id: req.session.user_id,
      nickname: req.session.nickname,
			image_url: req.session.image_url,
      status: req.session.status
    },
    users_list: users
  });
  res.render('room');

	log.debug("+++ enterRoom end +++");
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

exports.getGuestUserId = function (client) {
	client.incrby('comima:guest_num', 1, function(err, num) {
    return 
  });
}
