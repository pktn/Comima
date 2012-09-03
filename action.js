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

exports.genRoomKey = function(roomKey) {
  return roomKey.replace(/[^a-zA-Z0-9-_]/g, '');
};

/*
 * Room name is valid
 */

exports.validRoomName = function(req, res, fn) {
  var roomKey = exports.genRoomKey(req.body.room_id)
    , keyLen = roomKey.length
    , nameLen = req.body.room_name.length;

  if(nameLen < 255 && keyLen > 0 && keyLen < 20) {
    fn(roomKey);
  } else {
    res.redirect('back');
  }
};

/*
 * Checks if room exists
 */

exports.roomExists = function(req, res, client, roomKey, fn) {
  client.exists('rooms:' + roomKey + ':info', function(err, exists) {
    if(!err && exists) {
			res.redirect('/rooms/' + roomKey);
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
		detail: req.body.detail, 
    admin: req.body.user_id,
		color: req.body.room_color,
    locked: 0,
    online: 0,
		total_visits: 1,
		reg_date: +new Date() // timestamp
  };
	// save
  client.hmset('rooms:' + roomKey + ':info', room, function(err, ok) {
    if(!err && ok) {
      client.sadd('comima:public:rooms', roomKey);
			var redirectTo = (roomKey === 'lobby') ? '/' : '/rooms/' + roomKey;
      res.redirect(redirectTo);
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

	var sid; // Cominy Session id

	if (req.headers.cookie) {
		var cookieArray = req.headers.cookie.split(';') ;
		for(var i = 0; i < cookieArray.length; i++){
			if( cookieArray[i].indexOf(config.cominy.cookiekey) !== -1){
				sid = cookieArray[i].split('=')[1];
			}
		}
	}

	// if Cominy Session exists
	if (sid) {
		var xmlrpc = require('xmlrpc');
		var fs = require('fs');

		// Fetch Cominy Session File
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

	// guest
	} else {

		// remove cominy user info if left
		if (!req.session.is_guest) {
			req.session.user_id = req.session.nickname = req.session.image_url = false;
		} 
		req.session.is_guest = true;

		next();
	}
};

/*
 * Get User Info
 */

exports.getUserInfo = function(req, res, client, next) {
	log.debug("+++ getUserInfo start +++");

	// set userinfo of new guest
	if (req.session.is_guest && !req.session.user_id) {
		client.incrby('comima:guest-num', 1, function(err, num) {
  	  req.session.user_id = req.session.nickname = 'guest-' + num;
			req.session.image_url = config.guest.image_url;
			req.session.status = 'available';
			_getUserInfo(req, res, client, next);
	  });
	} else {
		_getUserInfo(req, res, client, next);
	}

	function _getUserInfo(req, res, client, next) {
		// status
		req.session.status = req.session.status || 'available';

		client.hgetall('users:' + req.session.user_id + ':info', function(err, user) {
		// first access OR when user info is changed
			if (!user || 
					user.image_url !== req.session.image_url ||
					user.nickname  !== req.session.nickname ||
					user.status !== req.session.status) {

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
	}
};

/*
 * Get Rooms Info
 */

exports.getRoomsInfo = function(client, next) {
	log.debug("+++ getRoomsInfo start +++");

  client.smembers('comima:public:rooms', function(err, publicRooms) {

    var rooms = []
      , len = publicRooms.length;

    if(!len) next([]);

    publicRooms.sort(exports.caseInsensitiveSort);
    publicRooms.forEach(function(roomKey, index) {
      client.hgetall('rooms:' + roomKey + ':info', function(err, room) {
        // prevent for a room info deleted before this check
        if(!err && room && Object.keys(room).length) {
          // add room info
					var timestamp = +(room.reg_date);
					room.time = utils.timeParser(new Date(timestamp));
          rooms.push(room);

          // check if last room
          if(rooms.length == len) next(rooms);
        } else {
          // reduce check length
          len -= 1;
        }
      });
    });
  });

	log.debug("+++ getRoomsInfo end +++");
};

/*
 * Get Rooms User Info
 */

exports.getRoomsUserInfo = function(client, rooms, next) {
	log.debug("+++ getRoomsUserInfo start +++");

	rooms.forEach(function(room, index) {
		var users = room.users = [];

		utils.getUserInfo(room.admin, function(admin) {
			room.admin = admin;
		});

		client.smembers('rooms:' + room.key + ':online', function(err, online_users) {
				online_users.forEach(function(user_id, index) {
					utils.getUserInfo(user_id, function(user) {
						users.push(user);
						// last user
						if (online_users.length === users.length) {
							room.users = users;
							// last room
							if (rooms.length === index + 1) {
								next(rooms);
							}
						}
					});
				});
				// last room
				if (rooms.length === index + 1) {
					next(rooms);
				}
		});
	});

	log.debug("+++ getRoomsUserInfo end +++");
}

/*
 * Get public rooms
 */

exports.getPublicRooms = function(client, next){
	log.debug("+++ getPublicRooms start +++");

  client.smembers("comima:public:rooms", function(err, rooms) {
    if (!err && rooms) next(rooms);
    else next([]);
  });

	log.debug("+++ getPublicRooms end +++");
};

/*
 * Enter to a room
 */

exports.enterRoom = function(req, res, client, rooms){
	log.debug("+++ enterRoom start +++");

	// data of current room
	var current_users = [];
	var current_room = {};
	rooms.forEach(function(room, index) {
		if (req.params.id === room.key) {
			current_users = room.users;
			current_room = room;
		}
	});

	// local variables for html template
	res.locals({
    room: current_room,
   	rooms: rooms,
   	users: current_users,
	  user: {
			user_id: req.session.user_id,
   	  nickname: req.session.nickname,
			image_url: req.session.image_url,
     	status: req.session.status
	  }
	});

	// increment total visits
	client.hincrby('rooms:' + current_room.key + ':info', 'total_visits', 1);

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

exports.setEnterRoomLog = function (req, res) {
	
}
