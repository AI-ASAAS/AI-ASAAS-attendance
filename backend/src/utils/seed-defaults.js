'use strict';
require('dotenv').config();
const db = require('../config/database');
const security = require('../services/session-security');

async function seed() {
  try {
    // 1. Insert default shift if none exists
    let shift = (await db.query('SELECT * FROM shifts LIMIT 1')).rows[0];
    if (!shift) {
      const res = await db.query(
        'INSERT INTO shifts(name, start_time, end_time, work_days, grace_minutes, close_policy, deduct_away) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        ['الدوام الرسمي العام', '00:00', '23:59', [0,1,2,3,4,5,6], 60, 'actual_exit', false]
      );
      shift = res.rows[0];
      console.log('Created default shift:', shift.id, shift.name);
    } else {
      console.log('Existing shift found:', shift.id, shift.name);
    }

    // 2. Ensure branch 1 exists and is active
    let branch = (await db.query('SELECT * FROM branches WHERE id=1')).rows[0];
    if (branch) {
      await db.query('UPDATE branches SET active=true WHERE id=1');
      console.log('Branch 1 is active:', branch.name);
    }

    // 3. Update admin account to link to branch 1 and shift
    await db.query('UPDATE accounts SET branch_id=1, shift_id=$1 WHERE id=1', [shift.id]);
    console.log('Admin account linked to branch 1 and shift', shift.id);

    // 4. Create demo employee account if not exists
    const existingEmp = (await db.query("SELECT * FROM accounts WHERE identifier='emp1'")).rows[0];
    if (!existingEmp) {
      const hash = await security.hashPassword('AsasEmployee@2026');
      const newEmp = await db.query(
        'INSERT INTO accounts(identifier, name, password_hash, role, branch_id, shift_id, permissions, active) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, identifier, name',
        ['emp1', 'أحمد الموظف', hash, 'employee', 1, shift.id, [], true]
      );
      console.log('Created demo employee account:', newEmp.rows[0]);
    } else {
      console.log('Employee emp1 already exists');
    }

    console.log('Seed completed successfully!');
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await db.pool.end();
  }
}

seed();
