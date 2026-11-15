'use strict';
const { ensureLocalDatabase } = require('./ensure-db');

async function seedAdmin() {
  await ensureLocalDatabase();
}

module.exports = seedAdmin;
