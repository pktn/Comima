
/*
 * Module dependencies
 */

var parent = module.parent.exports 
  , app = parent.app
  , server = parent.server
  , express = require('express')
  , client = parent.client
  , sessionStore = parent.sessionStore
  , sio = require('socket.io')
  , parseCookies = require('connect').utils.parseSignedCookies
  , cookie = require('cookie')
  , config = require('./config.json')
	, common = require('./common')
  , fs = require('fs');

var io = sio.listen(server);

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
        user: {username:session.username, image_url:session.image_url},
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
    , nickname = hs.comima.user.username
    , room_id = hs.comima.room
    , chatlogFileName = './chats/' + room_id + '_' + common.getLogFilePath()
    , chatlogWriteStream = fs.createWriteStream(chatlogFileName, {'flags': 'a'})
    , threadlogFileName = './threads/' + room_id + '_' + common.getLogFilePath()
    , threadlogWriteStream = fs.createWriteStream(threadlogFileName, {'flags': 'a'});

	logger.info(
		'New connection from '
		+ hs.address.address + ":" + hs.address.port
		+ ' username:' + nickname
	);

  socket.join(room_id);

  client.sadd('users:' + nickname + ':sockets', socket.id, function(err, socketAdded) {
    if(socketAdded) {
      client.sadd('socketio:sockets', socket.id);
      client.sadd('rooms:' + room_id + ':online', nickname, function(err, userAdded) {
        if(userAdded) {
					client.hincrby('rooms:' + room_id + ':info', 'online', 1);
					client.get('users:' + nickname + ':status', function(err, status) {
    	      io.sockets.in(room_id).emit('new user', {
      	      nickname: nickname,
        	    status: status || 'available'
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
        atTime: new Date(),
        withData: data.msg
      }

      chatlogWriteStream.write(JSON.stringify(chatlogRegistry) + "\n");
      io.sockets.in(room_id).emit('new msg', {
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
        atTime: new Date(),
        withData: data.detail
      }

      threadlogWriteStream.write(JSON.stringify(threadlogRegistry) + "\n");
      
      io.sockets.in(room_id).emit('new thread', {
        nickname: data.nickname,
        detail: data.detail
      });        
    }   
  });

  socket.on('set status', function(data) {
    var status = data.status;
    client.set('users:' + nickname + ':status', status, function(err, statusSet) {
      io.sockets.emit('user-info update', {
        username: nickname,
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
          history.push(historyLine);
        }
      });

      socket.emit('chat history response', {
        history: history
      });
    });
  });

  socket.on('thread history request', function() {
    var history = [];
    var tail = require('child_process').spawn('tail', ['-n', 5, threadlogFileName]);
    tail.stdout.on('data', function (data) {
      var lines = data.toString('utf-8').split("\n");
      
      lines.forEach(function(line, index) {
        if(line.length) {
          var historyLine = JSON.parse(line);
          history.push(historyLine);
        }
      });

      socket.emit('thread history response', {
        history: history
      });
    });
  });

  socket.on('disconnect', function() {
    // 'sockets:at:' + room_id + ':for:' + nickname
    client.srem('users:' + nickname + ':sockets', socket.id, function(err, removed) {
      if(removed) {
        client.srem('socketio:sockets', socket.id);
        client.scard('users:' + nickname + ':sockets', function(err, members_no) {
          if(!members_no) {
            client.srem('rooms:' + room_id + ':online', nickname, function(err, removed) {
              if (removed) {
                client.hincrby('rooms:' + room_id + ':info', 'online', -1);
                chatlogWriteStream.destroySoon();
                io.sockets.in(room_id).emit('user leave', {
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
