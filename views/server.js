var express = require('express');
var bodyParser = require('body-parser');
var mysql = require('mysql2');
var path = require('path');
// const cookieSession = require('cookie-session');
var session = require('express-session');

var connection = mysql.createConnection({
                host: '127.0.0.1',
                user: 'externalapp',
                password: 'password',
                database: 'weatherxwardrobe',
                port: 3306
});

connection.connect;
var app = express();

app.use(
  session({
      resave: false,
      saveUninitialized: true,
      secret: "anyrandomstring",
      cookie  : {
        httpOnly: true,
        //secure: true,
        maxAge  : 60 * 60 * 1000 
    }
    })
  );

// set up ejs view engine 
var urlencodedParser = bodyParser.urlencoded({ extended: false })
app.use(express.urlencoded({ extended: false }));
app.use(express.static(__dirname + '../public'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
 
app.use(express.json());


//login
app.get('/', function(req, res) {
  res.render('login');
});


app.post('/login', urlencodedParser,(req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    console.log('username:'+ username)
    const query = 'SELECT * FROM weatherxwardrobe.user WHERE username = ? AND password = ?';
    connection.query(query, [username, password], (err, result) => {
      console.log(result);
      if (err) {
        console.error('[login ERROR] - ', err.message);
        return res.sendStatus(500); 
      }
  
      if (result.length === 0) {
        console.log('Wrong username or password');
        res.redirect('/'); 
      } else {
        console.log('Logging in');
        console.log(result[0].userid)
        req.session.userID=result[0].userid
        req.session.save(() => { });
        res.redirect('/user');
      }
    });
  });

  const fetchSubscribedCitiesMiddleware = (req, res, next) => {
    if (req.session.userID) {
      const userId = req.session.userID;
      connection.query('SELECT city_id FROM usersubscribeslist WHERE user_id = ?', [userId], (err, results) => {
        if (err) {
          console.error('Error fetching subscribed cities:', err);
          return res.status(500).send('Error fetching subscribed cities');
        }
        const subscribedCities = results.map(row => row.city_id);
        res.locals.subscribedCities = subscribedCities;
        next();
      });
    } else {
      res.locals.subscribedCities = []; 
      next();
    }
  };

  const requireLoginMiddleware = (req, res, next) => {
    if (!req.session.userID) {
      res.redirect('/'); // Redirect to login page if not authenticated
    } else {
      next(); // Continue to the next middleware or route handler
    }
  };
  
  app.get('/user', requireLoginMiddleware, function(req, res) {
    const userId = req.session.userID;
    connection.query('SELECT city_id FROM usersubscribeslist WHERE user_id = ?', [userId], (err, results) => {
      if (err) {
        console.error('Error fetching subscribed cities:', err);
        res.status(500).send('Error fetching subscribed cities');
        return;
      }
      const subscribedCities = results.map(row => row.city_id);
      res.render('graph', { title: 'Weather Graph for Cities', subscribedCities: subscribedCities });
    });
  });
  
  
  app.post('/register', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const userid = req.body.userid; 
    const gender = req.body.gender;

    connection.beginTransaction(function(err) {
        if (err) { 
            console.error('Error beginning transaction:', err);
            return res.sendStatus(500);
        }

        connection.query('SELECT COUNT(*) AS count FROM user WHERE userid = ?', [userid], (err, result) => {
            if (err) {
                console.error('Error checking existing userid:', err);
                connection.rollback(function() {
                    console.error('Transaction rolled back');
                    return res.sendStatus(500);
                });
            }

            if (result[0].count > 0) {
                connection.rollback(function() {
                    console.error('Userid already exists');
                    return res.status(400).send('Userid already exists');
                });
            } else {
                connection.query('INSERT INTO user (username, password, userid, gender) VALUES (?, ?, ?, ?)', [username, password, userid, gender], (err, result) => {
                    if (err) {
                        console.error('Error creating new user', err);
                        connection.rollback(function() {
                            console.error('Transaction rolled back');
                            return res.sendStatus(500);
                        });
                    }

                    console.log('User registered successfully');

                    connection.commit(function(err) {
                        if (err) {
                            console.error('Error committing transaction:', err);
                            connection.rollback(function() {
                                console.error('Transaction rolled back');
                                return res.sendStatus(500);
                            });
                        }

                        console.log('Transaction committed');
                        res.redirect('/user');
                    });
                });
            }
        });
    });
});



app.get('/apparel', function(req, res) {
  console.log(req.session.userID)
  res.render('apparel', { title: 'Apparel' });
});

app.get('/graph', fetchSubscribedCitiesMiddleware, function(req, res) {
  res.render('graph', { title: 'graph' });
});

app.get('/searchbar', function(req, res) {
  res.render('searchbar', { title: 'search' });
});

app.get('/weather', function(req, res) {
  res.render('weather', { title: 'weather' });
});
 
app.get('/outfits', function(req, res) {
  res.render('outfits', { title: 'outfits' });
});
 

app.get('/success', function(req, res) {
      res.send({'message': 'Attendance marked successfully!'});
});
 
// HTTP request GET -- retrieve info of all the city names in the database and their respective cityIDs

// app.get('/api/getAllCities', function(req, res) {
//   var sql = 'SELECT cityName, cityID FROM weatherxwardrobe.location';
//   var query = req.query.query || '';
//   connection.query(sql, function(err, results) {
//     if (err) {
//       console.error('Error fetching user data:', err);
//       res.status(500).send({ message: 'Error fetching user data', error: err });
//       return;
//     }

//     var cityDictionary = results.reduce((acc, current) => {
//       acc[current.cityID] = { cityName: current.cityName };
//       return acc;
//   }, {});

//     res.json(cityDictionary);
//   });
// });


app.get('/api/getAllCities', function(req, res) {
  var sql = 'SELECT cityName, cityID, State FROM weatherxwardrobe.location';
  var query = req.query.query || '';
  connection.query(sql, function(err, results) {
    if (err) {
      console.error('Error fetching user data:', err);
      res.status(500).send({ message: 'Error fetching user data', error: err });
      return;
    }

    var cityDictionary = results.reduce((acc, current) => {
      acc[current.cityID] = { cityName: current.cityName ,State:current.State};
      return acc;
  }, {});

    res.json(cityDictionary);
    // console.log(cityDictionary)
  });
});

app.post('/api/keywordsearch/:query', function(req, res) {
  console.log(req.params.query)
  var sql = 'SELECT cityName, cityID, State FROM weatherxwardrobe.location WHERE cityName like \'%'+req.params.query+'%\'';
  console.log(sql)
  connection.query(sql, function(err, results) {
    if (err) {
      console.error('Error fetching city data:', err);
      console.log('error')
      res.status(500).send({ message: 'Error fetching city data', error: err });
      return;
    }
    res.json(results);
    return results;



  });
});

// Fetch outfits data
app.get('/api/outfits', function(req, res) {
  // Construct SQL query to retrieve outfit data
  var sql = 'SELECT * FROM outfit';

  // Execute the SQL query
  connection.query(sql, function(err, results) {
      if (err) {
          console.error('Error fetching outfits data:', err);
          res.status(500).send({ message: 'Error fetching outfits data', error: err });
          return;
      }

      // Send the retrieved outfit data as a JSON response
      res.json(results);
      console.log(results);
  });
});



//HTTP request POST -- send the information tot he the database and update the user's subscribe list
app.post('/api/saveCity', function(req, res){
  const {city_id, user_id} = req.body;
  var sql = 'INSERT IGNORE INTO usersubscribeslist (city_id, date, user_id) VALUES (?, "2016-01-03 00:00:00", ?)'; //Going to be something along the lines of-- INSERT IGNORE INTO usersubscribeslist ()
  connection.query(sql, [city_id, user_id], function(err, result){
    if(err){
      console.error('Error inserting city into usersubscribedlist database:', err);
      res.status(500).send({ message: 'Error inserting city', error: err });
      return;
    }
    res.json({ message: 'City added to usersubscribedlist successfully', result });
  });
});
app.get('/api/cities', function(req, res) {
  var sql = 'SELECT * FROM weatherxwardrobe.location';

  connection.query(sql, function(err, results) {
    if (err) {
      console.error('Error fetching city data:', err);
      res.status(500).send({ message: 'Error fetching city data', error: err });
      return;
    }

    // Check if results is an array before sending response
    if (!Array.isArray(results)) {
      console.error('City data is not an array');
      res.status(500).send({ message: 'City data is not an array' });
      return;
    }

    res.json(results);
    console.log(results);
  });
});

app.get('/api/temperature', function(req, res) {
  const cityID = req.query.cityID;
  console.log(cityID)

  if (!cityID) {
    res.status(400).send({ message: 'City ID is required' });
    return;
  }

  var sql = `
    SELECT w.date, w.Avg_temp, l.CityName
    FROM weatherxwardrobe.weather w
    JOIN weatherxwardrobe.location l ON w.cityID = l.CityID
    WHERE w.cityID = ?`;

  connection.query(sql, [cityID], function(err, results) {
    if (err) {
      console.error('Error fetching temperature data:', err);
      res.status(500).send({ message: 'Error fetching temperature data', error: err });
      return;
    }

    res.json(results);
    console.log(results);
  });
});


app.get('/api/cities', function(req, res) {
  var sql = 'SELECT * FROM weatherxwardrobe.location';

  connection.query(sql, function(err, results) {
    if (err) {
      console.error('Error fetching city data:', err);
      res.status(500).send({ message: 'Error fetching city data', error: err });
      return;
    }

    // Check if results is an array before sending response
    if (!Array.isArray(results)) {
      console.error('City data is not an array');
      res.status(500).send({ message: 'City data is not an array' });
      return;
    }

    res.json(results);
    console.log(results);
  });
});

app.get('/api/temperature', function(req, res) {
  // Extract city ID from the query parameters
  console.log(req.session.userID)
  const cityID = req.query.cityID;

  // Check if cityID is provided
  if (!cityID) {
    res.status(400).send({ message: 'City ID is required' });
    return;
  }

  // Construct SQL query to retrieve temperature data for the specified city
  var sql = 'SELECT date, Avg_temp FROM weatherxwardrobe.weather WHERE cityID = ?';

  // Execute the SQL query with cityID as a parameter
  connection.query(sql, [cityID], function(err, results) {
    if (err) {
      console.error('Error fetching temperature data:', err);
      res.status(500).send({ message: 'Error fetching temperature data', error: err });
      return;
    }

    // Send the retrieved temperature data as a JSON response
    res.json(results);
    console.log(results);
  });
});

app.get('/register', function(req, res) {
  res.render('register', { title: 'Register', error: null }); // Pass error as null initially
});



// API endpoints
app.get('/api/apparel', (req, res) => {
  connection.query('SELECT * FROM apparel', (err, results) => {
      if (err) {
          res.status(500).json({ error: err.message });
          return;
      }
      // console.log(results)
      res.json(results);

  });
});
app.delete('/api/apparel/:id', (req, res) => {
  const id = req.params.id;
  connection.query('DELETE FROM apparel WHERE ApparelID = ?', id, (err, results) => {
      if (err) {
          res.status(500).json({ error: err.message });
          return;
      }
      res.json({ message: 'Entry deleted successfully' });
  });
});
function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}

