
/* 
  node modules
  
  SEE: https://github.com/nodejitsu/forever-monitor

*/



var Forever = require('forever-monitor'); 
;

// define apps to be run in forever
var apps = [
  { 
    env: { WEB_PORT: 8080, CIPHER_NS:'www', CIPHER_NID:0 },
  },
  { 
    env: { WEB_PORT: 8081, CIPHER_NS:'www', CIPHER_NID:1 },
  },
];

// create children for forever to watch
var app;
for (var i=0; i<apps.length; i++) {
  app = apps[i];
  console.log(app);

  app.child = new (Forever.Monitor)('app.js', {
    max: 3,
    silent: false,
    options: [],
    env: app.env
  });

  app.child.on('exit', function () {
    console.log('app.js has exited after 3 restarts');
  });

  app.child.start();

}





