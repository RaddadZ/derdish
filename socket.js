var User = require('./models/user');
var Chat = require('./models/chat');
var Message = require('./models/message');
var io = require('socket.io')();

var onlineUsers = {};

var chatLoadedMaxMsgs = 15;
var chatDefaultMaxUserNo = 50;


// io.of('/chat')
io.on('connection', function(socket) {
	console.log('chat Client is connected');

	socket.activeChat = {};

	var ID = socket.request.session.passport.user;

	User.findOne({_id:ID}).populate('chats', 'name _id lastMessage').exec(function(err, user){
		if (err){
	      console.log(err.message);
	      return;
	    };

	    onlineUsers[user.username] = true;
	    io.sockets.emit('update chats');
	    if (user.chats.length>0) {
	    	switchToChat(user.chats[0].id, function(){
	    		// send user connected and update user list
		    	io.sockets.emit('user action', user.username+" connected");
	    	});
	    }
	    else {
			console.log('onconnect: user has no chats');
			socket.emit('user not auth chat');
		};

	    socket.on('chat message', function(msg){
	    	if (socket.activeChat.id) {
				console.log("chat message entered and msg is "+msg);
				pushNewMessageToActiveChat(msg,user.username, function (err, chat) {
				  if (err) return console.log(err.message)
				  console.log('server: '+chat.name+': message: '+chat.lastMessage.sender+': ' + chat.lastMessage.message);
				  io.in(chat.id).emit('chat message', chat.lastMessage, user.username);
				});
			}else {
				console.log('chat message: chat has no id');
				socket.emit('user not auth chat');
			};
	  	});

		socket.on('message remove', function(msgId){
			if (socket.activeChat.id) {
				var chat = socket.activeChat;
				console.log("message remove entered and msg id is "+msgId);
				Message.findByIdAndRemove(msgId, function(err, msg){
					if (err) return console.log(err.message)
					if(msg){
						console.log('server: '+chat.name+': message removed: '+msg.sender+': ' + msg.message);
						io.in(chat.id).emit('message remove',msg._id);
					}
				})
			}else {
				console.log('chat message remove: chat has no id');
				socket.emit('message remove, user not auth chat');
			};
		});
	  	socket.on('new chat', function(data){
	  		console.log(data);
	  		if (data.selectedusers.length<=chatDefaultMaxUserNo && data.selectedusers.length>=2) {
	  			data.selectedusers.push(user.id);
				createChat(data.chatname,chatDefaultMaxUserNo,data.selectedusers, function(chat){
					// people in chat (+me) : update chat list - server to room sockets, indivi socket to server, server to socket
					io.sockets.emit('update chats'); // triggers sockets to send chatlist update requeste, indivisually
					// me : switch to new chat
					switchToChat(chat.id, function(){});
				});
	  		} 
	  		else {
	  			console.log('new chat users no over max');
	  		}
	  	});

	  	socket.on('new dual chat', function(secondUser){
	  		user.getChats(function (err, userOfChats){
	  			if (err) {console.log(err.message);return;};
	  			// var onetwo = (userOfChats.chats.filter(i => i.name == (username+user.username)).length > 0);
	  			// var twoone = (userOfChats.chats.filter(i => i.name == (user.username+username)).length > 0);
	  			var dualChats = userOfChats.chats.filter(i => i.users.length == 2);
	  			var doesExist = false;
  				for (var i = 0; i < dualChats.length; i++) {
	  				if (dualChats[i].users.indexOf(secondUser.id) != -1) {
	  					doesExist = dualChats[i];
	  				}
	  			};
	  			if (doesExist) {
	  				console.log('does Exist '+doesExist.name);
	  				switchToChat(doesExist.id, function(){});
	  			}else {
	  				console.log('does not Exist '+doesExist);
	  				var users = [user.id, secondUser.id];
  					createChat(('\'\"*'+user.username+secondUser.username), 2, users, function(chat){
  						io.sockets.emit('update chats');
  						switchToChat(chat.id, function(){});
  					});
	  			}
	  		})
	  	})

		socket.on('load main chat users', function () {
			Chat.getOrCreateMainChatIfNotExist(function(err, chat){
				if (err) {console.log(err.message);return;};
				socket.emit('load main chat users',chat.users);
			})
		});

		socket.on('update my chats', function () {
			user.getChats(function (err, userOfChats) {
				socket.emit('update my chats', userOfChats.chats);
			})
		})

		socket.on('update activechat users', function () {
			Chat.getChatUsers(socket.activeChat.id, function(err, chat){
				if (err) {console.log(err.message);return;};
				socket.emit('update activechat users', chat.users, onlineUsers);
			})
		})

		socket.on('load more messages', function(counter){
			Chat.getLimitedMessages(socket.activeChat.id, chatLoadedMaxMsgs, (chatLoadedMaxMsgs*counter), function(err, chat){
				if (err) {console.log(err.message);return;};
				socket.emit('load more messages', chat.messages);
			})
		})

		socket.on('update user', function(data){
			console.log(data);
			User.updateUser(user.id, data.password, data.color, function(err, updatedUser){
				if(err) console.log(err.message);
				else console.log("user updated succsessfuly\t", updatedUser);
			})
			
		});

	});

	socket.on('chat switch', function(chatid){
		switchToChat(chatid, function(){});
	})

	socket.on('disconnect',function(){
		User.getUserById(ID, function (err, user) {
			if (err) return;
			if (socket.activeChat.id) {
				// console.log('disconnected activechat for user '+user.username+' is :'+ socket.activeChat.name);
				socket.leave(socket.activeChat.id);
				delete onlineUsers[user.username];
				io.sockets.emit('user action', user.username+" disconnected");
			}
			else {
				console.log('disconnect: chat has no id');
				socket.emit('user not auth chat');
			};
		});
	});

	function pushNewMessageToActiveChat(msg, username, callback){
		Chat.getChatById(socket.activeChat.id, function(err, chat){
			if (err) {console.log(err.message)};
			var newMessage = new Message();
			newMessage.chat = socket.activeChat.id;
			newMessage.sender= username;
			newMessage.message= msg;
			newMessage.save(function(err,savedmsg){
				if (err) {console.log(err.message)};
				chat.addMessage(savedmsg, callback);
			});
			// if (err) {return};
			// 	var newMessage = {
			// 	sender: username,
			// 	message: msg
			// };
			// var newMsgObj = chat.messages.create(newMessage);
			// chat.messages.push(newMsgObj);
			// chat.lastMessage = newMsgObj;
			// chat.save(callback);
		});
	}
	function switchToChat(chatid, callback) {
		Chat.getAndPopChatById(chatid, chatLoadedMaxMsgs,function(err, chat){
			// me : change socket room and active chat
			if (socket.activeChat.id) 
				socket.leave(socket.activeChat.id);
			socket.activeChat = chat;
			socket.join(socket.activeChat.id);
			// update active chat info
			var data = {
				chat : chat,
				onlineusers : onlineUsers
			}
			socket.emit('chat switch', data);
			callback();
		})
	}
	function addUserToChat (chat,user) {
		// people in chat (+me) : show user added message
	}
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
});



module.exports = {
	io: io
};
