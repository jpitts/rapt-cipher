
# Music Park - A Conceptual Multiplayer Game

A use case for cipher is to power a multiplayer game with thousands of simultaneous users. Let's call this fictional game "Music Park", a service that allows people to host music-listening events. It uses html5 client technology including websockets and webrtc, and runs on node.js, redis, and a sql database like postgres. The role of cipher and the underlying redis pub/sub service is to provide an internal message medium for the various components of Music Park, which altogether forms a microservice architecture.

# How Messages Are Used

As with many multiplayer games, the state of the Music Park changes quickly as users interact with it. For example, a user may select music to play in a listening room in which other users are present. This selection needs to immediately lead to an update to the room state (via postgres), to profiferate data to other users in the room (via websockets), and to be available to users entering the room in the near future. 

Messages are quickly passed between the running components of the system in the back-end, and to/from websocket clients connected to Music Park. This is accomplished by each service transmitting, broadcasting, and listening for messages on cipher handlers, which in turn interact with redis (accessible to the entire system). 

# Distributing Load

The components of this game, having different roles in the system, require different allocations of memory and CPU. So a handful of node.js microservices is running at any given time (on different kinds of servers), along with redis and postgres. For example, the web servers that processe logins and account updates are allocated a different memory and CPU allocation than the numerous websocket servers which each must maintain many simultaneous connections to clients. 
 
In order to expand and contract Music Park throughout the day (i.e. at peak times and low-usage times), the number of web and websocket servers can be increased or decreased. This sort of scaling and descaling does not disrupt cipher's internal messaging due to the use of namespace and node id to identify node.js instances.

# Aggregating and Processing Information

Using Cipher allows load to be distributed across web and websocket services, but it also allows for centralization. For example, game interaction messages received from clients might be passed onto a single, central worker running on a higher-capacity server. This worker is where the game state is continually maintained, and on each loop, it may receive or send messages out to clients about what has changed. 

# Use Case Summary

Cipher enables the developers of Music Park to build and run a real-time system by 1. controlling and distributing load and 2. facilitating process specialization.