app.post('/api/apparel', (req, res) => {
  const { tempFrom, tempTo, category, productName } = req.body;
  console.log(req.body)
  const apid= getRandomArbitrary(400,1000)
  connection.query('INSERT INTO apparel (temp_from, temp_to, category, product_name,ApparelID) VALUES (?, ?, ?, ?,?)', [tempFrom, tempTo, category, productName,apid], (err, results) => {
      if (err) {
          res.status(500).json({ error: err.message });
          return;
      }
      res.json({ message: 'Apparel added successfully' });
  });
});


app.listen(80, function () {
    console.log('Node app is running on port 80');
});

app.get('/api/apparel/:id', (req, res) => {
  const id = req.params.id;

  // SQL query to select apparel by ID
  const query = 'SELECT * FROM apparel WHERE ApparelID = ?';

  // Execute the query with the provided ID
  connection.query(query, [id], (err, results) => {
      if (err) {
          console.error('Error fetching apparel:', err);
          res.status(500).json({ error: 'Failed to fetch apparel' });
          return;
      }

      // If apparel with the given ID is found, send it as JSON response
      if (results.length > 0) {
          res.json(results[0]);
      } else {
          res.status(404).json({ error: 'Apparel not found' });
      }
  });
});
app.put('/api/apparel/:id', (req, res) => {
  const id = req.params.id;
  const { tempFrom, tempTo, category, productName } = req.body;

         
  // SQL query to update the apparel entry
  const query = 'UPDATE apparel SET Temp_from = ?, Temp_to = ?, category = ?, product_name = ? WHERE ApparelID = ?';
  console.log(query)
  // Execute the query with the provided data
  connection.query(query, [tempFrom, tempTo, category, productName, id], (err, result) => {
      if (err) {
          console.error('Error updating apparel:', err);
          console.log(err)
          res.status(500).json({ error: 'Failed to update apparel' });
          return;
      }

      // Check if any rows were affected
      if (result.affectedRows > 0) {
          res.json({ message: 'Apparel updated successfully' });
      } else {
          res.status(404).json({ error: 'Apparel not found' });
      }
  });
});
