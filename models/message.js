var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = require('mongoose').Types.ObjectId; 

// var UserSchema = mongoose.model('User').schema;

var MessageSchema = Schema({
        chat: { type: Schema.Types.ObjectId, ref: 'Chat' },
        sender: String,
        message: String,
        date: { 
            type: Date, 
            default: Date.now 
        }
    }, {
	usePushEach: true
  });

MessageSchema.index({message: 'text'});


var Message = module.exports = mongoose.model('Message',MessageSchema);


module.exports.createMessage = function(newMessage, callback) {
    newMessage.save(callback);
}

module.exports.getSearchResultMessages = function(chatid,query, callback) {
    console.log('serached chat messages to be sent\t', chatid,query);
    //var query = { chat: new ObjectId(chatid) };
    //Message.find({chat: new ObjectId(chatid),$text: {$search: "\""+query+"\""}}).exec(callback);
    Message.find({chat: new ObjectId(chatid),$text: {$search: query}}).exec(callback);
	//Chat.findOne({_id: chatid}).populate('lastMessage').populate('messages').select('messages').exec(callback);
}