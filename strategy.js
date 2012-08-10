
/*
 * Module dependencies
 */

var passport			= require('passport')
	, LocalStrategy = require('passport-local').Strategy
  , config				= require('./config.json');

/*
 * Auth strategy
 */

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(id, done) {
	User.findById(id, function (err, user) {
		done(null, user);
	});
});

passport.use(new LocalStrategy(
	function(username, done) {
		User.findOne({ username: username }, function (err, user) {
			done(err, user);
		});
	}
));
