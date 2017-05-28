var express = require('express');
var router = express.Router();

var Chat = require('../models/chat');
var User = require('../models/user');

router.get('/',function(req,res){
	res.redirect('/chat');
});

// get homepage
router.get('/chat', ensureAuthenticated,function(req,res){
	console.log('chat route is entered');
	console.log('index logged user: '+req.user.username);
	
	res.render('index',{user: req.user});
});

function ensureAuthenticated (req,res, next) {
	if (req.isAuthenticated()) {
		return next();
	} else {
		res.redirect('/users/login');
	}
}

module.exports = router;

