
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
			action.getRoomsInfo(client, function(rooms) {
				action.getRoomsUserInfo(client, rooms, function(rooms) {
					action.enterRoom(req, res, client, rooms);
				});
			});
		});
	});
});

/*
 * Rooms list
 */

app.get('/rooms/list', action.restrict, function(req, res) {
  action.getRoomsInfo(client, function(rooms) {
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
			action.getRoomsInfo(client, function(rooms) {
				action.getRoomsUserInfo(client, rooms, function(rooms) {
					action.enterRoom(req, res, client, rooms);
				});
			});
		});
	});
});

