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


module.exports = function spawnConnection(datastore, cb) {
  const chooseDataStore = (dataStore, sourceStore = null) => {
    const dataStorePool = dataStore.manager.pool;
    const dataStoreConnectionLimit = dataStorePool.config.connectionLimit;
    const dataStoreAllConnections = dataStorePool._allConnections;
    const dataStoreAllConnectionsLength = dataStoreAllConnections.length;
    const dataStoreFreeConnectionsLength = dataStorePool._freeConnections.length;

    if (!sourceStore) {
      sourceStore = dataStore;
    }

    if (!dataStore.alternative) {
      return sourceStore;
    }

    if (dataStoreAllConnectionsLength < 1) {
      return dataStore;
    }

    const alternativeStorePool = dataStore.alternative.manager.pool;
    const alternativeStoreConnectionLimit = alternativeStorePool.config.connectionLimit;
    const alternativeStoreFreeConnectionsLength = alternativeStorePool._freeConnections.length;
    const dataStoreCapacityPercentage = (dataStoreConnectionLimit - dataStoreFreeConnectionsLength)
      / dataStoreConnectionLimit;
    const alternativeStoreCapacityPercentage = (alternativeStoreConnectionLimit - alternativeStoreFreeConnectionsLength)
      / alternativeStoreConnectionLimit;

    if (dataStoreCapacityPercentage >= alternativeStoreCapacityPercentage) {
      return dataStore;
    }

    return chooseDataStore(dataStore.alternative, sourceStore);
  };
  const getConnection = (dataStore, cb) => {
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
          if (dataStore.alternative) {
            return getConnection(dataStore.alternative, cb);
          }

          return cb(err);
        },
        success(connection) {
          return cb(null, connection.connection);
        }
      });
  };
  const dataStore = chooseDataStore(datastore);

  return getConnection(dataStore, (err, conn) => {
    if (err) {
      if  (!Object.is(dataStore, datastore)) {
        return getConnection(datastore, cb);
      } else {
        return cb(err);
      }
    }

    cb(null, conn);
  });
};
