var express = require('express');
var router = express.Router();
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

var User = require('../models/user');
var Chat = require('../models/chat');

// get login
router.get('/login',function(req,res){
	res.render('login');
});


// register user
router.post('/register',function(req,res){
	var username = req.body.username;
	var password = req.body.password;
  var color = req.body.color;

	// req.checkBody('username','name is required').notEmpty();
	console.log('registering');

  Chat.getOrCreateMainChatIfNotExist(function (error, chat){
    if (error){
      console.log(error.message);
      return;
    };

    if (chat.isFull()) {
      console.log('register: main chat is full, user not registered'+chat.isFull());
      return res.redirect('/');
    }else{
      console.log('register: main chat is not full, user registered'+chat.isFull());
      var newUser = new User({
        username: username,
        password: password,
        color: color
      });

    	User.createUser(newUser,function(err,user){
    		// if (err) throw err;
        if (err){
          console.log(err.errmsg);
          return;
        }
        chat.addUser(user, function(err, addedChat){
          if (err) {
              console.log(err.message);
              // return res.redirect('/');
              return;
          };
          console.log(user.username+' added to '+addedChat.name);
          user.addChat(addedChat, function(erro, user){
            if (erro) {
                console.log(erro);
            };
            console.log(addedChat.name+' added to '+user.username);
          });
        });
        console.log('register done, trying login ...');
        req.login(user, function(err) {
            if (err) {
                console.log(err);
            }
            // success
            console.log('logging done');
            return res.redirect('/');
            // return;
        });
      });
    };
	});
});

passport.use(new LocalStrategy(
  function(username, password, done) {
    console.log("passport use is called\n", username + password);
  	// we can call User.findOne() directly here
    // see http://passportjs.org/docs/username-password
    // User.authUsernamePassword(username, password, function(err, user){
    //   console.log("*** username password ***\n"+user);
    //   if(user){
    //     return done(null,user);
    //   }
    //   else {
    //     return done(null,false,{message:'couldn\'t auth'});
    //   }
    // });
    User.getUserByUsername(username, function(err, user){
    	if (err) throw err;
    	if (!user) {
    		console.log('no user found');
    		return done(null,false,{message:'Unknown User'});
      }
      console.log(user.password)
    	// if no prob it will continue
    	User.comparePassword(password, user.password,function(err,isMatch){
    		if (err) throw err;
    		if (isMatch) {
    			return done(null,user);
    		} else {
          console.log('Invalid password');
    			return done(null,false,{message:'Invalid pass'});
    		}
    	});
    })
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.getUserById(id, function(err, user) {
    done(err, user);
  });
});

router.post('/login', passport.authenticate('local', {failureRedirect:'/users/login'}), function(req, res) {
    // If this function gets called, authentication was successful.
    // `req.user` contains the authenticated user.
    // res.redirect('/users/' + req.user.username);
    // User.setStatus(req.user.id,true, function(err, raw){
    //   console.log('The raw response from Mongo was ', raw);
    // });
    console.log(req.user.username+' logged in');
  	res.redirect('/');
  });

router.get('/logout',function(req,res){
  console.log(req.user.username+' logged out');
	req.logout();
	res.redirect('/users/login');
});

// // get register
// router.get('/register',function(req,res){
// 	res.render('register');
// });

module.exports = router;