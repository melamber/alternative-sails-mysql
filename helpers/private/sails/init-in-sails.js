module.exports = (datastores) => {
  if (sails) {
    sails.after('hook:orm:loaded', () => {
      const ADAPTER_NAME = 'alternative-sails-mysql';

      for (let i in datastores) {
        const source = datastores[i];

        if (source.config.adapter !== ADAPTER_NAME) {
          continue;
        }

        const alternative = datastores[source.config.alternative];

        if (alternative) {
          source.alternative = alternative;
        }
      }

      const originalGetDataStore = sails.getDatastore;

      sails.getDatastore = (name, sourceStore = null) => {
        const dataStore = originalGetDataStore(name);

        if (dataStore.config.adapter !== ADAPTER_NAME) {
          return dataStore;
        }

        const pool = dataStore.manager.pool;
        const allConnections = pool._allConnections;
        const allConnectionsLength = allConnections.length;
        const freeConnectionsLength = pool._freeConnections.length;
        const connectionLimit = pool.config.connectionLimit;

        if (allConnectionsLength < connectionLimit) {
          pool.getConnection((err, connection) => {
            if (!err && connection) {
              connection.release();
            }
          });
        }

        if (
          freeConnectionsLength > 0
          || (!dataStore.config.alternative && !sourceStore)
          || (sourceStore && dataStore.name === sourceStore.name)
        ) {
          return dataStore;
        }

        if (dataStore.config.alternative) {
          return sails.getDatastore(
            dataStore.config.alternative, sourceStore || dataStore
          );
        }

        const isSourceAvailable = sourceStore.manager.pool._allConnections.find(
          connection => connection.state !== 'disconnected'
        );

        if (!isSourceAvailable || !sourceStore) {
          return dataStore;
        }

        return sails.getDatastore(sourceStore.name, sourceStore);
      };
    });
  }
};
