var express = require('express');
var router = express.Router();
var bcrypt = require('bcrypt');
var jwt = require('jsonwebtoken');
var crypto = require('crypto');

var User = require('../schema/User');
var Pickup = require('../schema/Pickup');

var SALT_ROUNDS = 12;
var JWT_SECRET = 'dirtysocks';

var nodemailer = require('nodemailer');

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
         user: 'reforest.testing@gmail.com',
         pass: '971c2b77bc49'
     }
 });

/* POST user register credentials. */
router.post('/register', (req, res) => {
  /*
    {
      email,
      password,
      name: {
        first,
        last
      }
    }
  */
  let {email, password, name} = req.body;

  User.findOne({email}).then(user => {
    if (user) {
      res.status(400).json({message: "Email already in use"});
      return;
    }

    bcrypt.hash(password, SALT_ROUNDS, (err, hash) => {
      var user = new User({
        email,
        password: hash,
        name,
        token: crypto.randomBytes(16).toString('hex')
      });
      user.save()
        .then(() => {
          const mailOptions = {
            to: email, // list of receivers
            subject: 'Welcome to Reforest', // Subject line
            html: `<h2>Welcome to Reforest</h2>
                  <a href="http://localhost:3001/auth/verify/` + user.token + `">Verify your Reforest account</a>
                  `
          };
          transporter.sendMail(mailOptions, function (err, info) {
            if(err)
              console.log(err)
            else
              console.log(info);
          });
  
          res.redirect('/')
      });
    });
  });
});

/* POST user login credentials. */
router.post('/login', (req, res) => {
  /*
    {
      email,
      password
    }
  */
  let {email, password} = req.body;

  User.findOne({email}).then(user => {
    if (!user) {
      res.status(400).json({message: "Incorrect email or password"});
      return;
    }

    user.validPassword(password).then(valid => {
      if (!valid) {
        res.status(400).json({message: "Incorrect email or password"});
        return;
      }
      if (!user.active()) {
        res.status(400).json({message: "Please verify your email address"});
        return
      }

      jwt.sign({id: user._id}, JWT_SECRET, {expiresIn: 60 * 15}, (err, token) => {
        if (err) {
          console.log(err);
          return;
        }
        res.cookie('jwt', token, {httpOnly: true}).redirect('/');
      });
    });
  });
});


var passport = require('passport');

/* GET user pickup events within a time frame. */
router.get('/pickups', passport.authenticate('jwt', {session: false}), (req, res) => {
  let from = new Date(req.query.from);
  let to = new Date(req.query.to);

  Pickup.find()
    .where("user.id")
    .equals(req.user._id)
    .where("time")
    .gte(from)
    .lte(to)
    .then(pickups => {
      res.send({
        from,
        to,
        pickups
      });
    });
});

module.exports = router;
