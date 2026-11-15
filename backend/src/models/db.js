'use strict';

/**
 * AI-ASAAS Database Access Layer
 * Delegates all queries to SQLite database engine in config/database.js
 * Retains full backward compatibility with pool.query(sql, params) and pool.end()
 */
const db = require('../config/database');

module.exports = {
  query: (text, params) => db.query(text, params),
  transaction: (fn) => db.transaction(fn),
  pool: db.pool,
  getDbPath: db.getDbPath,
  backupTo: db.backupTo,
};

