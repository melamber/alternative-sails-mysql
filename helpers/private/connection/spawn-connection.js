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
    const pool = dataStore.manager.pool;
    const allConnections = pool._allConnections;
    const allConnectionsLength = allConnections.length;
    const freeConnectionsLength = pool._freeConnections.length;

    if (!sourceStore) {
      sourceStore = dataStore;
    }

    if (allConnectionsLength < 1 || freeConnectionsLength > 0) {
      return dataStore;
    }

    if (!dataStore.alternative) {
      return sourceStore;
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
