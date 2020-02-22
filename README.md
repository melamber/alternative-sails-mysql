# Alternative-Sails-MySQL Adapter

Alternative MySQL adapter for the Sails framework and Waterline ORM.
This is fork of original [sails-mysql](https://github.com/balderdashy/sails-mysql) driver.
This adapter can be used for replicas connections. It does not use real pool for replicas.
It uses logic on top level code for switching between mysql instances.
Adapter supports load balancing and alternative connections fot failure cases.



## Installation

Install from NPM.

```bash
# In your app:
$ npm install alternative-sails-mysql
```

## Usage
Use additional param `alternative` to specify alternative connection for load balancing and failure cases of the main connection. 
Param `alternative` takes string with alternative connection name.


Example of configuration:
```javascript
datastores: {
  default: {
    adapter: 'alternative-sails-mysql',
    user: 'user',
    password: 'password',
    database: 'database',
    socketPath: 'socketPath',
    alternative: 'defaultAlternative',
  },
  defaultAlternative: {
    adapter: 'alternative-sails-mysql',
    user: 'user',
    password: 'password',
    database: 'defaultAlternative',
    socketPath: 'socketPath',
  }
}
```

#### Running the tests

To run the tests, point this adapter at your database by specifying a [connection URL](http://sailsjs.com/documentation/reference/configuration/sails-config-datastores#?the-connection-url) and run `npm test`:

```
WATERLINE_ADAPTER_TESTS_URL=mysql://root:myc00lP4ssw0rD@localhost/adapter_tests npm test
```

> For more info, see [**Reference > Configuration > sails.config.datastores > The connection URL**](http://sailsjs.com/documentation/reference/configuration/sails-config-datastores#?the-connection-url), or [ask for help](http://sailsjs.com/support).

## License

This adapter, like the [Sails framework](http://sailsjs.com) is free and open-source under the [MIT License](http://sailsjs.com/license).

