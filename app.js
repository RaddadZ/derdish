var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var exphbs = require('express-handlebars');
var session = require('express-session');
var passport = require('passport');
var LocalStrategy = require('passport-local').Startegy;

var morgan = require('morgan'); 

var mongo = require('mongodb');
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/derdish002');
var db = mongoose.connection;
db.on('error', function (err) {
  console.error('There was a db connection error');
  return  console.error(err.message);
});
db.once('connected', function () {
  return console.log('Successfully connected to ' );
});
db.once('disconnected', function () {
  return console.error('Successfully disconnected from ');
});
process.on('SIGINT', function () {
  mongoose.connection.close(function () {
    console.error('dBase connection closed due to app termination');
    return process.exit(0);
  });
});

var mongoStore = require('connect-mongo')(session);

var routes = require('./routes/chats');
var users = require('./routes/users');
var api = require('./routes/api');


// calling socket.js
var io = require('./socket').io;

// init app
var app = express();

// view engine
app.set('views', path.join(__dirname,'views'));
app.engine('handlebars',exphbs({defaultLayout:'layout'}));
app.set('view engine','handlebars');

// body-parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());

// app.use(morgan('dev'));  

// set static folder
app.use(express.static(path.join(__dirname, 'public')));

// global vars
app.use(function (req,res,next) {
	// res.locals.success_msg = req.flash('success_msg');
	// res.locals.error_msh = req.flash('error_msh');
	// res.locals.error = req.flash('success_msg');
	
	// res.locals.user = req.user || null;
	next();
});

// mongoStore
var sessionStore = new mongoStore({
	mongooseConnection: mongoose.connection,
	touchAfter: 24*3600
});

// session middleware
var sessionMware = session({
	name: 'derdish.sess', 
	store: sessionStore, 
	secret: 'sessionSecret', 
	resave: false,
	saveUninitialized: true,
	cookie: {maxAge: 1000*60*60*24}
});

app.use(sessionMware);
io.use(function (socket, next) {
	sessionMware(socket.request, socket.request.res, next);
})

// passport init
app.use(passport.initialize());
app.use(passport.session());

// routes
app.use('/',routes);
app.use('/users',users);
app.use('/api',api);


app.set('port',(process.env.PORT || 3000));
var server = require('http').createServer(app);
io.listen(server);
server.listen(app.get('port'), function(){
	console.log('Server started on port '+app.get('port'));
});
