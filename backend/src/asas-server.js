require('dotenv').config();
const db=require('./config/database');
const app=require('./secure-app');
const {closeScheduled}=require('./services/duty-maintenance');
async function start(){
 if(!process.env.DATABASE_URL||!process.env.QR_SECRET||process.env.QR_SECRET.length<32||process.env.QR_SECRET.startsWith('REPLACE_'))throw new Error('Set DATABASE_URL and a random QR_SECRET (32+ characters).');
 await db.query('SELECT 1 FROM accounts LIMIT 1');
 const timer=setInterval(()=>closeScheduled().catch(e=>console.error('Scheduled closure failed:',e.message)),30000);timer.unref();
 const server=app.listen(Number(process.env.PORT||5000),process.env.HOST||'127.0.0.1',()=>console.log('ASAS API ready'));
 const stop=()=>{clearInterval(timer);server.close(()=>db.pool.end().then(()=>process.exit(0)));};
 process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
start().catch(e=>{console.error(e.message);process.exit(1);});
