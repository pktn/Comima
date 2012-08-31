/*
 * node.js util
 */
var util = require('util');

exports.d = function(obj) {
 log.silly(util.inspect(obj));
}

/*
 * my variable
 */
var users = {};

/*
 * my func
 */

exports.getUserInfo = function (user_id, fn) {
  // get stored user info 
  if (users[user_id]) {
    log.debug("get user info from cache" + " for " + user_id);
    fn(users[user_id]);

  // store user info in local variable
  } else {
    client.hgetall('users:' + user_id + ':info', function(err, user) {
      log.debug("get user info" + " for " + user_id);
			users[user_id] = user;
      fn(user);
    });
  }
}

exports.getDate = function() {
  var now      = new Date();
  var fullYear = now.getFullYear();
  var month    = now.getMonth();
  var date     = now.getDate();
  var hours    = now.getHours();
  var minutes  = now.getMinutes();
  var seconds  = now.getSeconds();

  if ( month   < 10 ) month   = '0' + month;
  if ( date    < 10 ) date    = '0' + date;
  if ( hours   < 10 ) hours   = '0' + hours;
  if ( minutes < 10 ) minutes = '0' + minutes;
  if ( seconds < 10 ) seconds = '0' + seconds;
  var str =                                                                              
    [ fullYear, month, date ].join('-')
    + ' '
    + [ hours, minutes, seconds ].join(':');
  return str;
}
exports.timeParser = function(date) {
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



exports.dumpObject = function (o) {
	var str = "";
	for(var i in o) {
		str = str + "\n" + i + "\t"+ o[i];
	}
};

exports.getLogFilePath = function (day) {
	day = day || 1;

	var paths = [];
	var date = new Date();

	for(var i=0; i<day; i++) {
		var path = this.getTimestamp(date) + '.txt';
		paths.push(path);
		date.setDate(date.getDate() - 1);
	}
	return paths;
}

exports.getTimestamp = function (date) {
	var d = date || new Date();
	var timestamp = d.getFullYear().toString()
		+ (d.getMonth() + 1)
		+ d.getDate();
	return timestamp;
}

