# Cipher

A redis-based message-passing framework for node.js.

# Status

This software is actively under development and is not yet ready for release!

## Contributors

Originally created by Max Seiden.

Currently maintained by Jamie Pitts.

## Installation

First install [redis 2.x](http://redis.io/download).

npm install rapt-cipher

## Overview 

Cipher allows a realtime communications system to be created among a group of node servers. For example, web servers and websocket servers can send messsages to a group of data processing nodes, and vice-versa. 

Each message is addressed with a namespace and node id, enabling cipher to route it to the appropriate instance. 

In each server, a message handler is defined for a particular route. This allows many different kinds of messages to be transmitted and handled.

### Initializing Cipher

Each initialized cipher (a cipherer) requires a namespace and node id. Instances of a certain type are grouped using the namespace, and an integer is used to represent each running instance. 

A redis config must also be passed to the cipher init. 

Optionally, a [Winston](https://github.com/flatiron/winston) logger as well as custom log function can be passed to the init. 

```js
var Cipher = require('cipher'),
    Winston = require('winston');

var logger = new (Winston.Logger) ({ });
logger.add(Winston.transports.Console); 

var cipherer = Cipher.init({
  namespace: 'web',
  nid: 0,
  logger: logger,
  log: function (message, attr) {
    logger.log(attr.level, message, attr);
  },
  redis: {
    host: '127.0.0.1',
    port: 6379,
    options: {}
  }
});

cipherer.tenentHandler = function tenentHandler(recipient, cb) {
  console.log(cipher_namespace + '-' + cipher_nid + ' tenentHandler ', recipient);
  cb();
}

```

### Creating A Message Handler

All messages coming in to this cipherer will be routed to the appropriate handler function.

```js
cipherer.onTransmit("world.hello", function (origin, tenent, payload) {
  console.log('world.hello called from ', origin);
  console.log('payload: ', payload);
});


```

### Sending A Message

```js
cipherer.transmit("world.hello",
  {message: 'Hello!'},
  {namespace: 'web', nid: 1}, // send this to web node having nid=1
  0 // represents an ID of the object receiving a message (in this case, not used)
)
```


## Example Apps

See the chit-chat example web application. This demonstrates a cipher network among two web servers.


