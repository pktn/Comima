
/*
 * Module dependencies
 */

var app = module.parent.exports.app
  , client = module.parent.exports.client
  , action = require('../action');


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
		action.setUserInfo(req, res, client, function() {
			action.getRoomInfo(req, res, client, function(room) {
				action.getUsersInRoom(req, res, client, room, function(users) {
					action.getPublicRoomsInfo(client, function(rooms) {
						action.getUserStatus(req, client, function(status) {
							action.enterRoom(req, res, client, room, users, rooms, status);
						});
					});
				});
			});
		});
	});
});

