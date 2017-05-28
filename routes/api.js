var express = require('express');
var router = express.Router();
var passport = require('passport');
var jwt = require('jsonwebtoken');
var JwtStrategy = require('passport-jwt').Strategy;  
var ExtractJwt = require('passport-jwt').ExtractJwt;

var User = require('../models/user');
var Chat = require('../models/chat');


var io = require('../socket').io;


var chatLoadedMaxMsgs = 15;
var chatDefaultMaxUserNo = 50;

var opts = {};
opts.jwtFromRequest = ExtractJwt.fromAuthHeader();
opts.secretOrKey = 'jwtokenSecret';
passport.use(new JwtStrategy(opts, function(jwt_payload, done) {
  User.findOne({_id: jwt_payload.id}, function(err, user) {
    if (err) {
      return done(err, false);
    }
    if (user) {
      done(null, user);
    } else {
      done(null, false);
    }
  });
}));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.getUserById(id, function(err, user) {
    done(err, user);
  });
});



io.on('connection', function(socket){
  console.log('someone connected');

  router.get('/test',function(req,res){
    console.log("entered api test");
    io.sockets.emit('user action', "api test is entered")
    res.json({ success: true, message: 'test page' });
  });

  router.get('/dashboard', passport.authenticate('jwt', { session: false }), function(req, res) {
    io.sockets.emit('user action', req.user.username+" has connected from api")
    res.send('It worked! User id is: ' + req.user._id + '. '+ req.user.username);
  });

});
// io.emit('hi', 'everyone!');
// get test
// router.get('/test',function(req,res){
//   console.log("entered api test");
//   res.json({ success: true, message: 'test page' });
// });

// authentication test
// router.get('/dashboard', passport.authenticate('jwt', { session: false }), function(req, res) {
//   res.send('It worked! User id is: ' + req.user._id + '. '+ req.user.username);
// });

router.get('/user', passport.authenticate('jwt', { session: false }), function(req, res) {
  User.findOne({_id:req.user._id}).populate('chats', 'name _id lastMessage').exec(function(err, user){
    if (err) throw err;
    if (!user) {
      res.json({ success: false, message: 'no user found' });
    } else {
     res.json({ success: true, message: user });
    }
  });
});

router.get('/chat',passport.authenticate('jwt', { session: false }),function(req,res){
  console.log("entered api chat");
  Chat.getOrCreateMainChatIfNotExist(function(err,chat){
    if (err) throw err;
    if (!chat) {
      console.log('no chat found');
      res.json({ success: false, message: 'no chat found' });
    } else {
     res.json({ success: true, message: chat });
    }
  });
});

router.post('/chat', passport.authenticate('jwt', {session: false}), function(req,res){ 
  if(!req.body.name || !req.body.users ) {
    res.json({ success: false, message: 'chat info is incomplete' });
  }else {
    var users = req.body.users;
    var name = req.body.name;
    users.push(req.user._id);
    if (users.length<=chatDefaultMaxUserNo && users.length>=2) {
      createChat(name,chatDefaultMaxUserNo,users, function(chat){
        res.json({ success: true, message: chat });
      });
    } 
    else {
      res.json({ success: false, message: 'new chat users no over max' });
    }
  }
});

router.get('/chat/:chatid', passport.authenticate('jwt', {session: false}), function(req,res){ 
  var chatid = req.params.chatid;
  var me = req.user.username;
  Chat.getAndPopChatById(chatid,chatLoadedMaxMsgs, function(err, chat){
    if (err) {res.json({ success: false, message: "chat not found" });return;}
    if (chat){
      Chat.isUsernameAuth(chatid, me, function(err, isAuth){
        if (isAuth) {
          res.json({ success: true, message: chat });
        }else {
          res.json({ success: false, message: "you are not authenticated for this chat" });
        }
      });
    }
    else {
      res.json({ success: false, message: "no chat found" });
    }
  });
});

router.delete('/chat/:chatid', passport.authenticate('jwt', {session: false}), function(req,res){ 
  var chatid = req.params.chatid;
  var me = req.user.username;
  Chat.isUsernameAuth(chatid, me, function(err, isAuth){
      if (err) {res.json({ success: false, message: err.message });return;}
      if (isAuth) {
        Chat.findByIdAndRemove(chatid, function(err, chat){
          // remove it in for
          User.removeChat(chat._id);
          res.json({ success: true, message: chat.name+" deleted" });
        })
      }else {
        res.json({ success: false, message: "you are not authenticated for this chat" });
      }
  });
});

router.get('/chat/:chatid/messages', passport.authenticate('jwt', {session: false}), function(req,res){ 
  var chatid = req.params.chatid;
  var me = req.user.username;
  // TODO: auth first
  Chat.getAllMessages(chatid, function(err, chat){
    if (err) {
      res.json({ success: false, message: "chat not found" });
      return;
    }
    if (chat){
      Chat.isUsernameAuth(chatid, me, function(err, isAuth){
        if (isAuth) {
          res.json({ success: true, message: chat });
        }else {
          res.json({ success: false, message: "you are not authenticated for this chat" });
        }
      });
    }
    else {
      res.json({ success: false, message: "no chat found" });
    }
  });
});



