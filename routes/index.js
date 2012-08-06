
/*
 * Module dependencies
 */

var app = module.parent.exports.app
//  , passport = require('passport')
  , client = module.parent.exports.client
  , utils = require('../utils');

/*
 * Homepage
 */

app.get('/', function(req, res, next) {
//  if(req.isAuthenticated()){
	res.redirect('/rooms/list');
//    } else{
//      res.render('index');
//    }
});


/*
 * Authentication routes
 */
/*
app.get('/auth/twitter', passport.authenticate('twitter'));

app.get('/auth/twitter/callback', 
  passport.authenticate('twitter', { failureRedirect: '/' }),
  function(req, res) {
    res.redirect('/');
});

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});
*/


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

