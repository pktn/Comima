
/*
 * Module dependencies
 */

var app = module.parent.exports.app
  , client = module.parent.exports.client
  , action = require('../action');


/*
 * Homepage
 */
app.get('/', action.restrict, function(req, res) {
	req.params.id = 'lobby';
	action.getCominyUserInfo(req, res, function() {
		action.getUserInfo(req, res, client, function() {
			action.getRoomInfo(req, res, client, function(room) {
				action.getUsersInRoom(req, res, client, room, function(users) {
					action.getPublicRoomsInfo(client, function(rooms) {
						action.enterRoom(req, res, client, room, users, rooms);
					});
				});
			});
		});
	});
});


/*
 * Rooms list
 */

app.get('/rooms/list', action.restrict, function(req, res) {
  action.getPublicRoomsInfo(client, function(rooms) {
    res.render('room_list', { rooms: rooms });
  });
});

/*
 * Create a room
 */

app.post('/create', action.restrict, function(req, res) {
  action.validRoomName(req, res, function(roomKey) {
    action.roomExists(req, res, client, roomKey, function() {
      action.createRoom(req, res, client, roomKey);
    });
  });
});

/*
 * Join a room
 */

app.get('/rooms/:id', action.restrict, function(req, res) {
	action.getCominyUserInfo(req, res, function() {
		action.getUserInfo(req, res, client, function() {
			action.getRoomInfo(req, res, client, function(room) {
				action.getUsersInRoom(req, res, client, room, function(users) {
					action.getPublicRoomsInfo(client, function(rooms) {
						action.enterRoom(req, res, client, room, users, rooms);
					});
				});
			});
		});
	});
});

