
# Developer Notes

Created while examining cipher in preparation for release.

SEE: [../lib/cipher.js](../lib/cipher.js)  

# Internals

Documents much of what is going on in the Cipher constructor as well as class methods.

## Cipher Instances

- a cipher instance is created using the constructor when the init function is called

- cipher is able to support multiple instances each with their own namespace/nid (not tested)

- getInstance({ namespace: 'web', nid: 0 }) returns the instance based on that namespace and nid

## Config

- passed to the init

- stored internally with _config

## namespace and nid

- identifies the service namespace and service node id for the instance receiving messages

- used in message recipient so that the message gets routed to the appropriate instance

## Redis Client Pool

- _outgoingClientPool array created in Cipher constructor
  used for redis PUBLISH and RPUSH

- _subscribeClientPool array created in Cipher constructor
  used for redis PUBSUBSCRIBE

- addToPool called according to config.poolSize

- in addToPool, Redis.createClient used to push to pool array

- outgoingClient returns a client instance from the pool

## Logging

- winston logger is created by default (can be overloaded on init with config.logger)

- log function calls winston.log by default (can be overloaded on init with config.log)

## Queue and Handlers

- addQueueListeners() is called to set up message processing for all clients in the pool
  
  - incoming messages processed by recvQueueMsg()
    (then the message would be BLPOP'd)
 
- _transmitHandlers hash will contain functions to handle incoming transmit messages

- _broadcastHandlers hash will contain functions to handle incoming broadcast messages


# Formats and Protocols

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

# Initialization

- the following parameters are passed to cipher on intiialization:

```js
  {
    namespace
    nid - node id, integer representing a node within the same namespace (e.g. web1, web2...)
    logger - winston instance
    log - function containing a custom call to the logger
    poolSize
    redis
      host
      port
      options
  }
```

- a cipher instance is returned by Cipher.init


# Broadcasting

- broadcasts are intended multiple recipients

- broadcasts can be sent to a group of recipients using a "room" or other construct


## Sending Broadcasts

- Cipher client sends a message via Cipher.broadcast

    - the following params are used: (route, payload, recipient, tid)

    - broadcast publishes a json-serialized message to the appropriate pubsub channel

    - redis PUBLISH is called with the fullRoute and serialized message
    SEE: http://redis.io/commands/publish

- broadcast messages use the following format and defaults:

```js
    msg.origin = cipher.getAddress(tid);

    msg.recipient = recipient || {}; // recipient may be entirely passed to the broadcast function
    msg.recipient.ns = msg.recipient.ns   || cipher._namespace;
    msg.recipient.nid = msg.recipient.nid || "*";
    msg.recipient.tid = msg.recipient.tid || "*";
    msg.recipient.r = [msg.recipient.ns, (route || "*")].join(".");

    msg.payload = payload || {};
```

- the fullRoute is a string joining the msg.recipient's namespace with the route
    e.g. "ws.world.add_user_to_location"

- broadcast occurs with a call to: outgoingClient().PUBLISH(fullRoute, cipher.serialize(msg));


## Receiving Broadcasts


- calling onBroadcast creates a pubsub channel

    - onBroadcast params: (name, handler, opts)

        name - used to form the pubsub route

        handler - broadcast handler function

        opts - none presently defined

    - the broadcast handler function is stored in the Cipher._broadcastHandlers hash
        keyed to route

    - route = namespace + '.' + name


- during Cipher construction, broadcasted messages are "subscribed to"

    - each Redis client in the pool subscribes to all messages in the Cipher._namespace

        subClient.PSUBSCRIBE(cipher._namespace.concat(".*"))

    - these incoming messages are then bound to Cipher.recvSubMsg

        subClient.on("pmessage", cipher.recvSubMsg.bind(cipher));

    SEE: http://redis.io/commands/psubscribe


- on receipt, a broadcast message is handled by: recvSubMsg(pattern, route, raw_msg)

    - first, a tenentHandler function is called

        - the tenentHandler must be defined in the application immediately after Cipher is constructed

        - this function facilitates the lookup of a record relating to the message
            the record can then be used in the broadcast handler

        - the payload.recipient in the raw_message is passed to the tenentHandler
            payload.recipient.tid is the id used in the record lookup

        - the tenentHandler callback function: function (err, tenent) { ... }

        SEE: sending broadcasts message recipient format

        To understand more about the "tenent" concept: http://en.wikipedia.org/wiki/Multitenancy

    - next, the appropriate broadcast handler function in Cipher._broadcastHandlers is called

        - params used in the final handler call: (origin, tenent, payload)


# Transmitting

- transmits are a one-time message to a single recipient


## Sending Transmits

- Cipher clients sends a message via Cipher.transmit

    - the following params are used: (route, payload, recipient, tid)

    - transmit pushes a json-serialized message to the appropriate queue

    - redis RPUSH is called with the fullRoute and serialized message
    
    SEE: http://redis.io/commands/RPUSH

- transmit messages use the following format:

```js
    msg.origin = cipher.getAddress(tid);

    msg.recipient = recipient || {}; // recipient may be entirely passed to the broadcast function
    msg.recipient.ns = msg.recipient.ns   || cipher._namespace;
    msg.recipient.nid = msg.recipient.nid || "*";
    msg.recipient.tid = msg.recipient.tid || "*";
    msg.recipient.r = [msg.recipient.ns, (route || "*")].join(".");

    msg.payload = payload || {};

```

- the fullRoute is a string joining the msg.recipient's namespace with the route
    e.g. "ws.world.add_user_to_location"

- the message will be removed from the queue even if the recipient cannot be "found"
    in the transmit handler function

- transmit occurs with a call to: outgoingClient().RPUSH(fullRoute, cipher.serialize(msg));


## Receiving Transmits

- calling onTransmit creates a pubsub channel

    - onTransmit params: (name, handler, opts)

        name - used to form the pubsub route

        handler - transmit handler function

        opts - none presently defined

    - route = namespace + '.' + name

    - the transmit handler function is stored in the Cipher._transmitHandlers hash
        keyed to "route"

- during Cipher construction, transmitted messages are "waited for"

    - each Redis client in the pool waits for queued messages in the Cipher._namespace

        this.addQueueListeners([this._namespace, "*"].join("."))

    - addQueueListeners params: (queueName)

    - incoming messages are bound to a one-time handler function onQueueMsg
        client.BLPOP(queueName, 0, onQueueMsg(queueName, client, this));

    - once a message is popped off the queue, it is handled by cipher.recvQueueMsg

    NOTE: this destroys the handle as it is one-time use.
        Therefore, the handler will later need to be re-bound to the queue.

    SEE: http://redis.io/commands/BLPOP and http://redis.io/commands/lpop

- on receipt, a transmitted message is handled by: recvQueueMsg (channel, msg)

    - first, a tenentHandler function is called

        - the tenentHandler must be defined in the application immediately after Cipher is constructed

        - this function facilitates the lookup of a record relating to the message
            the record can then be used in the transmit handler

        - the payload.recipient in the raw_message is passed to the tenentHandler
            payload.recipient.tid is the id used in the record lookup

        - the tenentHandler callback function: function (err, tenent) { ... }

        SEE: sending transmits message recipient format

        To understand more about the "tenent" concept: http://en.wikipedia.org/wiki/Multitenancy

    - next, the appropriate transmit handler function in Cipher._transmitHandlers is called

        params used in the final handler call: (origin, tenent, payload)

    - finally, the transmit handler function is re-bound to the one-time handler onQueueMsg

        client.BLPOP(name, 0, onQueueMsg(name, client, self));



