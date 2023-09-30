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
  const dataStoreConnectionLimit = dataStorePool.config.connectionLimit;
  const dataStoreAllConnectionsLength = dataStorePool._allConnections.length;
  const dataStorePossibleConnections = dataStoreConnectionLimit - dataStoreAllConnectionsLength;
  const dataStoreFreeConnectionsLength = dataStorePool._freeConnections.length;

  if (!dataStore.alternative
    || (dataStoreAllConnectionsLength < 1)
  ) {
    return dataStore;
  }

  const alternativeStorePool = dataStore.alternative.manager.pool;
  const alternativeStoreConnectionLimit = alternativeStorePool.config.connectionLimit;
  const alternativeStoreAllConnectionsLength = alternativeStorePool._allConnections.length;
  const alternativeStorePossibleConnections = alternativeStoreConnectionLimit - alternativeStoreAllConnectionsLength;
  const alternativeStoreFreeConnectionsLength = alternativeStorePool._freeConnections.length;

  if ((dataStorePossibleConnections > alternativeStorePossibleConnections)
    || (alternativeStorePossibleConnections <= 0 && (dataStoreFreeConnectionsLength >= alternativeStoreFreeConnectionsLength))
  ) {
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


