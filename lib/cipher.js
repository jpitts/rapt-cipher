// Module config
////////////////////////////////////////////////////////////////////////////////

var Redis = require("redis"),
    Winston = require("winston")
;

var API = {};
var cipher_instances = {}; // allowing for multiple ciphers in one service

// init

API.init = function init(config) {
  
  /* attrs:
      namespace
      nid - node id, integer representing a node within the same namespace (e.g. web1, web2...)
      logger - winston instance
      log - function containing a custom call to the logger
      poolSize
      redis
        host
        port
        options
  */
  
  var cipher = cipher_instances[config.namespace + '-' + config.nid];
  
  // cipher already initiailized
  if (cipher) {
    return cipher.instance;

  // create a new instance with the passed config
  } else {

    cipher_instances[config.namespace + '-' + config.nid] = {
      instance: new Cipher(config),
      config: config
    };
    
    return cipher_instances[config.namespace + '-' + config.nid].instance;

  }

}


// getInstance

API.getInstance = function getInstance(config) {
  var cipher = cipher_instances[config.namespace + '-' + config.nid];
   
  if (!cipher) {
    console.error("The Cipher instance[" + config.namespace + '-' + config.nid + "] has not been initialized");
      
  } else {
    return cipher.instance;
  }

}


// Object definition
////////////////////////////////////////////////////////////////////////////////

var Cipher = function Cipher(config) {

  /* config:
      namespace
      nid - node id, integer representing a node within the same namespace (e.g. web1, web2...)
      logger - winston instance
      log - function containing a custom call to the logger
      poolSize
      redis
        host
        port
        options
  */

	// Make sure we have a valid config object
	this._config = config = (config || {});
	  
	// A pool of clients for outgoing requests
	this._outgoingClientPool = []

	// All clients listening to pub-sub channels
	this._subscribeClientPool = [];

	// All clients waiting via the BLPOP/BRPOP commands, namespaced by route name
	this._queueClientPools = {};

	// Auth to use if new clients are added
	this._auth = config.auth || {};

	// Connection config
	this._connection = config.connection || {}

	// Namespace to prefix on all message routes
	if(!config.namespace) {throw Error("No namespace provided!");}
	else {this._namespace = config.namespace}

	// Random id for node addressing
	//this._nid = Math.floor(Math.random()*9999999999);
	//this._nid = config.nid ? config.nid : Math.floor(Math.random()*9999999999); // allowing nid to be configured
	this._nid = config.nid ? config.nid : 0; // allowing nid to be configured with a default of 0

	// Logging
  // allow the winston instance to be passed to cipher
	if(!config.logger) {  
    this._logger = new (Winston.Logger) ({ });
    this._logger.add(Winston.transports.Console);
	} else {
    this._logger = config.logger;
  }
  // allow the log function to be passed to cipher
	if(!config.log) { 
    this._log = function (message, attr) {
      this._logger.log(attr.level, message, attr);
    }
  } else {
    this._log = config.log;
  }

	// Ensure there is a pool size (not that it means anything right now...)
	config.poolSize = (config.poolSize || 1);

	// Provision clients in the outgoing client pools
	var poolSize = config.poolSize;
	do {
		this.addToPool(this._outgoingClientPool);
	} while(--poolSize);
	
	// Provision clients for the pub/sub subscription
	poolSize = config.poolSize;
	do {
		var subClient = this.addToPool(this._subscribeClientPool);

		subClient.PSUBSCRIBE(this._namespace.concat(".*"))
		subClient.on("pmessage", this.recvSubMsg.bind(this));
	} while(--poolSize);

	// Add the two base queue listeners - REALLY NEED TO CLEAN THIS UP
	this.addQueueListeners([this._namespace, "*"].join("."));
	this.addQueueListeners([this._namespace, this._nid].join("."));

	// Transmit route handlers
	this._transmitHandlers = {};

	// Broadcast route handlers
	this._broadcastHandlers = {};

	// Log the address
	//console.log("Cipher is running at %s.%d", this._namespace, this._nid);
  this.log_info("Cipher is running at " + this._namespace + "." + this._nid, {});
}


// Helper functions
////////////////////////////////////////////////////////////////////////////////

Cipher.getInstance = API.getInstance;
Cipher.init = API.init;


Cipher.prototype.getAddress = function getAddress(tid) {
	return {ns: this._namespace, nid: this._nid, tid: tid || null};
}

// In case the serialization format changes
Cipher.prototype.deserialize = function deserialize(raw_msg) {
	return JSON.parse(raw_msg);
}

// In case the serialization format changes
Cipher.prototype.serialize = function serialize(json_msg) {
	return JSON.stringify(json_msg);
}


// Logging functions
///////////////////////////////////////////////////////////////////////////////

