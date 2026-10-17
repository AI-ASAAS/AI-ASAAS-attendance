const db=require('../config/database');
async function closeScheduled(){
 return db.transaction(async client=>{
  const {rows}=await client.query("SELECT * FROM duty_records WHERE state<>'closed' AND close_policy='scheduled' AND shift_end<=NOW() FOR UPDATE SKIP LOCKED");
  for(const record of rows){
   await client.query("UPDATE duty_records SET state='closed',last_out=CASE WHEN state='inside' THEN shift_end ELSE last_out END,exit_reason=CASE WHEN state='inside' THEN 'scheduled' ELSE exit_reason END,exit_candidate=NULL WHERE id=$1",[record.id]);
   await client.query("INSERT INTO attendance_events(record_id,employee_id,kind,details) VALUES($1,$2,'scheduled_close',$3)",[record.id,record.employee_id,JSON.stringify({effective_at:record.shift_end})]);
  }
 });
}
module.exports={closeScheduled};
