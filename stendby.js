/*
 * Module dependencies
 */

var express = require('express')
  , http = require('http')
  , redis = require('redis')
//  , passport = require('passport')
  , config = require('./config.json')
  , RedisStore = require('connect-redis')(express)
  , sessionStore = exports.sessionStore = new RedisStore(config.redis)
  , init = require('./init');

/*
 * Instantiate redis
 */

var client = exports.client  = redis.createClient();

/*
 * Clean db and create folder
 */

init(client);

/*
 * Passportjs auth strategy
 */

require('./strategy');

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
    key: "stendby",
    store: sessionStore,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
  }));
/*
  app.use(passport.initialize());
  app.use(passport.session());
*/

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
  console.log('server stendby on port %d', app.get('port'));
});

/*
 * Socket.io
 */

require('./sockets');


/*
 * Catch uncaught exceptions
 */

process.on('uncaughtException', function(err){
  console.log('Exception: ' + err.stack);
});
