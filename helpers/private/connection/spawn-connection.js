//  ███████╗██████╗  █████╗ ██╗    ██╗███╗   ██╗
//  ██╔════╝██╔══██╗██╔══██╗██║    ██║████╗  ██║
//  ███████╗██████╔╝███████║██║ █╗ ██║██╔██╗ ██║
//  ╚════██║██╔═══╝ ██╔══██║██║███╗██║██║╚██╗██║
//  ███████║██║     ██║  ██║╚███╔███╔╝██║ ╚████║
//  ╚══════╝╚═╝     ╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝  ╚═══╝
//
//   ██████╗ ██████╗ ███╗   ██╗███╗   ██╗███████╗ ██████╗████████╗██╗ ██████╗ ███╗   ██╗
//  ██╔════╝██╔═══██╗████╗  ██║████╗  ██║██╔════╝██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║
//  ██║     ██║   ██║██╔██╗ ██║██╔██╗ ██║█████╗  ██║        ██║   ██║██║   ██║██╔██╗ ██║
//  ██║     ██║   ██║██║╚██╗██║██║╚██╗██║██╔══╝  ██║        ██║   ██║██║   ██║██║╚██╗██║
//  ╚██████╗╚██████╔╝██║ ╚████║██║ ╚████║███████╗╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║
//   ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═══╝╚══════╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
//
// Instantiate a new connection from the connection manager.

var MySQL = require('machinepack-mysql');

function chooseDataStore(dataStore) {
  const dataStorePool = dataStore.manager.pool;
  const dataStoreAllConnectionsLength = dataStorePool._allConnections.length;
  const dataStoreFreeConnectionsLength = dataStorePool._freeConnections.length;

  if (!dataStore.alternative || dataStoreAllConnectionsLength < 1) {
    return dataStore;
  }

  const alternativeStorePool = dataStore.alternative.manager.pool;
  const alternativeStoreConnectionLimit = alternativeStorePool.config.connectionLimit;
  const alternativeStoreAllConnectionsLength = alternativeStorePool._allConnections.length;
  const alternativeStoreFreeConnectionsLength = alternativeStorePool._freeConnections.length;

  if (dataStoreFreeConnectionsLength >= alternativeStoreFreeConnectionsLength
    || (
      (alternativeStoreAllConnectionsLength - alternativeStoreFreeConnectionsLength)
      >= alternativeStoreConnectionLimit
    )) {
    return dataStore;
  }

  const alternative = {
    ...dataStore.alternative,
    sourceDataStore: dataStore,
  };

  return chooseDataStore(alternative);
}

function getConnection(dataStore, cb) {
  // Validate datastore
  if (!dataStore || !dataStore.manager || !dataStore.config) {
    return cb(new Error('Spawn Connection requires a valid datastore.'));
  }

  console.log({
    event: 'sql_identity',
    identity: dataStore.config.identity,
  });

  MySQL.getConnection({
    manager: dataStore.manager,
    meta: dataStore.config
  })
    .switch({
      error(err) {
        return cb(err);
      },
      failed(err) {
        // failed to connect
        console.error(JSON.stringify({
          event: 'sql_failed',
          err: err.message,
        }));
        if (dataStore.alternative) {
          return getConnection(dataStore.alternative, cb);
        }

        if (dataStore.sourceDataStore) {
          return getConnection({
            ...dataStore.sourceDataStore,
            alternative: undefined,
          }, cb);
        }

        return cb(err);
      },
      success(connection) {
        return cb(null, connection.connection);
      }
    });
}

function spawnConnection(datastore, cb) {
  const dataStore = chooseDataStore(datastore);

  return getConnection(dataStore, cb);
}

module.exports = spawnConnection;


