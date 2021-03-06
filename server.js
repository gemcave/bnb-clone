const User = require('./models/user.js');
const House = require('./models/house.js');

const fileupload = require('express-fileupload');

const randomstring = require('randomstring');

const sanitizeHtml = require('sanitize-html');

const dotenv = require('dotenv');

const express = require('express');
const next = require('next');

const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

const bodyParser = require('body-parser');

const { Op } = require('sequelize');
const sequelize = require('./database.js');
const Review = require('./models/review.js');
const Booking = require('./models/booking.js');

dotenv.config();

const sessionStore = new SequelizeStore({
  db: sequelize,
});
sessionStore.sync();

const getDatesBetweenDates = (startDate, endDate) => {
  let dates = [];
  while (startDate < endDate) {
    dates = [...dates, new Date(startDate)];
    startDate.setDate(startDate.getDate() + 1);
  }
  dates = [...dates, endDate];
  return dates;
};

const canBookThoseDates = async (houseId, startDate, endDate) => {
  const results = await Booking.findAll({
    where: {
      houseId,
      startDate: {
        [Op.lte]: new Date(endDate),
      },
      endDate: {
        [Op.gte]: new Date(startDate),
      },
    },
  });
  return !(results.length > 0);
};

User.sync({ alter: true });
House.sync({ alter: true });
Review.sync({ alter: true });
Booking.sync({ alter: true });

const port = parseInt(process.env.PORT, 10) || 3000;
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

passport.serializeUser((user, done) => {
  console.log(`2${user}`);
  done(null, user);
});

passport.deserializeUser((email, done) => {
  console.log(`3${email}`);
  User.findOne({ where: { email } }).then(user => {
    done(null, user);
  });
});

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

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: '/auth/facebook/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      console.log(profile);
      const [user, created] = await User.findOrCreate({
        where: { username: profile.displayName },
        defaults: {
          email: 'John Doe',
          password: Math.random()
            .toString(36)
            .slice(-8),
        },
      });
      if (created) {
        return done(created, profile);
      }
      return done(null, profile);
    }
  )
);

