var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/apparel', function(req, res, next) {
  res.render('apparel', { title: 'Express' });
});

module.exports = router;
