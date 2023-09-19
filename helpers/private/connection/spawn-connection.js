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
  const chooseDataStore = (dataStore) => {
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

    console.log(JSON.stringify({
      event: 'sql_alternative',
      alternative: !(dataStoreFreeConnectionsLength >= alternativeStoreFreeConnectionsLength
        || (
          (alternativeStoreAllConnectionsLength - alternativeStoreFreeConnectionsLength)
          >= alternativeStoreConnectionLimit
        )),
    }));

    if (dataStoreFreeConnectionsLength >= alternativeStoreFreeConnectionsLength
      || (
        (alternativeStoreAllConnectionsLength - alternativeStoreFreeConnectionsLength)
        >= alternativeStoreConnectionLimit
      )) {
      return dataStore;
    }

    try {
      const alternative = {
        ...dataStore.alternative,
        sourceDataStore: dataStore,
      };

      return chooseDataStore(alternative);
    } catch (error) {
      console.log(JSON.stringify({
        event: 'sql_caught',
        error: error.message,
      }));
    }
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
          console.error(JSON.stringify({
            event: 'sql_error',
            err: err.message,
          }));

          return cb(err);
        },
        failed(err) {
          console.error(JSON.stringify({
            event: 'sql_failed',
            err: err.message,
          }));
          if (dataStore.alternative) {
            return getConnection(dataStore.alternative, cb);
          }

          if (dataStore.sourceDataStore) {
            console.log(JSON.stringify({
              event: 'sql_source',
            }));
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
  };
  const dataStore = chooseDataStore(datastore);

  return getConnection(dataStore, (err, conn) => {
    if (err) {
      console.log(JSON.stringify({
        event: 'sql_connection_error',
        err: err.message,
      }));
      if  (!Object.is(dataStore, datastore)) {
        return getConnection(datastore, cb);
      } else {
        return cb(err);
      }
    }

    cb(null, conn);
  });
};
