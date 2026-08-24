#!/bin/sh
set -e

npm run migrate
npm run seed
npm run seed -- --approve
npm run seed:invites

exec "$@"
