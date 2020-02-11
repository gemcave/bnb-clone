const express = require('express');
const next = require('next');

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

nextApp.prepare().then(() => {
  const server = express();

  server.use(
    session({
      secret: '343ji43j4n3jn4jk3n',
      resave: false,
      saveUninitialized: true,
      name: 'nextbnb',
      cookie: {
        secure: false,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
      store: sessionStore,
    })
  );

  sessionStore.sync();

  server.all('*', (req, res) => handle(req, res));

  server.listen(port, err => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
