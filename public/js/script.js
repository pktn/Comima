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

  socket.on('chat history response', function(data) {
    if(data.history && data.history.length) {
      var $lastInput
        , lastInputUser;

      data.history.forEach(function(historyLine) {
        var time = new Date(historyLine.atTime)
          , chatBoxData = {
              nickname: historyLine.from,
							user_id: historyLine.fromUserId,
              msg: historyLine.withData,
							image_url: historyLine.fromImageUrl,
              type: 'history',
              time: timeParser(time)
            };

        $lastInput = $('.chat .history').children().last();
        lastInputUser = $lastInput.data('user');

        if($lastInput.hasClass('chat-box') && lastInputUser === chatBoxData.nickname) {
          $lastInput.append(parseBoxMsg(ich.chat_box_text(chatBoxData)));
        } else {
          $('.chat .history').append(parseBox(ich.chat_box(chatBoxData)));
        }

        $('.chat').scrollTop($('.chat').prop('scrollHeight'));
      });
    }
  });

  socket.on('thread history response', function(data) {
    var h = data.historyLine;

    if(h) {
      var time = new Date(h.atTime)
        , threadBoxData = {
            nickname: h.from,
	  				user_id: h.fromUserId,
            detail: h.withData,
		  			image_url: h.fromImageUrl,
              type: 'history',
              time: timeParser(time)
          };
      $('.thread .history').append(parseBox(ich.thread_box(threadBoxData)));
      $('.thread').scrollTop($('.thread').prop('scrollHeight'));
    }
  });

  socket.on('new user', function(data) {
    var message = "$nickname さんが入室しました。";

    //If user is not 'there'
    if(!$('.people a[data-nickname="' + data.nickname + '"]').length) {
      //Then add it
      $('#online-user-list .people').prepend(ich.people_box(data));
      USERS[data.nickname] = 1;

      // Chat notice
      message = message
            .replace('$nickname', data.nickname);

      // Check update time
      var time = new Date()
        , noticeBoxData = {
            user: data.nickname,
            noticeMsg: message,
            time: timeParser(time)
          };
      
      $('.chat .current').append(ich.chat_notice(noticeBoxData));
      $('.chat').scrollTop($('.chat').prop('scrollHeight'));

    } else {
      //Instead, just check him as 'back'
      USERS[data.nickname] = 1;
    }

		updateOnlineNum();
  });

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
          user: data.nickname,
          noticeMsg: message,
          time: timeParser(time)
        };

      var $lastChatInput = $('.chat .current').children().last();
      
      if($lastChatInput.hasClass('notice') && $lastChatInput.data('user') === data.nickname) {
        $lastChatInput.replaceWith(ich.chat_notice(noticeBoxData));
      } else {
        $('.chat .current').append(ich.chat_notice(noticeBoxData));
        $('.chat').scrollTop($('.chat').prop('scrollHeight'));
      }
  });

  socket.on('new msg', function(data) {
    var time = new Date(),
        $lastInput = $('.chat .current').children().last(),
        lastInputUser = $lastInput.data('user');
    data.type = 'chat';
    data.time = timeParser(time)

    if($lastInput.hasClass('chat-box') && lastInputUser === data.nickname) {
      $lastInput.append(parseBoxMsg(ich.chat_box_text(data)));
    } else {
      $('.chat .current').append(parseBox(ich.chat_box(data)));
    }

    $('.chat').scrollTop($('.chat').prop('scrollHeight'));
    
    //update title if window is hidden
    if(windowStatus == "hidden") {
      afkDeliveredMessages +=1;
      updateTitle();
    }

  });

  socket.on('new thread', function(data) {
    var time = new Date();

    data.type = 'thread';
    data.time = timeParser(time);

    $('.thread .current').append(parseBox(ich.thread_box(data)));
    $('.thread').scrollTop($('.thread').prop('scrollHeight'));
    
    //update title if window is hidden
    if(windowStatus == "hidden") {
      afkDeliveredMessages +=1;
      updateTitle();
    }

  });

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
            time: timeParser(time)
          };

        $('.chat .current').append(ich.chat_notice(noticeBoxData));
        $('.chat').scrollTop($('.chat').prop('scrollHeight'));
      };
    }
		updateOnlineNum();
  });

  $(".chat-input input").keypress(function(e) {
    var inputText = $(this).val().trim();
    if(e.which == 13 && inputText) {
      var chunks = inputText.match(/.{1,1024}/g)
        , len = chunks.length;
      for(var i = 0; i<len; i++) {
        socket.emit('my msg', {
					image_url: $('#image_url').text(),
          msg: chunks[i]
        });
      }
      $(this).val('');

      return false;
    }
  });

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

  var patterns = {
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

  var emoticHTML = "<span class='emoticon $emotic'></span>";

  var injectEmoticons = function(text) {
    for(var emotic in patterns) {
      text = text.replace(patterns[emotic],emoticHTML.replace("$emotic", "emoticon-" + emotic));
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

  function focusInput() {
    $(".chat-input input.text").focus();
  }
});
