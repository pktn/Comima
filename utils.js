/*
 * node.js util
 */
var util = require('util');

exports.d = function(obj) {
 log.verbose(util.inspect(obj));
}

/*
 * my variable
 */
var image_urls = {};

/*
 * my func
 */

exports.getImageUrl = function (user_id, fn) {
  // add stored image_url to historyLine
  if (image_urls[user_id]) {
    fn(image_urls[user_id]);

  // store image_urls in local variable
  } else {
    client.get('users:' + user_id + ':image_url', function(err, image_url) {
      log.debug("get image_url " + image_url + " for " + user_id);
      fn(image_url);
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

