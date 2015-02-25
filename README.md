# Cipher

A redis-based message-passing framework for node.js.

# Status

Cipher is actively under development. As this is early-release software, it should only be used with caution in production environments.

# Contributors

Originally created by Max Seiden.

Currently maintained by Jamie Pitts.

# Requirements

Cipher requires [redis 2.x](http://redis.io/download) and node.js.

# Installation

npm install rapt-cipher

# Overview 

Cipher allows a realtime communications system to be created among a group of node servers. For example, web servers and websocket servers can send messsages to a group of data processing nodes, and vice-versa. 

Each message is addressed with a namespace, node id, and optional tenent id enabling cipher to route it to the appropriate instance. 

In each server, a message handler is defined for a particular route. This allows many different kinds of messages to be transmitted and handled.

## Initializing Cipher

Each initialized cipher (a cipherer) represents an individual service that is reachable by the cipher network. In this example, a cipher is configured for a websocket service: 

```js
var Cipher = require('cipher'),
    Winston = require('winston');

var logger = new (Winston.Logger) ({ });
logger.add(Winston.transports.Console); 

var cipherer = Cipher.init({
  namespace: 'ws',
  nid: 0,
  logger: logger,
  log: function (message, attr) {
    logger.log(attr.level, message, attr);
  },
  redis: {
    host: '127.0.0.1', port: 6379, options: {}
  }
});

cipherer.tenentHandler = function tenentHandler(recipient, cb) {
  get_recipient_from_db(recipient.tid, function (recipient_obj) {
    cb(null, recipient_obj);
  });
  // cb(); // if there is to be no lookup
}

```

Required components of a cipher initialization:

The namespace and node id for that service. 

A redis config so that the cipherer may use redis to listen for, transmit, or broadcast messages. 

A [Winston](https://github.com/flatiron/winston) logger, as well as a custom log function (both optional). 

Lastly, a tenentHandler function must also be defined when initializing cipher. This is a convenience function to enable your application to perform lookups relating to the message recipient. If you have no lookup to perform, just call the callback with no parameters.


## Creating A Message Handler

All messages coming in to a cipherer will be routed to the appropriate handler function. The following example might be defined in the websocket service (having namespace=ws and nid=0) after initializing cipher:

```js
cipherer.onTransmit("world.hello", function (origin, tenent, payload) {
  console.log('world.hello called from ', origin);
  console.log('world.hello sent to ', tenent.id);
  console.log('payload: ', payload);

  // ... code to emit the message to the appropriate ws client ... //

});


```

## Sending A Message

In another service having its own initialized cipherer (perhaps a game worker), the following might be used to send a message to the websocket service (having namespace=ws and nid=0):

```js
cipherer.transmit("world.hello",
  {chat: 'Hello!'},
  {namespace: 'ws', nid: 0, tid: 1234567890}, // send this to the ws node having nid=0
)
```

## Cipher Message Format

A cipher message contains a payload and a recipient:

```js
var msg = {
    payload: {
        "chat":"Hello, World!"
    },
    recipient: {
        "ns":"ws", 
        "nid":0, 
        "tid":"1234567890"
    }
};
```

The payload is for use in your application and will not be processed or acted upon by cipher.

The recipient enables the message to reach an individual running service with the additional ability to target a particular user or object. Services of a certain type are identified by a namespace, for example: web, ws, or worker. An integer is used for the node id, representing each running instance of a service type. 

For example, cipher messages to two different websocket services might be addressed with: {"ns":"ws","nid":0} and {"ns":"ws","nid":1}. Additionally, the tenent id can be used to address a particular user or object with: {"ns":"ws", "nid":0, "tid":"1234567890"}.


# A Conceptual Use Case

The current maintainer created a helpful [use case document](docs/USE_CASE.md) illustrating how cipher can be used to develop and deploy a multiplayer game: [docs/USE_CASE.md](docs/USE_CASE.md)


# Developer Notes

The current maintainer created some [notes](docs/NOTES.md) while preparing rapt-cipher for release: [docs/NOTES.md](docs/NOTES.md)


# Example Apps

See the chit-chat example web application (located in the examples directory), as well as the [README](examples/chit-chat/README.md). This basic examples demonstrates a simple cipher network featuring two web servers.


