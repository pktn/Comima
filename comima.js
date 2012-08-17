/*
 * Module dependencies
 */

var express				= require('express')
  , http					= require('http')
  , redis					= require('redis')
  , config				= require('./config.json')
  , RedisStore		= require('connect-redis')(express)
  , sessionStore	= exports.sessionStore = new RedisStore(config.redis.session)
	, utils					= exports.utils = require('./utils')
  , winston				= require('winston')
  , init					= require('./init');

/*
 * Instantiate redis
 */

client = exports.client  = redis.createClient();

/*
 * Logger
 */

log = new (winston.Logger)({
	transports: [
		new (winston.transports.Console)({
			colorize:true, level:'silly'
		}),
		new (winston.transports.File)({
			timestamp: utils.getDate, filename:'logs/app.log' 
		})
	]
});

/*
 * Clean db and create folder
 */

init(client);

/*
 * Create and config server
 */

var app = exports.app = express();

app.configure(function() {
  app.set('port', config.app.port || 6789);
  app.set('view engine', 'jade'); 
  app.set('views', __dirname + '/views/themes/' + config.theme.name);
  app.use(express.static(__dirname + '/public'));

  // session
  app.use(express.bodyParser());
  app.use(express.cookieParser(config.session.secret));
  app.use(express.session({
    key: "comima",
    store: sessionStore,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
  }));

  app.use(app.router);
});


// development
app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

// production
app.configure('production', function(){
  app.use(express.errorHandler());
});

/*
 * Routes
 */

require('./routes');

/*
 * Web server
 */

exports.server = http.createServer(app).listen(app.get('port'), function() {
  log.info('[comima] server running on port ' + app.get('port'));
});

/*
 * Socket.io
 */

require('./sockets');


/*
 * Catch uncaught exceptions
 */

process.on('uncaughtException', function(err){
  log.error('Exception: ' + err.stack);
});


