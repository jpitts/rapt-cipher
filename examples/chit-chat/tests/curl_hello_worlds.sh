#!/usr/bin/env bash

echo "Testing time...
"


if curl -s --head http://localhost:8080 | grep "200 OK" > /dev/null
    then
        echo "www-0 is up
"
    else
        echo "www-0 is not running!"
        exit 0
fi

if curl -s --head http://localhost:8081 | grep "200 OK" > /dev/null
    then
        echo "www-1 is up
"
    else
        echo "www-1 is not running!"
        exit 0
fi



echo "Check messages on www-0
"
curl 'http://localhost:8080/api/messages'
echo "
"

echo "Check messages on www-1
"
curl 'http://localhost:8081/api/messages'
echo "
"

echo "Sending message fron www-0 to www-1
"

curl -X POST \
-H "Content-Type: application/json" \
-d '{ "message":"Hello, One!", "namespace":"www", "nid":1 }' \
'http://localhost:8080/api/say_hello'

echo "
"
sleep 1

echo "Check messages on www-1
"
curl 'http://localhost:8081/api/messages'
echo "
"

echo "Sending message from www-1 to www-0
"

curl -X POST \
-H "Content-Type: application/json" \
-d '{ "message":"Hello, Zero!", "namespace":"www", "nid":0 }' \
'http://localhost:8081/api/say_hello'

echo "
"
sleep 1

echo "Check messages on www-0
"
curl 'http://localhost:8080/api/messages'
echo "
"

echo "Done!
"