Cipher.prototype.log_start_block = function log_start_block (attr) {

  /* attrs:
      block
      classname
      subject_id
      append_message
      log_data
  */

  //console.log('modelrizerly.models.log_start_block ', attr);

  var log_message = "Called " + attr.block + '.';
  if (typeof attr.append_message !== 'undefined') {
    log_message = log_message + ': ' + attr.append_message;
  } else {
    log_message = log_message + '.';
  }

  return this.log_info(log_message, attr);

}

Cipher.prototype.log_info = function log_info (message, attr) { attr.level = 'info'; return this.log(message, attr); }
Cipher.prototype.log_warn = function log_warn (message, attr) {  attr.level = 'warn'; return this.log(message, attr); }
Cipher.prototype.log_error = function log_error (message, attr) { attr.level = 'error'; return this.log(message, attr); }

Cipher.prototype.log = function log (message, attr) {
   
  /* attrs:
      level
      block
      classname
      subject
      subject_id
      tracer_id
  */

  // defaults
  var level = (typeof attr.level !== 'undefined') ? attr.level : 'info';
  var tracer_id = (typeof attr.tracer_id !== 'undefined') ? attr.tracer_id : Math.floor(Math.random()*90000000) + 10000000;

  var log_data =  {
    level: attr.level,
    module: 'cipher',
    classname: attr.classname,
    block: attr.block,
    subject: attr.subject,
    subject_id: attr.subject_id,
    tracer_id: tracer_id,
    log_data: attr.log_data
  };

  this._log(message, log_data);

  return {tracer_id:tracer_id, block:attr.block };

}


// Message processing
////////////////////////////////////////////////////////////////////////////////

// Handles the lookup of the correct 'tenent' based on the incoming message 
Cipher.prototype.tenentHandler = function tenentHandler(attr) {
  //console.error(attr);
	throw Error("User has not overridden the default 'tenentHandler'");
}


// Sends out a broadcasted message
Cipher.prototype.broadcast = function broadcast(route, payload, recipient, tid)
{
	var msg = {};

	msg.origin = this.getAddress(tid);

	msg.recipient = recipient || {};
	msg.recipient.ns = msg.recipient.ns	  || this._namespace;
	msg.recipient.nid = msg.recipient.nid || "*";
	msg.recipient.tid = msg.recipient.tid || "*";
	msg.recipient.r = [msg.recipient.ns, (route || "*")].join(".");
	
	msg.payload = payload || {};
	
	var fullRoute = [msg.recipient.ns, route].join(".");
	//var fullRoute = [msg.recipient.ns, msg.recipient.nid, route].join("."); // allowing for multiple servers

  //console.log("Cipher.broadcast: Publishing message on channel '%s'", fullRoute);
  this.log_info("Cipher.broadcast: Publishing message on channel " + fullRoute, {});
  
  this.outgoingClient().PUBLISH(fullRoute, this.serialize(msg));
}


// Sends out a direct transmission
Cipher.prototype.transmit = function transmit(route, payload, recipient, tid) {
	var msg = {};

	msg.origin = this.getAddress(tid);

	msg.recipient = recipient || {};
	msg.recipient.ns = msg.recipient.ns	  || this._namespace;
	msg.recipient.nid = msg.recipient.nid || "*";
	msg.recipient.tid = msg.recipient.tid || "*";
	msg.recipient.r = [msg.recipient.ns, (route || "*")].join(".");
	
	msg.payload = payload || {};

	var fullRoute = [msg.recipient.ns, msg.recipient.nid].join(".");
	
	//console.log("Cipher.transmit: Pushing msg for recipient " + recipient.tid + " onto queue " + fullRoute);
  this.log_info("Cipher.transmit: Pushing msg for recipient " + recipient.tid + " onto queue " + fullRoute, {});

	this.outgoingClient().RPUSH(fullRoute, this.serialize(msg));
}


// Handler for all messages received via a pub_sub channel
Cipher.prototype.recvSubMsg = function recvPubSubMsg(pattern, route, raw_msg) {
	var self = this;

	try {	
		var json_msg = this.deserialize(raw_msg)
			, origin = json_msg.origin
			, payload = json_msg.payload 
	} catch (e) {
		//console.log("Malformed subscription message");
		//return console.log(e, raw_msg);
    self.log_error("Malformed subscription message on route " + route, {});
    return;
	}

	// Possibly an async call to grab the tenent
	this.tenentHandler(json_msg.recipient, function(err, tenent) {
	
		// In the clear! Lets process the message.
		if(self._broadcastHandlers[route]) {
			self._broadcastHandlers[route](origin, tenent, payload);
		} else {
			//console.log("No handler for message", route, json_msg);
		}
	});
}