router.put('/chat/:chatid/messages/add', passport.authenticate('jwt', {session: false}), function(req,res){ 
  if(!req.body.msg ) {
    res.json({ success: false, message: 'msg info is incomplete' });
  }else {
    var chatid = req.params.chatid;
    var msg = req.body.msg;
    var mesender = req.user.username;
    Chat.getChatUsers(chatid, function(err, chat){
      if (err) {res.json({ success: false, message: err.message });return;}
      if (chat){
        var imAuthForChat = (chat.users.filter(i => i.username == mesender).length > 0);
        if (imAuthForChat) {
          pushNewMessageToActiveChat(chatid,mesender,msg, function(err, chat){
            if (err) {res.json({ success: false, message: err.message });};
            io.to(chat.id).emit('chat message', chat.lastMessage, mesender);
            res.json({ success: true, message: chat.lastMessage });
          })
        }else {
          res.json({ success: false, message: "you are not authenticated for this chat" });
        }
      }
      else {
        res.json({ success: false, message: "no chat found" });
      }
    });
  }
});

router.put('/chat/:chatid/user/add', passport.authenticate('jwt', {session: false}), function(req,res){ 
  if(!req.body.userid ) {
    res.json({ success: false, message: 'chat user info is incomplete' });return;
  }else {
    var chatid = req.params.chatid;
    var userid = req.body.userid;
    var me = req.user.username;
    Chat.isUsernameAuth(chatid, me, function(err, isAuth){
      if (err) {
        res.json({ success: false, message: "no chat 1" });
        return;
        // TODO: here it does not return
      }
      // chat exists
      if (isAuth) {
        Chat.isFull(chatid, function (er, isFull) {
          if (er) {res.json({ success: false, message: "no chat 2" });return;};
          if (!isFull){
            User.addChat(userid, chatid, function (erro, user){
              if (erro) {res.json({ success: false, message: "no user 1" });return;}
              if (user) {
                Chat.addUser(chatid, userid, function (error, chat) {
                  if (error) {res.json({ success: false, message: "no chat 3" });return;}
                  res.json({ success: true, message: user });return;
                });
              }else {
                {res.json({ success: false, message: "no user found" });return;}
              }
            });
          }
          else {
            res.json({ success: false, message: "chat is full" });
            return;
          }
        });
      }else {
        res.json({ success: false, message: "you are not authenticated for this chat" });
        return;
      }
    });
  }
});

router.post('/register', function(req, res) {  
  if(!req.body.username || !req.body.password) {
    res.json({ success: false, message: req.body.username });
  } else {
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

        var color;
        if (!req.body.color) {
          color = '#'+Math.floor(Math.random()*16777215).toString(16);
        }else {
          color = req.body.color;
        };

        var newUser = new User({
          username: req.body.username,
          password: req.body.password,
          color: color
        });

        User.createUser(newUser,function(err,user){
          if (err){
            console.log(err.errmsg);
            return res.json({ success: false, message: 'That username already exists.'});
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
          return res.json({ success: true, message: 'Successfully created new user.' });
          // console.log('register done, trying login ...');
          // req.login(user, function(err) {
          //     if (err) {
          //         console.log(err);
          //     }
          //     // success
          //     console.log('logging done');
          //     return res.redirect('/');
          //     // return;
          // });
        });
      };
    });
  }
});

router.post('/authenticate', function(req, res) {
  console.log('entered authenticate %s',req.body.username);
  User.getUserByUsername(req.body.username, function(err, user){
    if (err) throw err;
    if (!user) {
      res.send({ success: false, message: 'Authentication failed. User not found.'+user });
    }
    else{
      // if no prob it will continue
      User.comparePassword(req.body.password, user.password,function(err,isMatch){
        if (err) throw err;
        if (isMatch) {
          // Create token if the password matched and no error was thrown

          var token = jwt.sign({id: user._id, username: user.username }, 'jwtokenSecret', {
            expiresIn: 10800 // in seconds
          });
          res.json({ success: true, token: 'JWT ' + token});
        } else {
          res.send({ success: false, message: 'Authentication failed. Passwords did not match.' });
        }
      });
    }
  })
});


// router.get('/logout',function(req,res){
//   console.log(req.user.username+' logged out');
// 	req.logout();
// 	res.redirect('/users/login');
// });


function createChat(name, max, users, callback){
  var newChat = new Chat();
  newChat.name = name;
  newChat.maxUserNo = max;
  newChat.users = users;
  newChat.save(function(err, chat){
    if (err) {console.log(err.message);return;};
    console.log(chat.name+" chat created, users added, saved");
    for (var i = 0; i < users.length; i++) {
      User.addChat(users[i],chat, function(err, user){
        if (err) {console.log(err.message);return;};
        console.log(user.username+" user attached to chat "+chat.name);
      })
    };
    callback(chat);
  });
}

function pushNewMessageToActiveChat(chatid, senderUsername, msg, callback){
    Chat.getChatById(chatid, function(err, chat){
      if (err) {return};
      var newMessage = {
        sender: senderUsername,
        message: msg
      };
      var newMsgObj = chat.messages.create(newMessage);
      chat.messages.push(newMsgObj);
      chat.lastMessage = newMsgObj;
      chat.save(callback);
    });
}


module.exports = router;

