$(function() {
  var USERS = window.USERS = {}
    , windowStatus
    , afkDeliveredMessages = 0
    , roomName = $('#room_name').text();

  // First update the title with room's name
  updateTitle();

  focusInput();

  // Then check users online!
  $('.people a').each(function(index, element) {
    USERS[$(element).data('nickname')] = 1;
  });
  
  //View handlers
  $(".dropdown a.selected").click(function() {
    $('.create-room').show().next("form .text").hide();
    $(this).toggleClass("active");
    $(this).next(".dropdown-options").toggle();
  });
  
  $(".create-room").click(function() {
    $(this).hide();
    $(this).next(".text").fadeIn();
  });
  
  $(".lock").click(function() {
    $(this).toggleClass('active');
  });

  $(".fancybox").fancybox({'margin': 0, 'padding': 0});

	//Color picker
	$('#color-picker').simpleColorPicker({onChangeColor: function(color) {
			$('.content .chat-input input').css('color', color);
		}
	});
	$('#bgcolor-picker').simpleColorPicker({onChangeColor: function(bgcolor) {
			$('.content .chat-input input').css('background-color', bgcolor);
		}
	});

	//Image picker
	$('#image-picker').simpleImagePicker({onClickImage: function(image) { 
    	if(image) {
				var stamp = image.match(/(\d+)\.gif/);
				var stamp_tag = '[s:' + stamp[1] + ']';
      	var chunks = stamp_tag.match(/.{1,1024}/g)
        	, len = chunks.length;
	      for(var i = 0; i<len; i++) {
  	      socket.emit('my msg', {
						image_url: $('#image_url').text(),
						color: $(".chat-input input").css('color'),
						bgcolor: $(".chat-input input").css('background-color'),
          	msg: chunks[i]
	        });
  	    }
			}
		}
	});

  //Socket.io
  var socket = io.connect();

  socket.on('error', function (reason){
    console.error('Unable to connect Socket.IO', reason);
  });

  socket.on('connect', function (){
    console.info('successfully established a working connection');
    if($('.chat .chat-box').length == 0) {
      socket.emit('chat history request');
    }
    if($('.thread .thread-box').length == 0) {
      socket.emit('thread history request');
    }
		updateOnlineNum();
  });

	/*
	* chat history response
	*/
  socket.on('chat history response', function(data) {
		var h = data.history;

    if(h) {
      var $lastInput
        , lastInputUser;

      var time = new Date(h.atTime)
        , chatBoxData = {
            nickname: h.from,
			  		user_id: h.fromUserId,
            msg: h.withData,
						image_url: h.fromImageUrl,
            type: 'history',
						color: h.color,
						bgcolor: h.bgcolor,
            timestamp: +time,
            time: timeParser(time)
          };
      $lastInput = $('.chat .history').children().last();
      lastInputUser = $lastInput.data('user');

      if($lastInput.hasClass('chat-box') && lastInputUser === chatBoxData.nickname) {
        $lastInput.find('.text-box p').append('<br>' + textParser(h.withData));
      } else {
        $('.chat .history').append(parseBox(ich.chat_box(chatBoxData)));
				// delay for stamp message
				setTimeout(function(){$('.chat').scrollTop($('.chat').prop('scrollHeight'));}, 1000);
      }
    }
  });

	/*
	* thread history response
	*/
  socket.on('thread history response', function(data) {
    var h = data.historyLine;

    if(h) {
      var time = new Date(h.atTime)
        , threadBoxData = {
            nickname: h.from,
	  				user_id: h.fromUserId,
            detail: h.withData,
		  			image_url:
							h.fromImageUrl
            , type: 'history'
            , timestamp: +time
            , time: timeParser(time)
          };
			$lastInput = $('.thread .history').children().last();
			lastInputUser = $lastInput.data('user');

			// TODO: 行単位で読み込むのをやめる。new threadのときも同様
			if($lastInput.hasClass('thread-box') && lastInputUser === threadBoxData.nickname) {
				$lastInput.find('.text-box p').append('<br>' + h.withData);
      } else {
      	$('.thread .history').append(parseBox(ich.thread_box(threadBoxData)));
      	$('.thread').scrollTop($('.thread').prop('scrollHeight'));
			}
    }
  });

	/*
	* enter new user
	*/
  socket.on('new user', function(data) {
    var message = "$nickname さんが入室しました。";

    //If user is not 'there'
    if(!$('.people a[data-nickname="' + data.nickname + '"]').length) {
      //Then add it
      $('#online-user-list .people').prepend(ich.people_box(data));
      USERS[data.nickname] = 1;

      // Chat notice
      message = message.replace('$nickname', data.nickname);

      // Check update time
      var time = new Date()
        , noticeBoxData = {
          	user: data.nickname
          , noticeMsg: message
          , timestamp: +time
          , time: timeParser(time)
          };

      $('.chat .current').append(ich.chat_notice(noticeBoxData));
      $('.chat').scrollTop($('.chat').prop('scrollHeight'));

    } else {
      //Instead, just check him as 'back'
      USERS[data.nickname] = 1;
    }

		updateOnlineNum();
  });

	/*
	* update user info (status)
	*/
  socket.on('user-info update', function(data) {
    var message = "$nickname は $status です。";

    // Update dropdown
    if(data.nickname === $('#nickname').text()) {
      $('.dropdown-status .list a').toggleClass('current', false);
      $('.dropdown-status .list a.' + data.status).toggleClass('current', true);

      $('.dropdown-status a.selected')
        .removeClass('available away busy');

      $('.dropdown-status a.selected').addClass(data.status).html('<b></b>' + data.status);
    }

    // Update users list
    $('.people a[data-nickname=' + data.nickname + ']')
      .removeClass('available away busy')
      .addClass(data.status);

    // Chat notice
    message = message
          .replace('$nickname', data.nickname)
          .replace('$status', data.status);

    // Check update time
    var time = new Date()
      , noticeBoxData = {
        	user: data.nickname
        , noticeMsg: message
        , timestamp: +time
        , time: timeParser(time)
        };

    var $lastChatInput = $('.chat .current').children().last();
      
    if($lastChatInput.hasClass('notice') && $lastChatInput.data('user') === data.nickname) {
      $lastChatInput.replaceWith(ich.chat_notice(noticeBoxData));
    } else {
      $('.chat .current').append(ich.chat_notice(noticeBoxData));
      $('.chat').scrollTop($('.chat').prop('scrollHeight'));
    }
  });

	/*
	* receive new chat message
	*/
  socket.on('new msg', function(data) {
    var time = new Date()
      , $lastInput = $('.chat .current').children().last()
      , lastInputUser = $lastInput.data('user')
		  , lastInputTimeAgo = +time - $lastInput.data('timestamp')
			;
    data.type = 'chat';
    data.timestamp = +time;
    data.time = timeParser(time);

   console.log($('.chat').prop('scrollHeight'));
   console.log($('.chat .current .chat-box').height());
		// append text to last block
    if( $lastInput.hasClass('chat-box') &&
				lastInputUser === data.nickname &&
				+time - $lastInput.data('timestamp') < 10*1000 ) { // TODO
      $lastInput.append(parseBoxMsg(ich.chat_box_text(data)));
		// add new block
    } else {
      $('.chat .current').append(parseBox(ich.chat_box(data)));
			updatePost();
    }

		// delay for stamp message
		setTimeout(function(){$('.chat').scrollTop($('.chat').prop('scrollHeight'));}, 10);
 
    //update title if window is hidden
    if(windowStatus == "hidden") {
      afkDeliveredMessages +=1;
      updateTitle();
    }

  });

	/*
	* receive new thread
	*/
  socket.on('new thread', function(data) {
    var time = new Date(data.time),
				$lastInput = $('.thread .current').children().last(),
				lastInputUser = $lastInput.data('user');
    data.type = 'thread';
		data.timestamp = +time;
    data.time = timeParser(time);

		if($lastInput.hasClass('thread-box') && lastInputUser === data.nickname) {
			$lastInput.find('.text-box p').append('<br>' + data.detail);
		} else {
	    $('.thread .current').append(parseBox(ich.thread_box(data)));
		}
    $('.thread').scrollTop($('.thread').prop('scrollHeight'));
 
    //update title if window is hidden
    if(windowStatus == "hidden") {
      afkDeliveredMessages +=1;
      updateTitle();
    }

  });

	/*
	* user leave
	*/
  socket.on('user leave', function(data) {
    var message = "$nickname さんが退室しました。";
    for (var nickname in USERS) {
      if(nickname === data.nickname) {
        //Mark user as leaving
        USERS[nickname] = 0;

        //Remove it and notify
        $('#online-user-list .people .user-img a[data-nickname="' + nickname + '"]').remove();

        // Chat notice
        message = message
              .replace('$nickname', data.nickname);

        // Check update time
        var time = new Date(),
          noticeBoxData = {
            user: data.nickname,
            noticeMsg: message,
						timestamp: +time,
            time: timeParser(time)
          };

        $('.chat .current').append(ich.chat_notice(noticeBoxData));
        $('.chat').scrollTop($('.chat').prop('scrollHeight'));
      };
    }
		updateOnlineNum();
  });

	/*
	* send chat message
	*/
  $(".chat-input input").keypress(function(e) {
    var inputText = $(this).val().trim();
    if(e.which == 13 && inputText) {
      var chunks = inputText.match(/.{1,1024}/g)
        , len = chunks.length;
      for(var i = 0; i<len; i++) {
        socket.emit('my msg', {
					image_url: $('#image_url').text(),
					color: $(".chat-input input").css('color'),
					bgcolor: $(".chat-input input").css('background-color'),
          msg: chunks[i]
        });
      }
      $(this).val('');

      return false;
    }
  });

	/*
	* post new room
	*/
  $(".post-room").click(function(e){
    $(this).hide().after('<p class="posting-room">しばらくおまちください</p>').delay(2000).hide();
		// TODO
		$('.posting-room').hide();
		$('.post-room').show();
		$('.fancybox-close').click();

    var inputText = $('.room-detail textarea').val().trim();

    if(inputText) {
      var chunks = inputText.match(/.{1,1024}/g)
        , len = chunks.length;

      for(var i = 0; i<len; i++) {
        socket.emit('my thread', { // TODO
					image_url: $('#image_url').text(),
          detail: chunks[i]
        });
      }
      $('.room-detail textarea').val('');

      return false;
    }
  });


  $('.dropdown-status .list a.status').click(function(e) {
    socket.emit('set status', {
      status: $(this).data('status')
    });
  });

	/*
	* post new thread
	*/
  $(".post-thread").click(function(e){
    $(this).hide().after('<p class="posting-thread">しばらくおまちください</p>').delay(2000).hide();
		// TODO
		$('.posting-thread').hide();
		$('.post-thread').show();
		$('.fancybox-close').click();

    var inputText = $('.thread-detail textarea').val().trim();

    if(inputText) {
      var chunks = inputText.match(/.{1,1024}/g)
        , len = chunks.length;

      for(var i = 0; i<len; i++) {
        socket.emit('my thread', {
					image_url: $('#image_url').text(),
          detail: chunks[i]
        });
      }
      $('.thread-detail textarea').val('');

      return false;
    }
  });


  $('.dropdown-status .list a.status').click(function(e) {
    socket.emit('set status', {
      status: $(this).data('status')
    });
  });

	// timeParser
  var timeParser = function(date) {
    var ints = {
        second: 1,
        minute: 60,
        hour: 3600,
        day: 86400,
        week: 604800,
        month: 2592000,
        year: 31536000
    };
		var jpints = {
				second: '秒',
        minute: '分',
        hour: '時間',
        day: '日',
        week: '週間',
        month: 'ヶ月',
        year: '年'
 		};
    time = +date;

    var gap = ((+new Date()) - time) / 1000,
        amount, measure;

		if (gap < 1) {
			return 'たった今';
		}
 
    for (var i in ints) {
      if (gap > ints[i]) { measure = i; }
    }
 
    amount = gap / ints[measure];
    amount = gap > ints.day ? (Math.round(amount * 100) / 100) : Math.round(amount);
    amount += jpints[measure] + '前';
 
    return amount;
  };

  var textParser = function(text) {
    text = injectEmoticons(text);
    return text
      .replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig,"<a href=\"$1\" target='_blank'>$1</a>")
      .replace(/(@)([a-zA-Z0-9_]+)/g, "<a href=\"http://twitter.com/$2\" target=\"_blank\">$1$2</a>");
  };

  var parseBox = function(box) {
    var boxMsg = box.find('p');
    parseBoxMsg(boxMsg);
    return box;
  };

  var parseBoxMsg = function(boxMsg) {
    var msg = boxMsg.html();
    return boxMsg.html(textParser(msg));
  };

  var emoticPatterns = {
    angry: /\&gt;:-o|\&gt;:o|\&gt;:-O|\&gt;:O|\&gt;:-\(|\&gt;:\(/g,
    naughty: /\&gt;:-\)|\&gt;:\)|\&gt;:-\&gt;|\&gt;:\&gt;/g,
    sick: /:-\&amp;|:\&amp;|=\&amp;|=-\&amp;|:-@|:@|=@|=-@/g,
    smile: /:-\)|:\)|=-\)|=\)/g,
    wink: /;-\)|;\)/g,
    frown: /:-\(|:\(|=\(|=-\(/g,
    ambivalent: /:-\||:\|/g,
    slant: /:-\/|:\/|:-\\|:\\|=-\/|=\/|=-\\|=\\/g,
    gasp: /:-O|:O|:-o|:o|=-O|=O|=-o|=o/g,
    laugh: /:-D|:D|=-D|=D/g,
    kiss: /:-\*|:\*|=-\*|=\*/g,
    yuck: /:-P|:-p|:-b|:P|:p|:b|=-P|=-p|=-b|=P|=p|=b/g,
    yum: /:-d|:d/g,
    grin: /\^_\^|\^\^|\^-\^/g,
    sarcastic: /:-\&gt;|:\&gt;|\^o\)/g,
    cry: /:'\(|='\(|:'-\(|='-\(/g,
    cool: /8-\)|8\)|B-\)|B\)/g,
    nerd: /:-B|:B|8-B|8B/g,
    innocent: /O:-\)|o:-\)|O:\)|o:\)/g,
    sealed: /:-X|:X|=X|=-X/g,
    footinmouth: /:-!|:!/g,
    embarrassed: /:-\[|:\[|=\[|=-\[/g,
    crazy: /%-\)|%\)/g,
    confused: /:-S|:S|:-s|:s|%-\(|%\(|X-\(|X\(/g,
    moneymouth: /:-\$|:\$|=\$|=-\$/g,
    heart: /\(L\)|\(l\)/g,
    thumbsup: /\(Y\)|\(y\)/g,
    thumbsdown: /\(N\)|\(n\)/g,
    "not-amused": /-.-\"|-.-|-_-\"|-_-/g,
    "mini-smile": /c:|C:|c-:|C-:/g,
    "mini-frown": /:c|:C|:-c|:-C/g,
    content: /:j|:J/g,
    hearteyes: /\&lt;3/g
  };

	var stampPatterns = {
		stamp: /\[s:(\d+)\]/g
	};

  var emoticHTML = "<span class='emoticon $emotic'></span>";
	var stampHTML = "<img src='../img/stamps/$1.gif'>";

  var injectEmoticons = function(text) {
    for(var emotic in emoticPatterns) {
      text = text.replace(emoticPatterns[emotic],emoticHTML.replace("$emotic", "emoticon-" + emotic));
    }
    for(var stamp in stampPatterns) {
      text = text.replace(stampPatterns[stamp],stampHTML);
		}
    return text;
  }

  // TITLE notifications
  var hidden
    , change
    , vis = {
        hidden: "visibilitychange",
        mozHidden: "mozvisibilitychange",
        webkitHidden: "webkitvisibilitychange",
        msHidden: "msvisibilitychange",
        oHidden: "ovisibilitychange" /* not currently supported */
    };             
  
  for (var hidden in vis) {
    if (vis.hasOwnProperty(hidden) && hidden in document) {
        change = vis[hidden];
        break;
    }
  }
  
  if (change) {
    document.addEventListener(change, onchange);
  } else if (/*@cc_on!@*/false) { // IE 9 and lower
    document.onfocusin = document.onfocusout = onchange
  } else {
    window.onfocus = window.onblur = onchange;
  }

  function onchange (evt) {
    var body = document.body;
    evt = evt || window.event;

    if (evt.type == "focus" || evt.type == "focusin") {
      windowStatus = "visible";
    } else if (evt.type == "blur" || evt.type == "focusout") {
      windowStatus = "hidden";
    } else {
      windowStatus = this[hidden] ? "hidden" : "visible";
    }

    if(windowStatus == "visible" && afkDeliveredMessages) {
      afkDeliveredMessages = 0;
      updateTitle();
    }

    if (windowStatus == "visible") {
      focusInput();
    }
  }

  function updateTitle() {
    $('title').html(ich.title_template({
      count: afkDeliveredMessages,
      roomName: roomName
    }, true));
  }

	function updateOnlineNum() {
		var num = 0;
		for (var key in USERS) {
			if (USERS[key]) { num = num + 1; }
		}
		$(".online-num").text('（' + num + '）');
	}

	function updatePost() {
		$('.chat .history').find('.date-box').each(function(){
			var timestamp = $(this).parent().data('timestamp');
			$(this).text(timeParser(new Date(timestamp)));
		});
		$('.chat .current').find('.date-box').each(function(){
			var timestamp = $(this).parent().data('timestamp');
			$(this).text(timeParser(new Date(timestamp)));
		});
	}

  function focusInput() {
    $(".chat-input input.text").focus();
  }
});
