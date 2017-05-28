var mongoose = require('mongoose');
var Schema = mongoose.Schema;
// var UserSchema = mongoose.model('User').schema;

var MessageSchema = Schema({
	sender: String,
	message: String,
	date: { 
		type: Date, 
		default: Date.now 
	}
});

var ChatSchema = Schema({
	name: String,
	maxUserNo: 	Number,
	users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
	lastMessage: MessageSchema,
	messages: [MessageSchema]
});

ChatSchema.methods.addUser = function(user, callback) {
  	if (this.users.length<this.maxUserNo) {
		var query = {_id:this.id},
			update = { $addToSet: {users: user} },	    
		    options = { upsert: true, new: true, setDefaultsOnInsert: true };
		Chat.findOneAndUpdate(query, update, options, callback);
  	} else {
  		callback( new Error('error maxed out error') );
    	return;
  	}
};

ChatSchema.methods.isFull = function() {
  	return this.users.length==this.maxUserNo;
};


var Message = module.exports = mongoose.model('Message',MessageSchema);
var Chat = module.exports = mongoose.model('Chat',ChatSchema);

module.exports.getChatById = function(id, callback) {
	Chat.findById(id,callback);
}

module.exports.getAndPopChatById = function(id, messageLimit,callback) {
	// console.log('chat is to be populated and sent back');
	Chat.findOne({_id: id}).populate('users','username _id').slice('messages',-messageLimit).exec(callback);
}

module.exports.getLimitedMessages = function(id, messageLimit, start, callback) {
	console.log('chat messages to be sent');
	// Chat.findOne({_id: id}).slice('messages', [-start, messageLimit]).exec(callback);
	Chat.findOne({_id: id}).select('messages').exec(callback);
}

module.exports.getAllMessages = function(id, callback) {
	console.log('chat messages to be sent');
	Chat.findOne({_id: id}).select('messages').exec(callback);
}

module.exports.getChatUsers = function(id, callback) {
	Chat.findOne({_id: id}).select('users').populate('users','username _id').exec(callback);
}

module.exports.isUsernameAuth = function(id, username, callback){
	Chat.findOne({_id: id}).select('users').populate('users','username').exec( function(err, chat){
		if (err) {callback(err);};
		if (chat) {
			if (chat.users.filter(i => i.username == username).length > 0) {
				callback(err, true);
			}else {
				callback(err, false);
			}
			return;
		}else {
			callback( new Error('error no chat found') );
    		return;
		}
	});
}

module.exports.isFull = function(id, callback) {
	Chat.findOne({_id: id}).select('users maxUserNo').exec(function (err, chat) {
		if (err) {callback(err);return;};
		if (chat) {
			if (chat.users.length>=chat.maxUserNo) {
				callback(err, true);
			}else {
				callback(err, false);
			}
			return;
		}else {
			callback( new Error('error no chat found') );
    		return;
		}
	});
  	
};

module.exports.getOrCreateMainChatIfNotExist = function(callback){
	Chat.count({},function(err,count){
		if (err) {
			console.log("error in getOrCreateMainChatIfNotExist");
			return;
		}
		if (count==0) {
			var newChat = new Chat();
			newChat.name = "Main Chat";
			newChat.maxUserNo = 50;
			newChat.users = [];
			console.log("new chat created");
			newChat.save(callback);
		} else {
			console.log("chat exists");
			Chat.findOne({}).populate('users','username _id').exec(callback);
		}
	});
}

module.exports.addUser = function(chatid, user, callback) {
	Chat.findOne({_id: chatid}).select('_id maxUserNo users').exec(function(err, chat){
		if (err) {callback(err);};
		if (chat.users.length<chat.maxUserNo) {
			var query = {_id:chat._id},
				update = { $addToSet: {users: user} },	    
			    options = { upsert: true, new: true, setDefaultsOnInsert: true };
			Chat.findOneAndUpdate(query, update, options, callback);
	  	} else {
	  		callback( new Error('error maxed out error') );
	    	return;
	  	}
	});
};

// module.exports.createOrUpdateMainChat = function(loggedUser, callback) {
// 	var query = {},
// 		update = { 
// 	    	name: 'Main Chat',
// 	    	maxUserNo: 500,
// 	    	$addToSet: {users: loggedUser} 
// 	    },	    
// 	    options = { upsert: true, new: true, setDefaultsOnInsert: true };

// 	// Find the document
// 	Chat.findOneAndUpdate(query, update, options, callback);
// }