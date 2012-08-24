
/*
 * Module dependencies
 */

var parent = module.parent.exports 
  , app = parent.app
  , server = parent.server
  , express = require('express')
  , client = parent.client
  , sessionStore = parent.sessionStore
	, utils = parent.utils
  , sio = require('socket.io')
  , parseCookies = require('connect').utils.parseSignedCookies
  , cookie = require('cookie')
  , config = require('./config.json')
  , fs = require('fs')
	;

var io = sio.listen(server, {'log level': 2});

io.set('authorization', function (hsData, accept) {
  if(hsData.headers.cookie) {
    var cookies = parseCookies(cookie.parse(hsData.headers.cookie), config.session.secret)
      , sid = cookies['comima'];
    hsData.sid = sid;
    sessionStore.load(sid, function(err, session) {
      if(err || !session) {
        return accept('Error retrieving session!', false);
      }
      hsData.comima = {
        user: {
						user_id: session.user_id
					, nickname: session.nickname
					, image_url: session.image_url
				},
        room: /\/rooms\/(?:([^\/]+?))\/?$/g.exec(hsData.headers.referer)[1]
      };
      return accept(null, true);
      
    });
  } else {
    return accept('No cookie transmitted.', false);
  }
});

io.configure(function() {
  io.set('store', new sio.RedisStore);
  io.enable('browser client minification');
  io.enable('browser client gzip');
});


io.sockets.on('connection', function (socket) {
  var hs = socket.handshake
    , nickname = hs.comima.user.nickname
    , user_id = hs.comima.user.user_id
    , room_id = hs.comima.room
    , chatlogFileName = './chats/' + room_id + '_' + utils.getLogFilePath()
    , chatlogWriteStream = fs.createWriteStream(chatlogFileName, {'flags': 'a'})
    , threadlogFileName = './threads/' + room_id + '_' + utils.getLogFilePath()
    , threadlogWriteStream = fs.createWriteStream(threadlogFileName, {'flags': 'a'});

	log.debug(
		'[socket.io] new connection from '
		+ hs.address.address + ":" + hs.address.port
		+ ' user_id:' + user_id
		+ ' nickname:' + nickname
	);

  socket.join(room_id);

  client.sadd('users:' + user_id + ':sockets', socket.id, function(err, socketAdded) {
    if(socketAdded) {
      client.sadd('socketio:sockets', socket.id);
      client.sadd('rooms:' + room_id + ':online', user_id, function(err, userAdded) {
        if(userAdded) {
					client.hincrby('rooms:' + room_id + ':info', 'online', 1);
					utils.getUserInfo(user_id, function(user) {
    	      io.sockets.in(room_id).emit('new user', {
							 user_id: user_id
      	     , nickname: user.nickname
             , image_url: user.image_url
        	   , status: user.status || 'available'
            });
          });
        }
      });
    }
  });

  socket.on('my msg', function(data) {
    var no_empty = data.msg.replace("\n","");
    if(no_empty.length > 0) {
      var chatlogRegistry = {
        type: 'message',
        from: nickname,
				fromUserId: user_id,
        atTime: new Date(),
        withData: data.msg
      }

      chatlogWriteStream.write(JSON.stringify(chatlogRegistry) + "\n");
      io.sockets.in(room_id).emit('new msg', {
				user_id: user_id,
        nickname: nickname,
				image_url: data.image_url,
        msg: data.msg
      });        
    }   
  });

  socket.on('my thread', function(data) {
    var no_empty = data.detail.replace("\n","");
    if(no_empty.length > 0) {
      var threadlogRegistry = {
        type: 'message',
        from: nickname,
				fromUserId: user_id,
        atTime: new Date(),
        withData: data.detail
      }
      threadlogWriteStream.write(JSON.stringify(threadlogRegistry) + "\n");
      
      io.sockets.in(room_id).emit('new thread', {
				user_id: user_id,
        nickname: nickname,
				image_url: data.image_url,
        detail: data.detail
      });        
    }   
  });

  socket.on('set status', function(data) {
    var status = data.status;
    client.hset('users:' + user_id + ':info', 'status', status, function(err, ok) {
      io.sockets.emit('user-info update', {
				user_id: user_id,
        nickname: nickname,
        status: status
      });
    });
  });

  socket.on('chat history request', function() {
    var history = [];
    var tail = require('child_process').spawn('tail', ['-n', 5, chatlogFileName]);
    tail.stdout.on('data', function (data) {
      var lines = data.toString('utf-8').split("\n");
      
      lines.forEach(function(line, index) {
        if(line.length) {
          var historyLine = JSON.parse(line);
					utils.getUserInfo(historyLine.fromUserId, function(user) {
						historyLine.fromImageUrl = user.image_url;
 			      history.push(historyLine);
  	  			socket.emit('chat history response', {
    	    		history: history
						});
					});
        }
      });
    });
  });

  socket.on('thread history request', function() {
    var tail = require('child_process').spawn('tail', ['-n', 5, threadlogFileName]);
    tail.stdout.on('data', function (data) {
      var lines = data.toString('utf-8').split("\n");
      lines.forEach(function(line, index) {
        if(line.length) {
          var historyLine = JSON.parse(line);
					utils.getUserInfo(historyLine.fromUserId, function(user) {
						historyLine.fromImageUrl = user.image_url;
  	  			socket.emit('thread history response', {
        			historyLine: historyLine
		        });
					});
				}
      });
    });
  });

  socket.on('disconnect', function() {
    client.srem('users:' + user_id + ':sockets', socket.id, function(err, removed) {
      if(removed) {
        client.srem('socketio:sockets', socket.id);
        client.scard('users:' + user_id + ':sockets', function(err, members_no) {
          if(!members_no) {
            client.srem('rooms:' + room_id + ':online', user_id, function(err, removed) {
              if (removed) {
                client.hincrby('rooms:' + room_id + ':info', 'online', -1);
                chatlogWriteStream.destroySoon();
                io.sockets.in(room_id).emit('user leave', {
									user_id: user_id,
                  nickname: nickname
                });
              }
            });
          }
        });
      }
    });
  });
});
