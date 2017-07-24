var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');
var Session = require('express-session');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();
var authenticated = false;




app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(Session({
  secret: 'DOGSDOGSDOGS',
  resave: true,
  saveUninitalized: true
}));


app.post('/login', function(req, res) {
  var user = req.body.username;
  var hashed;

  new User({'username': req.body.username}).fetch().then(function(found) {
    console.log('FOUND IS', found.attributes);
    if (!found) {
      console.log('Username not found');
      res.render('login');
    } else {
      hashed = found.attributes.password;

      bcrypt.compare(req.body.password, hashed, function(err, match) { 
        if (err) {
          console.log(err);
        } else {
          if (match) {
            req.session.access = true;
            res.render('index');
            res.end();
          } else {
            console.log('invalid password');
            res.render('login');
            res.end();
          }
        }
      });
      
    }
  });
});

app.get('/signup', function(req, res) {
  res.render('signup');
  res.end();
});

app.post('/signup', function(req, res) {
  new User ({'username': req.body.username}).fetch().then(function(found) {
    if (found) {
      console.log('fail');
      res.render('signup');
      res.end();
    } else {
      console.log('success');

      Users.create({
        username: req.body.username,
        password: req.body.password
      })
        .then(function(newUser) {
          res.status(201);
        });

      res.render('login');
      res.end();
    }
  });
});

app.get('/logout', function(req, res) {
  req.session.destroy(function(err) {
    if (err) {
      console.log('ERROR', err);
    }
  });
  res.render('login');
  res.end();
});

const isAuthenticated = function(req, res, next) {
  if (req.session.access) {
    next();
  } else {
    res.status(401);
    res.render('login');
  }
};

// app.use(isAuthenticated);

app.get('/', isAuthenticated,
function(req, res) {
  res.render('index');
});

app.get('/create', isAuthenticated,
function(req, res) {
  res.render('index');
});

app.get('/links', isAuthenticated,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
});

app.post('/links', isAuthenticated,
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

module.exports = app;
