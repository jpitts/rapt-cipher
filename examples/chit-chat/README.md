# Cipher Chit-Chat Demo

An example web app that demonstrates message-passing between two node.js web servers.

## Structure

app.js defines a web server with a cipherer listening and potentially transmitting messages. The namespace and nid are set in the node.js environment using CIPHER_NS and CIPHER_NID. This web server has an API which can be used to send and list messages for that namespace and nid.

apps_in_a_cipher.js runs two instances of app.js using forever-monitor, idenfified to cipher as web-0 and web-1.

tests/curl_hello_worlds.sh contains a series of curls which interact with web nodes 0 and 1.

## Setting up the Demo
    
Cipher requires node.js and redis to be installed and configured. To run the simple, bash-based test, curl is required.

Install the node.js dependencies:

  npm install

Fire up the web servers:

  node apps_in_a_cipher.js
 
In a separate shell, fire up the test calls.

  ./tests/curl_hello_worlds.sh

