require('dotenv').config();
const fs=require('node:fs');
const path=require('node:path');
const db=require('../config/database');
const {hashPassword}=require('../services/session-security');
async function main(){
 if(!process.env.SETUP_ADMIN_PASSWORD||!process.env.SETUP_ADMIN_IDENTIFIER) throw new Error('Set SETUP_ADMIN_IDENTIFIER and SETUP_ADMIN_PASSWORD (12+ chars) in your environment for this one-time setup.');
 const hash=await hashPassword(process.env.SETUP_ADMIN_PASSWORD);
 await db.transaction(async client=>{
  await client.query(fs.readFileSync(path.join(__dirname,'../../../database/asas-schema.sql'),'utf8'));
  const existing=await client.query("SELECT id FROM accounts WHERE role='super_admin'");
  if(existing.rows.length) throw new Error('An administrator already exists; setup will not change existing accounts.');
  await client.query("INSERT INTO accounts(identifier,name,password_hash,role) VALUES($1,$2,$3,'super_admin')",[process.env.SETUP_ADMIN_IDENTIFIER,'مدير أساس',hash]);
 });
 console.log('ASAS schema and administrator created. No demo users or locations were inserted.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.pool.end());
