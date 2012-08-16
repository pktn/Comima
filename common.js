/*
 * func
 */
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

/*
 * Dump Object
 */

exports.dumpObject = function (o) {
	var str = "";
	for(var i in o) {
		str = str + "\n" + i + "\t"+ o[i];
	}
	logger.debug(str);
};

exports.getLogFilePath = function () {
	var now = new Date();
	var str = now.getFullYear().toString()
		+ (now.getMonth() + 1)
		+ now.getDate() + ".txt";
	return str;
}
