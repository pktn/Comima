
/*
 * Initialize the application
 */

/*
 * Module dependencies
 */

var fs = require('fs');

/*
 * Initialize the 
 *
 * @param {Object} Redis client instance
 * API @public
 */

module.exports = function(client){

  /*
   * Clean all forgoten sockets in Redis.io
   */

  // Delete all users sockets from their lists
  client.keys('users:*:sockets', function(err, keys) {
    if(keys.length) client.del(keys);
    logger.info('Deletion of sockets reference for each user');
		if(err) logger.error(err);
  });

  // No one is online when starting up
  client.keys('rooms:*:online', function(err, keys) {
    var roomNames = [];
    
    if(keys.length) {
      roomNames = roomNames.concat(keys);
      client.del(keys);
    }

    roomNames.forEach(function(roomName, index) {
      var key = roomName.replace(':online', ':info');
      client.hset(key, 'online', 0);
    });

    logger.info('Deletion of online users from rooms');
		if(err) logger.error(err);
  });

  // Delete all socket.io's sockets data from Redis
  client.smembers('socketio:sockets', function(err, sockets) {
    if(sockets.length) client.del(sockets);

    logger.info('Deletion of socket.io stored sockets data');
		if(err) logger.error(err);
  });

  /*
   * Create 'chats' dir
   */
  fs.mkdir('./chats');

};

