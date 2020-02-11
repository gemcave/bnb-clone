const express = require('express');
const next = require('next');

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);

const { User } = require('./model.js');
const { sequelize } = require('./model.js');

const sessionStore = new SequelizeStore({
  db: sequelize,
});

const port = parseInt(process.env.PORT, 10) || 3000;
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async function(email, password, done) {
      if (!email || !password) {
        done('Email and password required', null);
        return;
      }

      const user = await User.findOne({ where: { email } });

      if (!user) {
        done('User not found', null);
        return;
      }

      const valid = await user.isPasswordValid(password);

      if (!valid) {
        done('Email and password do not match', null);
        return;
      }

      done(null, user);
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.email);
});

passport.deserializeUser((email, done) => {
  User.findOne({ where: { email } }).then(user => {
    done(null, user);
  });
});

nextApp.prepare().then(() => {
  const server = express();

  server.use(
    session({
      secret: '343ji43j4n3jn4jk3n', // enter a random string here
      resave: false,
      saveUninitialized: true,
      name: 'nextbnb',
      cookie: {
        secure: false, // CRITICAL on localhost
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      },
      store: sessionStore,
    }),
    passport.initialize(),
    passport.session()
  );

  sessionStore.sync();

  server.all('*', (req, res) => handle(req, res));

  server.listen(port, err => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
