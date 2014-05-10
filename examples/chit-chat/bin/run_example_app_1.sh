#!/usr/bin/env bash

BINDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $BINDIR

cd ../ && CIPHER_NS=www CIPHER_NID=1 node app.js

