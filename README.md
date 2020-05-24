# Apollo Server SQL Cache driver

[![npm version](https://badge.fury.io/js/apollo-server-cache-sql.svg)](https://badge.fury.io/js/apollo-server-cache-sql)
![Build and Deploy](https://github.com/MatissJanis/apollo-server-cache-sql/workflows/Build%20and%20Deploy/badge.svg)
[![codecov](https://codecov.io/gh/MatissJanis/apollo-server-cache-sql/branch/master/graph/badge.svg)](https://codecov.io/gh/MatissJanis/apollo-server-cache-sql)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

Minimalistic Apollo Server SQL Cache driver for times when [Redis](https://github.com/apollographql/apollo-server/blob/master/packages/apollo-server-cache-redis) or other more modern caching solutions are too expensive or unavailable.

## Installing

```sh
npm install --save-dev apollo-server-cache-sql
# or
yarn add -D apollo-server-cache-sql
```

## Setup

A SQL table for cache artifact storage must be created. The following is a blueprint for a basic caching table.

```sql
CREATE TABLE `cache` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `key` varchar(255) DEFAULT NULL,
  `value` longtext,
  `ttl` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;
```

## Usage

```js
import mysql from 'mysql';
import { SqlCache } from 'apollo-server-cache-sql';

// Setup the connection client
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'me',
  password: 'secret',
  database: 'my_db',
});
connection.connect();

// Setup Apollo Server with SQL cache driver
const server = new ApolloServer({
  typeDefs,
  resolvers,
  cache: new SqlCache({
    client: connection,
    databaseName: 'my_db',
    tableName: 'cache',
  }),
  dataSources: () => ({
    moviesAPI: new MoviesAPI(),
  }),
});
```

### Usage with full-query caching

```js
import mysql from 'mysql';
import { SqlCache } from 'apollo-server-cache-sql';
import responseCachePlugin from 'apollo-server-plugin-response-cache';

// Setup the connection client
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'me',
  password: 'secret',
  database: 'my_db',
});
connection.connect();

// Setup Apollo Server with SQL cache driver
const server = new ApolloServer({
  // ...
  plugins: [
    responseCachePlugin({
      cache: new SqlCache({
        client: connection,
        databaseName: 'my_db',
        tableName: 'cache',
      }),
    }),
  ],
});
```
