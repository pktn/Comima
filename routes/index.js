
/*
 * Module dependencies
 */

var app = module.parent.exports.app
  , passport = require('passport')
  , client = module.parent.exports.client
  , utils = require('../utils');

/*
 * Homepage
 */

app.get('/', function(req, res, next) {
	if(req.isAuthenticated()){
		res.redirect('/rooms/list');
	} else{
		res.render('index');
	}
});

/*
 * Rooms list
 */

app.get('/rooms/list', utils.restrict, function(req, res) {
  utils.getPublicRoomsInfo(client, function(rooms) {
    res.render('room_list', { rooms: rooms });
  });
});

/*
 * Create a room
 */

app.post('/create', utils.restrict, function(req, res) {
  utils.validRoomName(req, res, function(roomKey) {
    utils.roomExists(req, res, client, roomKey, function() {
      utils.createRoom(req, res, client, roomKey);
    });
  });
});

/*
 * Join a room
 */

app.get('/rooms/:id', utils.restrict, function(req, res) {
	var username = req.session.username || 'guest-' + Math.floor( Math.random() * 1000000 );
	req.session.username = username;

	utils.getCominyUserInfo(req, res, function() {
		utils.getRoomInfo(req, res, client, function(room) {
			utils.getUsersInRoom(req, res, client, room, function(users) {
				utils.getPublicRoomsInfo(client, function(rooms) {
					utils.getUserStatus(req, client, function(status) {
						utils.enterRoom(req, res, client, room, users, rooms, status);
					});
				});
			});
		});
	});
});

