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

exports.dumpObject = function (o) {
	var str = "";
	for(var i in o) {
		str = str + "\n" + i + "\t"+ o[i];
	}
};

exports.getLogFilePath = function () {
	var path = this.getTimestamp() + '.txt';
	return path;
}

exports.getTimestamp = function () {
	var now = new Date();
	var timestamp = now.getFullYear().toString()
		+ (now.getMonth() + 1)
		+ now.getDate();
	return timestamp;
}

