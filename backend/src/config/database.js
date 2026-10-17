const { Pool } = require('pg');
const pool = new Pool({ connectionString:process.env.DATABASE_URL,
  ssl:process.env.DB_SSL==='true'?{rejectUnauthorized:true}:false,
  max:10,idleTimeoutMillis:30000,connectionTimeoutMillis:5000 });
async function transaction(work){
 const client=await pool.connect();
 try{await client.query('BEGIN');const value=await work(client);await client.query('COMMIT');return value;}
 catch(error){await client.query('ROLLBACK');throw error;}
 finally{client.release();}
}
module.exports={query:(sql,args)=>pool.query(sql,args),pool,transaction};