nextApp.prepare().then(() => {
  const server = express();

  server.use(
    bodyParser.json({
      verify: (req, res, buf) => {
        // make rawBody available
        req.rawBody = buf;
      },
    })
  );

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
    passport.session(),
    fileupload()
  );

  server.post('/api/auth/logout', (req, res) => {
    req.logout();
    req.session.destroy();
    return res.end(
      JSON.stringify({ status: 'success', message: 'Logged out' })
    );
  });

  server.post('/api/auth/register', async (req, res) => {
    const { email, password, passwordconfirmation } = req.body;

    if (password !== passwordconfirmation) {
      res.end(
        JSON.stringify({ status: 'error', message: 'Passwords do not match' })
      );
      return;
    }

    try {
      const user = await User.create({ email, password });

      req.login(user, err => {
        if (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ status: 'error', message: err }));
          return;
        }

        return res.end(
          JSON.stringify({ status: 'success', message: 'Logged in' })
        );
      });
    } catch (error) {
      res.statusCode = 500;
      let message = 'An error occurred';
      if (error.name === 'SequelizeUniqueConstraintError') {
        message = 'User already exists';
      }
      res.end(JSON.stringify({ status: 'error', message }));
    }
  });

  server.post('/api/auth/login', async (req, res) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) {
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            status: 'error',
            message: err,
          })
        );
        return;
      }

      if (!user) {
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            status: 'error',
            message: 'No user matching credentials',
          })
        );
        return;
      }

      req.login(user, err => {
        if (err) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              status: 'error',
              message: err,
            })
          );
          return;
        }

        return res.end(
          JSON.stringify({
            status: 'success',
            message: 'Logged in',
          })
        );
      });
    })(req, res, next);
  });

  server.get('/auth/facebook', passport.authenticate('facebook'));

  server.get(
    '/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/' }),
    function(req, res) {
      // Successful authentication, redirect home.
      console.log('auth');
      res.redirect('/bookings');
    }
  );

  server.get('/api/houses', (req, res) => {
    House.findAndCountAll().then(result => {
      const houses = result.rows.map(house => house.dataValues);

      res.writeHead(200, {
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify(houses));
    });
  });

  server.get('/api/houses/:id', (req, res) => {
    const { id } = req.params;

    House.findByPk(id).then(house => {
      if (house) {
        Review.findAndCountAll({
          where: {
            houseId: house.id,
          },
        }).then(reviews => {
          house.dataValues.reviews = reviews.rows.map(
            review => review.dataValues
          );
          house.dataValues.reviewsCount = reviews.count;
          res.writeHead(200, {
            'Content-Type': 'application/json',
          });
          res.end(JSON.stringify(house.dataValues));
        });
      } else {
        res.writeHead(404, {
          'Content-Type': 'application/json',
        });
        res.end(
          JSON.stringify({
            message: `Not found`,
          })
        );
      }
    });
  });

  server.post('/api/houses/reserve', async (req, res) => {
    if (!req.session.passport) {
      res.writeHead(403, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          status: 'error',
          message: 'Unauthorized',
        })
      );

      return;
    }

    if (
      !(await canBookThoseDates(
        req.body.houseId,
        req.body.startDate,
        req.body.endDate
      ))
    ) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          status: 'error',
          message: 'House is already booked',
        })
      );

      return;
    }
    const userEmail = req.session.passport.user;
    User.findOne({ where: { email: userEmail } }).then(user => {
      Booking.create({
        houseId: req.body.houseId,
        userId: user.id,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        sessionId: req.body.sessionId,
      }).then(() => {
        res.writeHead(200, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ status: 'success', message: 'ok' }));
      });
    });
  });

  server.post('/api/houses/booked', async (req, res) => {
    const { houseId } = req.body;

    const results = await Booking.findAll({
      where: {
        houseId,
        endDate: {
          [Op.gte]: new Date(),
        },
      },
    });

    let bookedDates = [];

    for (const result of results) {
      const dates = getDatesBetweenDates(
        new Date(result.startDate),
        new Date(result.endDate)
      );

      bookedDates = [...bookedDates, ...dates];
    }

    bookedDates = [...new Set(bookedDates.map(date => date))];

    res.json({
      status: 'success',
      message: 'ok',
      dates: bookedDates,
    });
  });

  server.post('/api/houses/check', async (req, res) => {
    const { startDate } = req.body;
    const { endDate } = req.body;
    const { houseId } = req.body;

    let message = 'free';
    if (!(await canBookThoseDates(houseId, startDate, endDate))) {
      message = 'busy';
    }

    res.json({
      status: 'success',
      message,
    });
  });

  server.post('/api/stripe/session', async (req, res) => {
    const { amount } = req.body;

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          name: 'Booking house on Airbnb clone',
          amount: amount * 100,
          currency: 'usd',
          quantity: 1,
        },
      ],
      success_url: `${process.env.BASE_URL}/bookings`,
      cancel_url: `${process.env.BASE_URL}/bookings`,
    });

    res.writeHead(200, {
      'Content-Type': 'application/json',
    });
    res.end(
      JSON.stringify({
        status: 'success',
        sessionId: session.id,
        stripePublicKey: process.env.STRIPE_PUBLIC_KEY,
      })
    );
  });

  server.post('/api/stripe/webhook', async (req, res) => {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const sig = req.headers['stripe-signature'];

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
      res.writeHead(400, {
        'Content-Type': 'application/json',
      });
      console.error(err.message);
      res.end(
        JSON.stringify({
          status: 'success',
          message: `Webhook Error: ${err.message}`,
        })
      );
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const sessionId = event.data.object.id;

      try {
        Booking.update({ paid: true }, { where: { sessionId } });
      } catch (err) {
        console.error(err);
      }
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify({ received: true }));
  });

  server.post('/api/bookings/clean', (req, res) => {
    Booking.destroy({
      where: {
        paid: false,
      },
    });

    res.writeHead(200, {
      'Content-Type': 'application/json',
    });

    res.end(
      JSON.stringify({
        status: 'success',
        message: 'ok',
      })
    );
  });
  server.get('/api/bookings/list', async (req, res) => {
    if (!req.session.passport || !req.session.passport.user) {
      res.writeHead(403, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          status: 'error',
          message: 'Unauthorized',
        })
      );

      return;
    }

    const userEmail = req.session.passport.user;
    const user = await User.findOne({ where: { email: userEmail } });

    Booking.findAndCountAll({
      where: {
        paid: true,
        userId: user.id,
        endDate: {
          [Op.gte]: new Date(),
        },
      },
      order: [['startDate', 'ASC']],
    }).then(async result => {
      const bookings = await Promise.all(
        result.rows.map(async booking => {
          const data = {};
          data.booking = booking.dataValues;
          data.house = (await House.findByPk(data.booking.houseId)).dataValues;
          return data;
        })
      );

      res.writeHead(200, {
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify(bookings));
    });
  });

  server.get('/api/host/list', async (req, res) => {
    if (!req.session.passport || !req.session.passport.user) {
      res.writeHead(403, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          status: 'error',
          message: 'Unauthorized',
        })
      );

      return;
    }

    const userEmail = req.session.passport.user;
    const user = await User.findOne({ where: { email: userEmail } });

    const houses = await House.findAll({
      where: {
        host: user.id,
      },
    });
    const houseIds = houses.map(house => house.dataValues.id);

    const bookingsData = await Booking.findAll({
      where: {
        paid: true,
        houseId: {
          [Op.in]: houseIds,
        },
        endDate: {
          [Op.gte]: new Date(),
        },
      },
      order: [['startDate', 'ASC']],
    });

    const bookings = await Promise.all(
      bookingsData.map(async booking => ({
        booking: booking.dataValues,
        house: houses.filter(
          house => house.dataValues.id === booking.dataValues.houseId
        )[0].dataValues,
      }))
    );

    res.writeHead(200, {
      'Content-Type': 'application/json',
    });
    res.end(
      JSON.stringify({
        bookings,
        houses,
      })
    );
  });

  server.post('/api/host/new', async (req, res) => {
    const houseData = req.body.house;

    houseData.description = sanitizeHtml(houseData.description, {
      allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
    });

    if (!req.session.passport) {
      res.writeHead(403, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          status: 'error',
          message: 'Unauthorized',
        })
      );

      return;
    }

    const userEmail = req.session.passport.user;
    User.findOne({ where: { email: userEmail } }).then(user => {
      houseData.host = user.id;
      House.create(houseData).then(() => {
        res.writeHead(200, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ status: 'success', message: 'ok' }));
      });
    });
  });

  server.post('/api/host/edit', async (req, res) => {
    const houseData = req.body.house;

    houseData.description = sanitizeHtml(houseData.description, {
      allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
    });

    if (!req.session.passport) {
      res.writeHead(403, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          status: 'error',
          message: 'Unauthorized',
        })
      );

      return;
    }

    const userEmail = req.session.passport.user;
    User.findOne({ where: { email: userEmail } }).then(user => {
      House.findByPk(houseData.id).then(house => {
        if (house) {
          if (house.host !== user.id) {
            res.writeHead(403, {
              'Content-Type': 'application/json',
            });
            res.end(
              JSON.stringify({
                status: 'error',
                message: 'Unauthorized',
              })
            );

            return;
          }

          House.update(houseData, {
            where: {
              id: houseData.id,
            },
          })
            .then(() => {
              res.writeHead(200, {
                'Content-Type': 'application/json',
              });
              res.end(JSON.stringify({ status: 'success', message: 'ok' }));
            })
            .catch(err => {
              res.writeHead(500, {
                'Content-Type': 'application/json',
              });
              res.end(JSON.stringify({ status: 'error', message: err.name }));
            });
        } else {
          res.writeHead(404, {
            'Content-Type': 'application/json',
          });
          res.end(
            JSON.stringify({
              message: `Not found`,
            })
          );
        }
      });
    });
  });

  server.post('/api/host/image', (req, res) => {
    if (!req.session.passport) {
      res.writeHead(403, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          status: 'error',
          message: 'Unauthorized',
        })
      );

      return;
    }

    const { image } = req.files;
    const fileName = randomstring.generate(7) + image.name.replace(/\s/g, '');
    const path = `${__dirname}/public/img/houses/${fileName}`;

    image.mv(path, error => {
      if (error) {
        console.error(error);
        res.writeHead(500, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ status: 'error', message: error }));
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({ status: 'success', path: `/img/houses/${fileName}` })
      );
    });
  });

  server.all('*', (req, res) => handle(req, res));

  server.listen(port, err => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
