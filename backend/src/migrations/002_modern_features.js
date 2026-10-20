'use strict';
const db = require('../config/database');

async function migrate() {
  console.log('Running database migration for Asas Modern Features...');
  
  // 1. Add avatar to accounts if missing
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS avatar TEXT;`);
  
  // 2. Create announcements table
  await db.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      priority VARCHAR(20) DEFAULT 'normal',
      sender_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
      sender_name VARCHAR(150),
      send_email BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      active BOOLEAN DEFAULT TRUE
    );
  `);

  // 3. Populate default system settings
  await db.query(`
    INSERT INTO system_settings(key, value, updated_at)
    VALUES 
      ('company_name', 'شركة أساس الذكاء الاصطناعي (AI-ASAAS)', NOW()),
      ('timezone', 'Asia/Aden', NOW()),
      ('max_gps_accuracy', '250', NOW()),
      ('email_notifications', 'true', NOW()),
      ('support_contact', '+967 770000000', NOW())
    ON CONFLICT (key) DO NOTHING;
  `);

  console.log('Migration completed successfully!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
