/* 
  node modules
*/

var Express = require('express')
  , Partials = require('express-partials')
  , Winston = require('winston')
  , Cipher = require('../../lib/cipher')
;


/* 
  app context definition (required by rapt-cipher)
*/


// set up the config
var service_cfg;
try {
  require.resolve('./config/' + global.process.env.NODE_ENV);
  service_cfg = require('./config/' + global.process.env.NODE_ENV).config;

} catch (e) {
  console.log('Service will use the default config: config/environment.js.default');

  // fall back to the default config
  try {
    require.resolve('./config/environment.js.default');
    service_cfg = require('./config/environment.js.default').config;

  } catch (e) {
    console.error('Cannot load config/environment.js.default!');
    process.exit(e.code);
  }
}


/*
  define a logger
*/

var logger = new (Winston.Logger) ({ });
logger.add(Winston.transports.Console);

/*
  cipher configuration
*/

// default node and namespace
var cipher_nid = process.env.CIPHER_NID ? process.env.CIPHER_NID : 0;
var cipher_namespace = process.env.CIPHER_NS ? process.env.CIPHER_NS : 'web';

// init the cipherer
var cipherer = Cipher.init({
  namespace: cipher_namespace, 
  nid: cipher_nid,
  logger: logger,
  log: function (message, attr) {
    logger.log(attr.level, message, attr);
  },
  redis: service_cfg.redis
});


// cipher tenent handler

cipherer.tenentHandler = function tenentHandler(recipient, cb) {
  console.log(cipher_namespace + '-' + cipher_nid + ' tenentHandler ', recipient);
  cb();
}


/*
  express configuration
*/


var app = Express();

app.use(Express.bodyParser());

// app state, will store hello messages from other nodes

var app_state = {
  messages: [],
};


/* 
  EJS views
  SEE: 
    https://github.com/publicclass/express-partials
    http://embeddedjs.com/
*/

app.use( Partials() ); 


/*
  Static files
*/

app.use(Express.static(__dirname + '/public')); 


/*
  Web routes
*/

app.get('/', function(req, res){
  res.render('index.ejs', { 
    layout:false,
    title: 'Cipher Web Demo',
    service_cfg: service_cfg 
  }); 
});


// say hello to another node

app.post('/api/say_hello', function(req, res) {

  var payload = {message: req.body.message};
  var address = { namespace: req.body.namespace, nid: req.body.nid };
  
  // transmit the message using cipher 
  cipherer.transmit("world.hello",
    payload,
    address,
    0 // represents an ID of the object receiving a message (in this case, not used)
  ); 
  
  // done
  return res.json({ 
    success: {message: 'Transmitted to world.hello!'}, 
    payload: payload,
    address: address
  });  

});


// get messages

app.get('/api/messages', function (req, res) {
  return res.json(app_state.messages);  
});


/*
  cipher message handlers
*/


// hello, world

cipherer.onTransmit("world.hello", function (origin, tenent, payload) {
  //console.log('world.hello ', payload);
  
  // when hello message is received, push into the messages 
  if (payload && payload.message) {
    app_state.messages.push({
      message: payload.message,
      origin: origin,
      received_at: (new Date()).getTime()
    });
    
  }

});


/*
  start listening
*/

var web_port = process.env.WEB_PORT ? process.env.WEB_PORT : service_cfg.web.port;

app.listen(web_port);
console.log('App for ns[' + cipher_namespace + '] nid[' + cipher_nid + '] listening on port[' + web_port + '].');