Cipher.prototype.recvQueueMsg = function recvQueueMsg(channel, msg) {
	var self = this;

	try {	
		// The msg object is an array ['queueName', 'data']
		var raw_msg = msg.pop()
			, json_msg = this.deserialize(raw_msg)
			, origin = json_msg.origin
			, payload = json_msg.payload 
			, route = json_msg.recipient.r

		// This standardizes the object sent to tenentHandler
		delete json_msg.recipient.r;
		
	} catch (e) {
		//console.log("Malformed queue message");
		//return console.log(e, raw_msg);
    self.log_error("Malformed queue message on channel " + channel, {});

	}
	
	// Possibly an async call to grab the tenent
	this.tenentHandler(json_msg.recipient, function(err, tenent) {
	
		// In the clear! Lets process the message.
		if(self._transmitHandlers[route]) {
			self._transmitHandlers[route](origin, tenent, payload);
		} else {
			//console.log("No handler for message", route, json_msg);
		}
	});
}


// Registers handles on specific broadcast routes
Cipher.prototype.onBroadcast = function onBroadcast(name, handler, opts) {
	if(this._broadcastHandlers[name]) {
		throw Error("Handler already registered for broadcast route '"+name+"'");
	}
	
	// Ensure we have an options object
	opts = opts || {};

	// Build the full name for the route
	name = [(opts.namespace||this._namespace), name].join(".");
	//name = [(opts.namespace||this._namespace), this.getAddress().nid, name].join("."); // allowing for multiple servers

	// Add the handler to the object
	this._broadcastHandlers[name] = handler;
	//console.log("Cipher.onBroadcast: Broadcast handler attached for %s on instance %s", name, this._namespace);

  this.log_info("Cipher.onBroadcast: Broadcast handler attached for " + name + " on instance " + this._namespace + "-" + this._nid, {});

}


// Adds a handler for transmit-type messages and creates clients 
// that will wait for messages in that queue
Cipher.prototype.onTransmit = function onTransmit(name, handler, opts) {
	if(this._transmitHandlers[name]) {
		throw Error("Handler already registered for transmit route '"+name+"'");
	}

	// Ensure we have an options object
	opts = opts || {};

	// Build the full name for the route
	name = [(opts.namespace||this._namespace), name].join(".");

	// Add the handler to the object
	this._transmitHandlers[name] = handler;
	//console.log("Cipher.onTransmit: Transmit handler attached for %s on instance %s", name, this._namespace);

  this.log_info("Cipher.onTransmit: Transmit handler attached for " + name + " on instance " + this._namespace + "-" + this._nid, {});


}

// Internal functionalitiy
////////////////////////////////////////////////////////////////////////////////

// Roundrobin cycles the clients, in the event that more are added
Cipher.prototype.outgoingClient = function outgoingClient() {
	var client; this._outgoingClientPool.push(client = this._outgoingClientPool.shift());
	return client;
}


Cipher.prototype.addQueueListeners = function addQueueListeners(queueName) {
	var poolSize = this._config.poolSize; 
	do {
	
		// Ensure that the pool exists
		if(!this._queueClientPools[queueName]) {this._queueClientPools[queueName] = [];}
		
		// Add a new client and make it wait for messages on the queue
		var client = this.addToPool(this._queueClientPools[queueName])
		client.BLPOP(queueName, 0, onQueueMsg(queueName, client, this));

		function onQueueMsg(name, client, self)
		{
			return function(channel, msg) 
			{
				self.recvQueueMsg(channel, msg);
				client.BLPOP(name, 0, onQueueMsg(name, client, self));
			}
		}

	} while(--poolSize);
}


// Adds a new client and authorizes it if necessary
Cipher.prototype.addToPool = function addToPool(pool) {

	// Create the client
	var con = this._connection
		//, client = Redis.createClient(con.port||6379, con.host||"127.0.0.1", con.options||{})
      cfg_data = this._config
		, client = Redis.createClient( con.port || cfg_data.redis.port, con.host || cfg_data.redis.host, con.options || cfg_data.redis.options)

	// Attempt to auth the client if requested
	if(this._auth.pass) {
		client.auth(auth.pass||"", cbAuth);
	}

	// Add the client to the pool and return it
	pool.push(client);
	return client;

	// Callback for the connection stage
	function cbReady(err, result) {
		//console.log(err, result);
    this.log_info("Cipher.addToPool cbReady", {});
	}

	// Callback for any errors
	function cbError(err, result) {
		//console.log(err, result);
    this.log_info("Cipher.addToPool cbError: " + err, {});
	}	

	// Callback for the auth stage
	function cb(err, result) {
		//console.log(err, result);
    this.log_info("Cipher.addToPool cb (auth stage)", {});
	}
}

module.exports = Cipher;

