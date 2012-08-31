
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

			var roomStr;

			// TODO
			if (hsData.headers.referer.match(/\/rooms\/(?:([^\/]+?))\/?$/g)) {
				roomStr = hsData.headers.referer;
			} else {
				roomStr = hsData.headers.referer + 'rooms/lobby';
			}

      hsData.comima = {
        user: {
						user_id: session.user_id
					, nickname: session.nickname
					, image_url: session.image_url
				},
        room: /\/rooms\/(?:([^\/]+?))\/?$/g.exec(roomStr)[1]
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
  //io.enable('browser client gzip'); // TODO
});


io.sockets.on('connection', function (socket) {
  var hs = socket.handshake
    , nickname = hs.comima.user.nickname
    , user_id = hs.comima.user.user_id
    , room_id = hs.comima.room
    , chatlogFile = './chats/' + room_id + '_' + utils.getLogFilePath().pop()
    , chatlogFiles = []
    , chatlogWriteStream = fs.createWriteStream(chatlogFile, {'flags': 'a'} )
    , threadlogFile = './threads/' + room_id + '_' + utils.getLogFilePath().pop()
    , threadlogFiles = []
    , threadlogWriteStream = fs.createWriteStream(threadlogFile, {'flags': 'a'});

	// open chatlog file
	var chat_paths = utils.getLogFilePath(config.chat.daysgethistory);
	for(var i=0; i<chat_paths.length; i++) {
		var chatlogFile = './chats/' + room_id + '_' + chat_paths[i];
		chatlogFiles.push(chatlogFile);
	}

	// open threadlog file
	var thread_paths = utils.getLogFilePath(config.thread.daysgethistory);
	for(var i=0; i<thread_paths.length; i++) {
		var threadlogFile = './threads/' + room_id + '_' + thread_paths[i];
		threadlogFiles.push(threadlogFile);
	}

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
				color: data.color,
				bgcolor: data.bgcolor,
        withData: data.msg
      }
      chatlogWriteStream.write(JSON.stringify(chatlogRegistry) + "\n");
      io.sockets.in(room_id).emit('new msg', {
				user_id: user_id,
        nickname: nickname,
				image_url: data.image_url,
				color: data.color,
				bgcolor: data.bgcolor,
        msg: data.msg
      });        
    }   
  });

  socket.on('my thread', function(data) {
    var time = new Date();
    var no_empty = data.detail.replace("\n","");
    if(no_empty.length > 0) {
      var threadlogRegistry = {
        type: 'message',
        from: nickname,
				fromUserId: user_id,
        atTime: time,
        withData: data.detail
      }
      threadlogWriteStream.write(JSON.stringify(threadlogRegistry) + "\n");
      
      io.sockets.in(room_id).emit('new thread', {
				user_id: user_id,
        nickname: nickname,
				image_url: data.image_url,
        detail: data.detail,
        time: time
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
		var total_lines = 0;

		for(var i in chatlogFiles) {
			var tail_num = config.chat.maxhistoryline - total_lines;
			if (tail_num > 0) {
		    var tail = require('child_process').spawn(
					'tail', ['-n', tail_num, chatlogFiles[i]]
				);
			}
	    tail.stdout.on('data', function (data) {
  	    var lines = data.toString('utf-8').split("\n");
				lines = lines.reverse();
				lines.forEach(function(line){
					total_lines++;
     	  	if(line) {
						// response
       	  	var historyLine = JSON.parse(line);
						utils.getUserInfo(historyLine.fromUserId, function(user) {
							historyLine.fromImageUrl = user.image_url;
  						socket.emit('chat history response', {
  	  					history: historyLine
							});
						});
 	      	}
				});
   	  });
		}
  });

  socket.on('thread history request', function() {
    var tail = require('child_process').spawn(
			'tail', ['-n', config.thread.maxhistoryline, threadlogFile]
		);
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
