const express=require('express');
const helmet=require('helmet');
const cors=require('cors');
const rateLimit=require('express-rate-limit');
const db=require('./config/database');
const {AppError}=require('./utils/AppError');
const security=require('./services/session-security');
const policy=require('./services/attendance-policy');
const {closeScheduled}=require('./services/duty-maintenance');
const notifications=require('./services/notification.service');
const app=express();
app.set('trust proxy', 1);
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const error=(code,message,status=400)=>{throw new AppError(code,message,status);};
const origin=()=>process.env.WEB_ORIGIN||'http://localhost:3000';
const isAllowedOrigin=(orig)=>{
 if(!orig) return true;
 const configured=(process.env.WEB_ORIGIN||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(configured.includes('*')||process.env.NODE_ENV!=='production') return true;
 if(configured.includes(orig)||orig===origin()) return true;
 if(orig==='http://localhost:3000'||orig==='http://127.0.0.1:3000') return true;
 if(orig.endsWith('.trycloudflare.com')||orig.endsWith('.loca.lt')||orig.endsWith('.vercel.app')) return true;
 return false;
};
const string=(value,max=150)=>{if(typeof value!=='string'||!value.trim()||value.length>max)error('VALIDATION','تحقق من الحقول المطلوبة');return value.trim();};
const integer=(value,min,max)=>{if(!Number.isInteger(value)||value<min||value>max)error('VALIDATION','قيمة رقمية خارج الحدود');return value;};
const id=value=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<1)error('VALIDATION','معرف غير صالح');return n;};
const bool=value=>{if(typeof value!=='boolean')error('VALIDATION','قيمة اختيار غير صالحة');return value;};
const safeAccount=a=>{const {password_hash,...safe}=a;return safe;};
const permission=(user,p)=>user.role==='super_admin'||user.permissions.includes(p);
const scope=(user,branch)=>{if(user.role!=='super_admin'&&user.role!=='hr_admin'&&user.branch_id!==Number(branch))error('FORBIDDEN','هذا الفرع خارج صلاحيتك',403);};
const admin=(req,res,next)=>{if(req.user.role==='employee')return next(new AppError('FORBIDDEN','هذه الصفحة للإدارة',403));next();};
const allow=p=>(req,res,next)=>{if(!permission(req.user,p))return next(new AppError('FORBIDDEN','لا تملك صلاحية هذا الإجراء',403));next();};
const audit=(client,user,action,target,reason,details={})=>client.query('INSERT INTO audit_log(actor_id,action,target,reason,details) VALUES($1,$2,$3,$4,$5)',[user.id,action,String(target),reason,JSON.stringify(details)]);
const respond=(res,data)=>res.json({success:true,data});
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({origin:(orig,cb)=>cb(null,isAllowedOrigin(orig)),credentials:true}));
app.use(express.json({limit:'64kb'}));
const path=require('node:path');
app.use(express.static(path.join(__dirname,'../public')));
app.use(rateLimit({windowMs:60000,max:300,standardHeaders:true,legacyHeaders:false}));
app.use((req,res,next)=>{
 res.set('Cache-Control','no-store');
 if(!['GET','HEAD','OPTIONS'].includes(req.method)){
  const hasBody = Boolean(req.headers['content-length'] && req.headers['content-length'] !== '0');
  if(['POST','PUT','PATCH'].includes(req.method) || (hasBody && req.method !== 'DELETE')){
   if(!req.is('application/json'))return next(new AppError('CONTENT_TYPE','يلزم JSON',415));
  }
  if(req.headers.origin && !isAllowedOrigin(req.headers.origin))return next(new AppError('ORIGIN','مصدر الطلب غير مسموح',403));
  // Browser requests require an Origin; Android uses Authorization, including login protocol.
  if(!req.headers.origin&&!req.headers.authorization&&req.headers['x-asas-client']!=='android')return next(new AppError('ORIGIN','مصدر الطلب مفقود',403));
 }
 next();
});
app.get('/health',wrap(async(req,res)=>{await db.query('SELECT 1');respond(res,{service:'أساس',status:'ready'});}));
app.post('/api/auth/login',rateLimit({windowMs:900000,max:20,standardHeaders:true,legacyHeaders:false}),wrap(async(req,res)=>{
 const identifier=string(req.body.identifier,100), password=req.body.password;
 if(typeof password!=='string'||password.length>128)error('LOGIN','بيانات الدخول غير صحيحة',401);
 const result=await db.query('SELECT * FROM accounts WHERE (identifier=$1 OR LOWER(email)=LOWER($1)) AND active=TRUE',[identifier]);
 const account=result.rows[0];
 const dummy='scrypt:00000000000000000000000000000000:'+ '00'.repeat(64);
 const valid=await security.verifyPassword(password,account?.password_hash||dummy);
 if(!account||!valid)error('LOGIN','بيانات الدخول غير صحيحة',401);

 const deviceId=req.body.device_id?String(req.body.device_id).trim():null;
 const deviceName=req.body.device_name?String(req.body.device_name).trim().slice(0,150):null;
 const phone=req.body.phone?String(req.body.phone).trim().slice(0,50):null;

 if(account.role==='employee'&&deviceId){
  const other=(await db.query('SELECT id, name FROM accounts WHERE bound_device_id=$1 AND id<>$2',[deviceId,account.id])).rows;
  if(other.length)error('DEVICE_BOUND_OTHER',`هذا الجوال مقترن بالموظف (${other[0].name}). لا يمكن استخدام نفس الجوال لأكثر من موظف منعاً للتحضير بالنيابة.`,403);
  if(account.bound_device_id&&account.bound_device_id!==deviceId){
   error('DEVICE_MISMATCH',`حسابك مقترن بجهاز آخر (${account.bound_device_name||'جوالك السابق'}). يرجى التواصل مع إدارة النظام لفك الارتباط إذا غيرت هاتفك.`,403);
  }
  if(!account.bound_device_id){
   await db.query('UPDATE accounts SET bound_device_id=$1, bound_device_name=$2, device_bound_at=NOW(), phone=COALESCE(phone,$3) WHERE id=$4',[deviceId,deviceName||'هاتف ذكي',phone,account.id]);
   account.bound_device_id=deviceId;account.bound_device_name=deviceName||'هاتف ذكي';account.device_bound_at=new Date();
   if(!account.phone&&phone)account.phone=phone;
  }
 }

 const token=security.newToken();
 await db.query("INSERT INTO auth_sessions(token_hash,account_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '365 days')",[security.digest(token),account.id]);
 res.cookie('asas_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:365*24*3600000,path:'/'});
 respond(res,{account:safeAccount(account),token});
}));

async function generateNextEmployeeIdentifier(client) {
 const res = await client.query(`
   SELECT identifier FROM accounts 
   WHERE identifier ~ '^[0-9]+$' 
   ORDER BY CAST(identifier AS BIGINT) DESC 
   LIMIT 1 FOR UPDATE
 `);
 let nextNum = 1;
 if (res.rows.length) {
   const maxVal = parseInt(res.rows[0].identifier, 10);
   if (!isNaN(maxVal) && maxVal >= 1) {
     nextNum = maxVal + 1;
   }
 }
 return String(nextNum).padStart(3, '0');
}

app.post('/api/auth/google',rateLimit({windowMs:900000,max:25,standardHeaders:true,legacyHeaders:false}),wrap(async(req,res)=>{
 const {credential,email:rawEmail,device_id,device_name,phone,name:rawName}=req.body;
 let targetEmail=null;
 let googleName=rawName?String(rawName).trim():null;
 if(credential&&typeof credential==='string'){
  try{
   const gRes=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
   if(gRes.ok){
    const gData=await gRes.json();
    if(gData.email)targetEmail=gData.email.toLowerCase().trim();
    if(gData.name&&!googleName)googleName=gData.name.trim();
   }
  }catch(_){}
  if(!targetEmail){
   try{
    const parts=credential.split('.');
    if(parts.length>=2){
     const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
     if(payload.email)targetEmail=payload.email.toLowerCase().trim();
     if(payload.name&&!googleName)googleName=payload.name.trim();
    }
   }catch(e){}
  }
 }
 if(!targetEmail&&rawEmail&&typeof rawEmail==='string')targetEmail=rawEmail.toLowerCase().trim();
 if(!targetEmail)error('GOOGLE_AUTH','بيانات التحقق من Google غير مكتملة',400);

 const deviceId=device_id?String(device_id).trim():null;
 const deviceName=device_name?String(device_name).trim().slice(0,150):null;
 const userPhone=phone?String(phone).trim().slice(0,50):null;

 let isNew = false;
 const account = await db.transaction(async c => {
  const result = await c.query('SELECT * FROM accounts WHERE LOWER(email)=$1 AND active=TRUE FOR UPDATE', [targetEmail]);
  let acc = result.rows[0];

  if(deviceId){
   const other = (await c.query('SELECT id, name FROM accounts WHERE bound_device_id=$1', [deviceId])).rows;
   if(other.length && (!acc || other[0].id !== acc.id)){
    error('DEVICE_BOUND_OTHER', `هذا الجوال مقترن بالموظف (${other[0].name}). لا يمكن استخدام نفس الجوال لأكثر من موظف منعاً للتحضير بالنيابة.`, 403);
   }
  }

  if(!acc){
   // Auto-register employee account with sequential permanent employee ID
   const defaultBranch=(await c.query('SELECT id FROM branches WHERE active=TRUE ORDER BY id ASC LIMIT 1')).rows[0];
   const defaultShift=(await c.query('SELECT id FROM shifts ORDER BY id ASC LIMIT 1')).rows[0];
   if(!defaultBranch||!defaultShift){
    error('SETUP_REQUIRED','يرجى إعداد الفروع وجداول الدوام أولاً في لوحة التحكم',500);
   }

   const identifier = await generateNextEmployeeIdentifier(c);
   const empName = googleName || targetEmail.split('@')[0];
   const randomPassHash = await security.hashPassword(`Asas@Auto#${Math.random().toString(36).slice(2)}${Date.now()}`);

   const insertRes = await c.query(
    `INSERT INTO accounts(identifier,name,password_hash,role,branch_id,shift_id,email,phone,bound_device_id,bound_device_name,device_bound_at,active)
     VALUES($1,$2,$3,'employee',$4,$5,$6,$7,$8,$9,$10,TRUE)
     RETURNING *`,
    [
     identifier,
     empName,
     randomPassHash,
     defaultBranch.id,
     defaultShift.id,
     targetEmail,
     userPhone,
     deviceId,
     deviceName||'هاتف ذكي',
     deviceId ? new Date() : null
    ]
   );
   acc = insertRes.rows[0];
   isNew = true;
  } else {
   if(acc.role==='employee'&&deviceId){
    if(acc.bound_device_id&&acc.bound_device_id!==deviceId){
     error('DEVICE_MISMATCH',`حسابك مقترن بجهاز آخر (${acc.bound_device_name||'جوالك السابق'}). يرجى التواصل مع إدارة النظام لفك الارتباط.`,403);
    }
    if(!acc.bound_device_id){
     await c.query('UPDATE accounts SET bound_device_id=$1, bound_device_name=$2, device_bound_at=NOW(), phone=COALESCE(phone,$3) WHERE id=$4',[deviceId,deviceName||'هاتف ذكي',userPhone,acc.id]);
     acc.bound_device_id=deviceId;
     acc.bound_device_name=deviceName||'هاتف ذكي';
     acc.device_bound_at=new Date();
     if(!acc.phone&&userPhone)acc.phone=userPhone;
    }
   }
  }
  return acc;
 });

 if(isNew){
  notifications.notifyAccountCreated(account,deviceName).catch(err=>console.error('[Notification Error] Welcome email failed:',err.message));
 }

 const token=security.newToken();
 await db.query("INSERT INTO auth_sessions(token_hash,account_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '365 days')",[security.digest(token),account.id]);
 res.cookie('asas_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:365*24*3600000,path:'/'});
 respond(res,{
  account:safeAccount(account),
  token,
  is_new:isNew,
  message:isNew
    ? `🎉 تم تسجيل حسابك بنجاح! رقمك الوظيفي الثابت هو: (${account.identifier})`
    : `مرحباً بعودتك! رقمك الوظيفي: (${account.identifier})`
 });
}));

app.get('/api/settings',wrap(async(req,res)=>{
 const settingsRows = (await db.query('SELECT key, value FROM system_settings')).rows;
 const settingsMap = {};
 for(const row of settingsRows) settingsMap[row.key] = row.value;
 respond(res,{
  company_name: settingsMap.company_name || 'شركة أساس الذكاء الاصطناعي (AI-ASAAS)',
  timezone: settingsMap.timezone || 'Asia/Aden',
  max_gps_accuracy: Number(settingsMap.max_gps_accuracy || 250),
  support_contact: settingsMap.support_contact || '+967 770000000',
 });
}));

app.use('/api',wrap(async(req,res,next)=>{
 const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('asas_session='))?.slice(13);
 const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):cookie;
 if(!token||token.length>256)error('UNAUTHORIZED','يرجى تسجيل الدخول',401);
 const {rows}=await db.query('SELECT a.* FROM auth_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>NOW() AND a.active=TRUE',[security.digest(token)]);
 if(!rows[0])error('UNAUTHORIZED','انتهت الجلسة؛ سجل الدخول مجدداً',401);
 req.user=rows[0];req.tokenHash=security.digest(token);next();
}));
app.get('/api/auth/me',(req,res)=>respond(res,safeAccount(req.user)));
app.post('/api/auth/logout',wrap(async(req,res)=>{
 await db.query('DELETE FROM auth_sessions WHERE token_hash=$1',[req.tokenHash]);
 res.clearCookie('asas_session',{path:'/'});
 res.clearCookie('asas_session',{path:'/api'});
 respond(res,{logged_out:true});
}));

app.get('/api/admin/branches',admin,wrap(async(req,res)=>{
 const broad=['super_admin','hr_admin'].includes(req.user.role);
 respond(res,(await db.query('SELECT * FROM branches WHERE $1::boolean OR id=$2 ORDER BY id',[broad,req.user.branch_id])).rows);
}));
function branchInput(b){
 const name=string(b.name);
 for(const [k,limit] of [['latitude',90],['longitude',180]])if(typeof b[k]!=='number'||!Number.isFinite(b[k])||Math.abs(b[k])>limit)error('VALIDATION','إحداثيات غير صالحة');
 const entry=integer(b.entry_radius,10,1000),exit=integer(b.exit_radius,entry+1,2000);
 return [name,b.latitude,b.longitude,entry,exit,integer(b.max_accuracy,1,500),integer(b.exit_samples,2,10),integer(b.exit_delay_seconds,30,600),bool(b.active)];
}
app.post('/api/admin/branches',admin,allow('locations.write'),wrap(async(req,res)=>{
 if(!['super_admin','hr_admin'].includes(req.user.role))error('FORBIDDEN','إنشاء فرع يحتاج إدارة مركزية',403);
 const values=branchInput(req.body),reason=string(req.body.reason,500);
 respond(res,await db.transaction(async c=>{const r=await c.query('INSERT INTO branches(name,latitude,longitude,entry_radius,exit_radius,max_accuracy,exit_samples,exit_delay_seconds,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',values);await audit(c,req.user,'branch.create',r.rows[0].id,reason);return r.rows[0];}));
}));
app.put('/api/admin/branches/:id',admin,allow('locations.write'),wrap(async(req,res)=>{
 const branchId=id(req.params.id);scope(req.user,branchId);const values=branchInput(req.body),reason=string(req.body.reason,500);
 respond(res,await db.transaction(async c=>{
 const old=(await c.query('SELECT * FROM branches WHERE id=$1 FOR UPDATE',[branchId])).rows[0];if(!old)error('NOT_FOUND','الموقع غير موجود',404);
 const r=await c.query('UPDATE branches SET name=$1,latitude=$2,longitude=$3,entry_radius=$4,exit_radius=$5,max_accuracy=$6,exit_samples=$7,exit_delay_seconds=$8,active=$9,location_revision=location_revision+1 WHERE id=$10 RETURNING *',[...values,branchId]);
 await c.query('UPDATE duty_records SET exit_candidate=NULL WHERE branch_id=$1',[branchId]);await audit(c,req.user,'branch.update',branchId,reason,{before:old,after:r.rows[0]});return r.rows[0];}));
}));
app.get('/api/admin/branches/:id/qr',admin,allow('qr.manage'),wrap(async(req,res)=>{
 const branchId=id(req.params.id);scope(req.user,branchId);const branch=(await db.query('SELECT * FROM branches WHERE id=$1 AND active=TRUE',[branchId])).rows[0];
 if(!branch)error('NOT_FOUND','الموقع غير مفعل',404);
 const now=new Date();
 const tokenEnter=policy.issueQr(branch,process.env.QR_SECRET,now,'enter');
 const tokenExit=policy.issueQr(branch,process.env.QR_SECRET,now,'exit');
 const tokenGeneral=policy.issueQr(branch,process.env.QR_SECRET,now);
 const reqOrigin=req.headers.origin;
 const fwdHost=req.headers['x-forwarded-host']||req.headers.host;
 const fwdProto=req.headers['x-forwarded-proto']||'https';
 let base='https://ai-asaas-attendance.vercel.app';
 if(reqOrigin && (reqOrigin.includes('vercel.app')||reqOrigin.includes('trycloudflare.com'))){
  base=reqOrigin;
 } else if(fwdHost && (fwdHost.includes('vercel.app')||fwdHost.includes('trycloudflare.com'))){
  base=`${fwdProto}://${fwdHost}`;
 } else if(process.env.WEB_ORIGIN && !process.env.WEB_ORIGIN.includes('localhost')){
  base=process.env.WEB_ORIGIN.split(',')[0].trim();
 }
 respond(res,{
  day:policy.localDay(now),
  branch:branch.name,
  branch_id:branch.id,
  token:tokenGeneral,
  url:`${base}/attend?branch=${branch.id}#qr=${tokenGeneral}`,
  auto:{
   token:tokenGeneral,
   action:'auto',
   label:'رمز الحضور والانصراف الموحد التلقائي',
   url:`${base}/attend?branch=${branch.id}#qr=${tokenGeneral}`,
   html_url:`${base}/attend.html?branch=${branch.id}#qr=${tokenGeneral}`
  },
  enter:{
   token:tokenEnter,
   action:'enter',
   label:'رمز تسجيل الدخول والعودة',
   url:`${base}/attend/enter?branch=${branch.id}#qr=${tokenEnter}`,
   html_url:`${base}/enter.html?branch=${branch.id}#qr=${tokenEnter}`
  },
  exit:{
   token:tokenExit,
   action:'exit',
   label:'رمز تسجيل الخروج والانصراف',
   url:`${base}/attend/exit?branch=${branch.id}#qr=${tokenExit}`,
   html_url:`${base}/exit.html?branch=${branch.id}#qr=${tokenExit}`
  }
 });
}));
app.post('/api/admin/branches/:id/qr/revoke',admin,allow('qr.manage'),wrap(async(req,res)=>{
 const branchId=id(req.params.id);scope(req.user,branchId);const reason=string(req.body.reason,500);
 await db.transaction(async c=>{const r=await c.query('UPDATE branches SET qr_revision=qr_revision+1 WHERE id=$1 RETURNING id',[branchId]);if(!r.rows.length)error('NOT_FOUND','الموقع غير موجود',404);await audit(c,req.user,'qr.revoke',branchId,reason);});respond(res,{revoked:true});
}));

app.get('/api/admin/shifts',admin,wrap(async(req,res)=>respond(res,(await db.query('SELECT * FROM shifts ORDER BY id')).rows)));
function shiftInput(b){
 policy.parseTime(b.start_time);policy.parseTime(b.end_time);if(b.start_time===b.end_time)error('VALIDATION','حدد وقت بداية ونهاية مختلفين');
 if(!Array.isArray(b.work_days)||!b.work_days.length||b.work_days.some(x=>!Number.isInteger(x)||x<0||x>6))error('VALIDATION','حدد أيام الدوام');
 if(!['actual_exit','scheduled'].includes(b.close_policy))error('VALIDATION','سياسة الإغلاق غير صالحة');
 return [string(b.name),b.start_time,b.end_time,[...new Set(b.work_days)],integer(b.grace_minutes,0,120),b.close_policy,bool(b.deduct_away)];
}
app.post('/api/admin/shifts',admin,allow('shifts.write'),wrap(async(req,res)=>{
 const values=shiftInput(req.body);respond(res,await db.transaction(async c=>{const r=await c.query('INSERT INTO shifts(name,start_time,end_time,work_days,grace_minutes,close_policy,deduct_away) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',values);await audit(c,req.user,'shift.create',r.rows[0].id,'إنشاء جدول');return r.rows[0];}));
}));
app.put('/api/admin/shifts/:id',admin,allow('shifts.write'),wrap(async(req,res)=>{
 const values=shiftInput(req.body),reason=string(req.body.reason,500);
 respond(res,await db.transaction(async c=>{const r=await c.query('UPDATE shifts SET name=$1,start_time=$2,end_time=$3,work_days=$4,grace_minutes=$5,close_policy=$6,deduct_away=$7 WHERE id=$8 RETURNING *',[...values,id(req.params.id)]);if(!r.rows.length)error('NOT_FOUND','الجدول غير موجود',404);await audit(c,req.user,'shift.update',req.params.id,reason,{policy_snapshot:'Existing duty records unchanged'});return r.rows[0];}));
}));
app.get('/api/admin/accounts',admin,allow('employees.read'),wrap(async(req,res)=>{
 const broad=['super_admin','hr_admin'].includes(req.user.role);
 const rows=(await db.query(`
   SELECT 
     a.id, a.identifier, a.name, a.email, a.phone, a.bound_device_id, a.bound_device_name, a.device_bound_at,
     a.role, a.branch_id, a.shift_id, a.department_id, a.permissions, a.active,
     b.name AS branch_name,
     s.name AS shift_name,
     dr.state AS today_state,
     dr.first_in AS today_first_in,
     dr.last_out AS today_last_out,
     dr.late_minutes AS today_late_minutes,
     lr.id AS active_leave_id
   FROM accounts a
   LEFT JOIN branches b ON b.id = a.branch_id
   LEFT JOIN shifts s ON s.id = a.shift_id
   LEFT JOIN LATERAL (
     SELECT state, first_in, last_out, late_minutes
     FROM duty_records
     WHERE employee_id = a.id AND (shift_start AT TIME ZONE 'Asia/Aden')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Aden')::date
     ORDER BY shift_start DESC LIMIT 1
   ) dr ON TRUE
   LEFT JOIN LATERAL (
     SELECT id
     FROM leave_requests
     WHERE employee_id = a.id AND status = 'approved' AND (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Aden')::date BETWEEN from_date AND to_date
     LIMIT 1
   ) lr ON TRUE
   WHERE ($1::boolean OR a.branch_id=$2)
   ORDER BY a.name LIMIT 1000
 `, [broad, req.user.branch_id])).rows;

 const accounts = rows.map(r => {
   let attendance_status = 'absent';
   let attendance_label = 'لم يسجل حضور اليوم';
   if (r.active_leave_id) {
     attendance_status = 'leave';
     attendance_label = 'في إجازة رسمية';
   } else if (r.today_state === 'inside') {
     attendance_status = 'inside';
     attendance_label = 'حاضر الآن';
   } else if (r.today_state === 'outside' || r.today_state === 'closed') {
     attendance_status = 'outside';
     attendance_label = 'تم الانصراف';
   }
   return {
     ...r,
     attendance_status,
     attendance_label
   };
 });
 respond(res, accounts);
}));
app.post('/api/admin/accounts',admin,allow('employees.write'),wrap(async(req,res)=>{
 const b=req.body,role=b.role||'employee';if(!['employee','viewer','hr_admin','branch_manager','super_admin'].includes(role))error('VALIDATION','دور غير صالح');
 if(role!=='employee'&&req.user.role!=='super_admin')error('FORBIDDEN','إنشاء حساب إداري لمدير النظام فقط',403);
 const branchId=b.branch_id?id(b.branch_id):null,shiftId=b.shift_id?id(b.shift_id):null;
 if(role==='employee'&&(!branchId||!shiftId))error('VALIDATION','حدد الفرع وجدول الدوام');
 if(branchId)scope(req.user,branchId);
 const permissions=b.permissions||[];
 const known=['employees.read','employees.write','locations.write','qr.manage','shifts.write','reports.export','attendance.edit','leave.review','audit.read'];
 if(!Array.isArray(permissions)||permissions.some(p=>!known.includes(p))||(permissions.length&&req.user.role!=='super_admin'))error('FORBIDDEN','تعيين الصلاحيات لمدير النظام فقط',403);
 const email=b.email?String(b.email).trim().toLowerCase():null;
 const phone=b.phone?String(b.phone).trim():null;
 let hash;try{hash=await security.hashPassword(b.password);}catch(e){error('VALIDATION',e.message);}
 respond(res,await db.transaction(async c=>{
  if(email){
   const dup=(await c.query('SELECT id FROM accounts WHERE LOWER(email)=$1',[email])).rows;
   if(dup.length)error('VALIDATION','البريد الإلكتروني مسجل لموظف آخر بالفعل');
  }
  let identifier = b.identifier ? string(b.identifier,100).trim() : '';
  if(!identifier){
   identifier = await generateNextEmployeeIdentifier(c);
  }
  const r=await c.query('INSERT INTO accounts(identifier,name,password_hash,role,branch_id,shift_id,permissions,email,phone) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,identifier,name,email,phone,bound_device_id,bound_device_name,device_bound_at,role,branch_id,shift_id,permissions,active',[identifier,string(b.name),hash,role,branchId,shiftId,permissions,email,phone]);
  await audit(c,req.user,'account.create',r.rows[0].id,'إضافة حساب');return r.rows[0];
 }));
}));
app.patch('/api/admin/accounts/:id',admin,allow('employees.write'),wrap(async(req,res)=>{
 const accountId=id(req.params.id),b=req.body,reason=string(b.reason,500);
 respond(res,await db.transaction(async c=>{
  const account=(await c.query('SELECT * FROM accounts WHERE id=$1 FOR UPDATE',[accountId])).rows[0];if(!account)error('NOT_FOUND','الحساب غير موجود',404);
  if(account.role!=='employee'&&req.user.role!=='super_admin')error('FORBIDDEN','تعديل الإدارة لمدير النظام فقط',403);
  if(accountId===req.user.id&&b.active===false)error('VALIDATION','لا يمكنك تعطيل حسابك الحالي');
  if(account.branch_id)scope(req.user,account.branch_id);
  const active=b.active===undefined?account.active:bool(b.active);
  const branchId=b.branch_id===undefined?account.branch_id:id(b.branch_id),shiftId=b.shift_id===undefined?account.shift_id:id(b.shift_id);
  if(branchId)scope(req.user,branchId);
  const open=await c.query("SELECT id FROM duty_records WHERE employee_id=$1 AND state='inside'",[accountId]);
  if(open.rows.length&&(branchId!==account.branch_id||shiftId!==account.shift_id))error('OPEN_DUTY','أغلق الحضور قبل تغيير فرع الموظف أو دوامه',409);
  const permissions=b.permissions===undefined?account.permissions:b.permissions;
  if(b.permissions!==undefined&&(req.user.role!=='super_admin'||!Array.isArray(permissions)))error('FORBIDDEN','تعديل الصلاحيات لمدير النظام فقط',403);
  const name=b.name!==undefined?string(b.name):account.name;
  const email=b.email!==undefined?(b.email?String(b.email).trim().toLowerCase():null):account.email;
  const phone=b.phone!==undefined?(b.phone?String(b.phone).trim():null):account.phone;
  if(email&&email!==account.email){
   const dup=(await c.query('SELECT id FROM accounts WHERE LOWER(email)=$1 AND id<>$2',[email,accountId])).rows;
   if(dup.length)error('VALIDATION','البريد الإلكتروني مسجل لموظف آخر بالفعل');
  }
  let hash=account.password_hash;if(b.password){try{hash=await security.hashPassword(b.password);}catch(e){error('VALIDATION',e.message);}}
  await c.query('UPDATE accounts SET active=$1,branch_id=$2,shift_id=$3,permissions=$4,password_hash=$5,name=$6,email=$7,phone=$8 WHERE id=$9',[active,branchId,shiftId,permissions,hash,name,email,phone,accountId]);
  if(!active||b.password)await c.query('DELETE FROM auth_sessions WHERE account_id=$1',[accountId]);
  await audit(c,req.user,'account.update',accountId,reason,{active,branch_id:branchId,shift_id:shiftId,permissions,password_changed:!!b.password,email,phone});return {updated:true};
 }));
}));
app.post('/api/admin/accounts/:id/reset-device',admin,allow('employees.write'),wrap(async(req,res)=>{
 const accountId=id(req.params.id),reason=string(req.body.reason||'فك ارتباط الجهاز بطلب من الإدارة',500);
 respond(res,await db.transaction(async c=>{
  const acc=(await c.query('SELECT * FROM accounts WHERE id=$1 FOR UPDATE',[accountId])).rows[0];if(!acc)error('NOT_FOUND','الحساب غير موجود',404);
  if(acc.branch_id)scope(req.user,acc.branch_id);
  await c.query('UPDATE accounts SET bound_device_id=NULL, bound_device_name=NULL, device_bound_at=NULL WHERE id=$1',[accountId]);
  await c.query('DELETE FROM auth_sessions WHERE account_id=$1',[accountId]);
  await audit(c,req.user,'account.reset_device',accountId,reason,{previous_device:acc.bound_device_name,previous_device_id:acc.bound_device_id});
  return {reset:true,message:`تم فك ارتباط الجهاز للموظف (${acc.name}) بنجاح. يمكنه الآن تسجيل الدخول من جهازه الجديد.`};
 }));
}));

app.delete('/api/admin/accounts/:id',admin,allow('employees.write'),wrap(async(req,res)=>{
 const accountId=id(req.params.id);
 if(accountId===req.user.id)error('VALIDATION','لا يمكنك حذف حسابك الحالي');
 respond(res,await db.transaction(async c=>{
  const account=(await c.query('SELECT * FROM accounts WHERE id=$1 FOR UPDATE',[accountId])).rows[0];
  if(!account)error('NOT_FOUND','الحساب غير موجود',404);
  if(account.role!=='employee'&&req.user.role!=='super_admin')error('FORBIDDEN','حذف الحسابات الإدارية لمدير النظام فقط',403);
  if(account.branch_id)scope(req.user,account.branch_id);

  await c.query('UPDATE audit_log SET actor_id=NULL WHERE actor_id=$1',[accountId]);
  await c.query('UPDATE leave_requests SET reviewed_by=NULL WHERE reviewed_by=$1',[accountId]);
  await c.query('UPDATE announcements SET sender_id=NULL WHERE sender_id=$1',[accountId]);

  await c.query('DELETE FROM auth_sessions WHERE account_id=$1',[accountId]);
  await c.query('DELETE FROM leave_requests WHERE employee_id=$1',[accountId]);
  await c.query('DELETE FROM attendance_events WHERE employee_id=$1',[accountId]);
  await c.query('DELETE FROM duty_records WHERE employee_id=$1',[accountId]);
  await c.query('DELETE FROM accounts WHERE id=$1',[accountId]);

  await audit(c,req.user,'account.delete',accountId,`حذف حساب الموظف (${account.name})`,{account_name:account.name,identifier:account.identifier});
  return {deleted:true,message:`تم حذف حساب الموظف (${account.name}) بنجاح`};
 }));
}));

app.put('/api/auth/profile',wrap(async(req,res)=>{
 const {current_password,new_password,avatar,phone}=req.body;
 const accountId=req.user.id;
 respond(res,await db.transaction(async c=>{
  const acc=(await c.query('SELECT * FROM accounts WHERE id=$1 FOR UPDATE',[accountId])).rows[0];
  if(!acc)error('NOT_FOUND','المستخدم غير موجود',404);

  let newHash=acc.password_hash;
  if(new_password){
   if(acc.password_hash){
    const valid=await security.verifyPassword(current_password||'',acc.password_hash);
    if(!valid)error('VALIDATION','كلمة المرور الحالية غير صحيحة',400);
   }
   if(typeof new_password!=='string'||new_password.length<8)error('VALIDATION','يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل',400);
   newHash=await security.hashPassword(new_password);
  }

  const newAvatar = avatar !== undefined ? (typeof avatar === 'string' ? avatar.trim().slice(0, 500000) : null) : acc.avatar;
  const newPhone = phone !== undefined ? (phone ? String(phone).trim().slice(0, 50) : null) : acc.phone;

  const updated=(await c.query('UPDATE accounts SET password_hash=$1, avatar=$2, phone=$3 WHERE id=$4 RETURNING *',[newHash,newAvatar,newPhone,accountId])).rows[0];
  req.user=updated;
  return safeAccount(updated);
 }));
}));

app.get('/api/announcements',wrap(async(req,res)=>{
 const {rows}=await db.query(`
   SELECT a.*, acc.name as sender_name 
   FROM announcements a 
   LEFT JOIN accounts acc ON acc.id = a.sender_id 
   WHERE a.active = TRUE 
   ORDER BY a.created_at DESC 
   LIMIT 50
 `);
 respond(res,rows);
}));

app.post('/api/admin/announcements',admin,wrap(async(req,res)=>{
 const {title,content,priority='normal',send_email=false}=req.body;
 if(!title||!title.trim())error('VALIDATION','عنوان التعميم مطلوب');
 if(!content||!content.trim())error('VALIDATION','نص التعميم مطلوب');

 const cleanTitle=string(title,250);
 const cleanContent=string(content,5000);
 const cleanPriority=['normal','important','urgent'].includes(priority)?priority:'normal';

 const inserted=await db.transaction(async c=>{
  const r=await c.query(
   `INSERT INTO announcements(title,content,priority,sender_id,sender_name,send_email,created_at,active)
    VALUES($1,$2,$3,$4,$5,$6,NOW(),TRUE) RETURNING *`,
   [cleanTitle,cleanContent,cleanPriority,req.user.id,req.user.name,bool(send_email)]
  );
  await audit(c,req.user,'announcement.create',r.rows[0].id,cleanTitle);
  return r.rows[0];
 });

 if(send_email){
  db.query('SELECT name, email FROM accounts WHERE active=TRUE AND email IS NOT NULL').then(async empRes=>{
   for(const emp of empRes.rows){
    if(emp.email){
     notifications.notifyAnnouncement(emp, inserted).catch(err=>console.error(`Failed to send announcement email to ${emp.email}:`, err.message));
    }
   }
  }).catch(()=>{});
 }

 respond(res,inserted);
}));

app.delete('/api/admin/announcements/:id',admin,wrap(async(req,res)=>{
 const annId=id(req.params.id);
 await db.query('UPDATE announcements SET active=FALSE WHERE id=$1',[annId]);
 respond(res,{deleted:true});
}));

const employee=(req,res,next)=>['employee','super_admin','hr_admin','branch_manager'].includes(req.user.role)?next():next(new AppError('FORBIDDEN','هذه العملية لحساب الموظف',403));
const uuid=value=>{
 if(typeof value==='string'&&value.trim()&&value.trim().length<=100)return value.trim();
 return require('node:crypto').randomUUID();
};
async function event(c,user,record,kind,body,details){
 await c.query('INSERT INTO attendance_events(record_id,employee_id,kind,captured_at,request_id,details) VALUES($1,$2,$3,$4,$5,$6)',[record?.id||null,user.id,kind,body.fix?.captured_at||null,body.request_id,JSON.stringify(details)]);
}

function resolveRecordStatus(r){
 if(!r)return {status_key:'absent',status_label:'لم يسجل حضور اليوم',exit_reason_label:'—'};
 const isInside = r.state === 'inside';
 const late = Number(r.late_minutes || 0);

 if(isInside){
  const status_key = late > 0 ? 'late_inside' : 'ontime_inside';
  const status_label = late > 0 ? `حاضر متأخر (${late} دقيقة)` : 'حاضر في الموعد';
  const exit_reason_label = 'قيد الدوام (على رأس العمل)';
  return { status_key, status_label, exit_reason_label };
 }

 let earlyMinutes = 0;
 let overtimeMinutes = 0;
 if(r.shift_end && r.last_out){
  const diffMin = Math.round((new Date(r.last_out) - new Date(r.shift_end)) / 60000);
  if(diffMin < -10){
   earlyMinutes = Math.abs(diffMin);
  } else if(diffMin > 30){
   overtimeMinutes = diffMin;
  }
 }

 let status_key = 'ontime_outside';
 let status_label = 'انصراف مكتمل في الموعد';

 if(earlyMinutes > 0){
  status_key = 'early_exit';
  status_label = `انصراف مبكر (${earlyMinutes} د)`;
 } else if(overtimeMinutes > 0){
  status_key = 'overtime_exit';
  status_label = `انصراف مع إضافي (+${overtimeMinutes} د)`;
 } else if(late > 0){
  status_key = 'late_outside';
  status_label = 'تم الانصراف (مع تأخير)';
 }

 let exit_reason_label = 'انتهاء ساعات الدوام الرسمي في الموعد';
 const rawReason = String(r.exit_reason || '');
 if(rawReason.includes('مغادرة') || rawReason === 'geofence'){
  exit_reason_label = 'مغادرة نطاق الموقع تلقائياً (GPS)';
 } else if(rawReason.includes('مجدولة') || rawReason === 'scheduled'){
  exit_reason_label = 'انتهاء فترة المناوبة المجدولة تلقائياً';
 } else if(rawReason.includes('مبكر') || earlyMinutes > 0){
  exit_reason_label = earlyMinutes > 0 ? `خروج مبكر قبل نهاية الدوام بـ ${earlyMinutes} دقيقة` : (rawReason || 'خروج مبكر');
 } else if(rawReason.includes('إضافي') || overtimeMinutes > 0){
  exit_reason_label = overtimeMinutes > 0 ? `انتهاء مناوبة عمل إضافي (+${overtimeMinutes} دقيقة)` : (rawReason || 'عمل إضافي');
 } else if(rawReason && !['manual', 'geofence', 'scheduled'].includes(rawReason)){
  exit_reason_label = rawReason;
 }

 return { status_key, status_label, exit_reason_label };
}
app.get('/api/attendance/active-qr',employee,wrap(async(req,res)=>{
 const branchId=Number(req.query.branch||req.user.branch_id||1);
 const branch=(await db.query('SELECT * FROM branches WHERE id=$1 AND active=TRUE',[branchId])).rows[0];
 if(!branch)error('NOT_FOUND','الموقع غير مفعل',404);
 const now=new Date();
 const action=req.query.action==='exit'?'exit':(req.query.action==='enter'?'enter':null);
 const token=policy.issueQr(branch,process.env.QR_SECRET,now,action);
 respond(res,{token,branch_id:branch.id,branch_name:branch.name,latitude:Number(branch.latitude),longitude:Number(branch.longitude),entry_radius:branch.entry_radius,action:action||'auto'});
}));
app.post('/api/attendance/action',employee,wrap(async(req,res)=>{
 const b=req.body;if(!['enter','exit','location','auto'].includes(b.action))error('VALIDATION','إجراء غير صالح');
 b.request_id=uuid(b.request_id);
 if(req.user.role==='employee'&&req.user.bound_device_id){
  const actionDev=b.device_id||req.headers['x-device-id'];
  if(actionDev&&actionDev!==req.user.bound_device_id){
   error('DEVICE_MISMATCH','لا يمكن تسجيل الحضور إلا من هاتفك المقترن بحسابك.',403);
  }
 }
 await closeScheduled();
 const result=await db.transaction(async c=>{
  // Serialize all employee actions, including initial check-in, to close race windows.
  await c.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE',[req.user.id]);
  const replay=await c.query('SELECT id FROM attendance_events WHERE employee_id=$1 AND request_id=$2',[req.user.id,b.request_id]);
  if(replay.rows.length)return {duplicate:true};
  const now=new Date();
  let record=(await c.query("SELECT * FROM duty_records WHERE employee_id=$1 ORDER BY shift_start DESC LIMIT 1 FOR UPDATE",[req.user.id])).rows[0];

  // Smart automatic action resolution based on employee state
  const isAuto = b.action === 'auto';
  if(isAuto){
   b.action = (record && record.state === 'inside') ? 'exit' : 'enter';
  }

  const branchId=record?.state==='inside'?record.branch_id:(req.user.branch_id||1);
  const branch=(await c.query('SELECT * FROM branches WHERE id=$1 FOR SHARE',[branchId])).rows[0];
  if(!branch)error('NO_BRANCH','لم يتم تعيين موقع لك');
  const location=policy.classifyFix(b.fix,branch,now);
  if(b.action!=='location'){
   policy.verifyQr(b.token,branch,process.env.QR_SECRET,now,isAuto?'auto':b.action);
   const dist=Math.round(location.distance);
   const maxAccuracy=Math.max(Number(branch.max_accuracy||200),250);
   if(b.fix.accuracy>maxAccuracy){
    error('GPS_LOW_ACCURACY',`إشارة تحديد الموقع ضعيفة (الدقة: ${Math.round(b.fix.accuracy)} متر، والحد الأقصى للدقة المقبولة هو ${maxAccuracy} متر). يرجى تفعيل "الموقع الدقيق Precise Location" في الهاتف والاقتراب من نافذة والمحاولة مجدداً.`,422);
   }
   const maxAllowedDist=b.action==='enter'?Number(branch.entry_radius):Math.max(Number(branch.exit_radius),500);
   if(dist>maxAllowedDist){
    if(b.action==='enter'){
     error('GPS_REJECTED',`أنت خارج نطاق الفرع (${dist} متر). النطاق المسموح للدخول: ${branch.entry_radius} متر. يرجى التواجد في مقر الفرع أو تعديل إحداثيات الفرع في الإدارة لموقعك الحالي.`,422);
    }else{
     error('GPS_REJECTED',`أنت بعيد جداً عن مقر الفرع (${dist} متر) لتسجيل الخروج يدوياً. يمكنك مغادرة الموقع ليتم تسجيل خروجك التلقائي.`,422);
    }
   }
   location.state='inside';
  }
  if(b.action==='enter'){
   if(record?.state==='inside')return {already_inside:true,record,action:'enter',message:'أنت مسجل حضور بالفعل ومناوبتك مفتوحة'};
   let shiftId=req.user.shift_id;
   if(!shiftId){
    const def=(await c.query('SELECT id FROM shifts ORDER BY id ASC LIMIT 1')).rows[0];
    shiftId=def?.id;
   }
   const shift=(await c.query('SELECT * FROM shifts WHERE id=$1',[shiftId])).rows[0];
   if(!shift)error('NO_SHIFT','لم يتم تعيين دوام لك');
   const window=policy.shiftWindow(shift,now);
   record=(await c.query('SELECT * FROM duty_records WHERE employee_id=$1 AND shift_start=$2 FOR UPDATE',[req.user.id,window.start])).rows[0];
   const returning=!!record;
   if(record?.state==='closed')error('SHIFT_CLOSED','تم إغلاق هذه المناوبة',409);
   if(record){
    record=(await c.query("UPDATE duty_records SET state='inside',away_seconds=away_seconds+GREATEST(0,FLOOR(EXTRACT(EPOCH FROM ($1::timestamptz-away_started))))::integer,away_started=NULL,exit_candidate=NULL,last_seen=$1,gps_state='inside' WHERE id=$2 RETURNING *",[now,record.id])).rows[0];
   }else{
    const late=Math.max(0,Math.floor((now-window.start)/60000)-shift.grace_minutes);
    record=(await c.query("INSERT INTO duty_records(employee_id,branch_id,shift_id,shift_start,shift_end,first_in,state,close_policy,deduct_away,late_minutes,last_seen) VALUES($1,$2,$3,$4,$5,$6,'inside',$7,$8,$9,$6) RETURNING *",[req.user.id,branch.id,shift.id,window.start,window.end,now,shift.close_policy,shift.deduct_away,late])).rows[0];
   }
   await event(c,req.user,record,returning?'return':'enter',b,{location,fix:b.fix,branch_snapshot:branch,is_auto:isAuto});
   if(!returning&&req.user.email){
    const timeStr=new Date(now).toLocaleTimeString('ar-YE',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Aden'});
    notifications.notifyCheckIn(req.user,branch.name,timeStr).catch(err=>console.error('[Notification Error] Check-in email failed:',err.message));
   }
   const resolved = resolveRecordStatus(record);
   const enterMsg = record.late_minutes > 0
     ? `تم تسجيل حضورك بنجاح (تأخير ${record.late_minutes} دقيقة عن بداية الدوام)`
     : (returning ? (isAuto ? 'تم تسجيل عودتك تلقائياً' : 'تم تسجيل عودتك') : (isAuto ? 'تم تسجيل حضورك تلقائياً بحسب حالتك' : 'تم تسجيل حضورك'));
   return {record:{...record,...resolved},action:'enter',automatic:isAuto,message:enterMsg,status_label:resolved.status_label,exit_reason_label:resolved.exit_reason_label};
  }
  if(!record||record.state!=='inside')error('NOT_INSIDE','لا يوجد حضور مفتوح لتسجيل الخروج منه. يرجى تسجيل الدخول أولاً.',409);
  let automatic=false,candidate=null;
  if(b.action==='location'){
   if(location.distance<=Number(branch.entry_radius)&&b.fix.accuracy<=Math.max(Number(branch.max_accuracy||200),250)){
    location.state='inside';
   } else if(location.distance>Number(branch.exit_radius)){
    location.state='outside';
   }
   candidate=policy.advanceExit(record.exit_candidate,location,b.fix,branch,now);
   if(candidate.ignored)return {ignored:true};automatic=candidate.exit;
   await c.query('UPDATE duty_records SET exit_candidate=$1,last_seen=$2,gps_state=$3 WHERE id=$4',[JSON.stringify(candidate),now,location.state,record.id]);
  }
  if(b.action==='exit'||automatic){
   let reason = automatic ? 'مغادرة نطاق الموقع تلقائياً (GPS)' : 'انتهاء ساعات الدوام الرسمي في الموعد';
   let earlyMins = 0;
   if(record.shift_end){
    const shiftEnd = new Date(record.shift_end);
    const diffMin = Math.round((now - shiftEnd) / 60000);
    if(diffMin < -10){
     earlyMins = Math.abs(diffMin);
     if(!automatic) reason = `خروج مبكر قبل نهاية الدوام بـ ${earlyMins} دقيقة`;
    } else if(diffMin > 30){
     if(!automatic) reason = `انتهاء عمل إضافي (+${diffMin} دقيقة)`;
    } else {
     if(!automatic) reason = 'انتهاء ساعات الدوام الرسمي في الموعد';
    }
   }
   record=(await c.query("UPDATE duty_records SET state='outside',last_out=$1,away_started=$1,exit_reason=$2,exit_candidate=NULL,last_seen=$1,gps_state=$3 WHERE id=$4 RETURNING *",[now,reason,location.state,record.id])).rows[0];
   await event(c,req.user,record,automatic?'auto_exit':'exit',b,{location,fix:b.fix,branch_snapshot:branch,is_auto:isAuto,exit_reason:reason});
   if(req.user.email){
    const timeStr=new Date(now).toLocaleTimeString('ar-YE',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Aden'});
    const workingMinutes=countedMinutes(record);
    notifications.notifyCheckOut(req.user,branch.name,timeStr,workingMinutes).catch(err=>console.error('[Notification Error] Check-out email failed:',err.message));
   }
   const resolved = resolveRecordStatus(record);
   const exitMsg = automatic
     ? 'تم تسجيل خروجك التلقائي بنجاح لمغادرتك نطاق الفرع'
     : (earlyMins > 0 ? `تم تسجيل انصرافك بنجاح (${reason})` : (isAuto ? 'تم تسجيل انصرافك تلقائياً بنهاية دوامك' : 'تم تسجيل الخروج'));
   return {
     record:{...record,...resolved},
     action:'exit',
     automatic:automatic||isAuto,
     message:exitMsg,
     status_label:resolved.status_label,
     exit_reason_label:resolved.exit_reason_label
   };
  }
  await event(c,req.user,record,'location',b,{location,accuracy:b.fix.accuracy,revision:branch.location_revision});
  return {record:{...record,gps_state:location.state,last_seen:now},pending_exit:candidate?.count||0};
 });respond(res,result);
}));
app.get('/api/attendance/me',employee,wrap(async(req,res)=>{
 await closeScheduled();
 const records=(await db.query('SELECT r.*, s.start_time, s.end_time, s.grace_minutes FROM duty_records r LEFT JOIN shifts s ON s.id=r.shift_id WHERE r.employee_id=$1 ORDER BY r.shift_start DESC LIMIT 31',[req.user.id])).rows;
 const shift=(await db.query('SELECT * FROM shifts WHERE id=$1',[req.user.shift_id])).rows[0]||null;
 const todayRecord = records.find(r => {
   try {
     const recDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Aden' }).format(new Date(r.shift_start));
     const nowDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Aden' }).format(new Date());
     return recDate === nowDate;
   } catch { return false; }
 }) || records[0] || null;
 const isInside = todayRecord && todayRecord.state === 'inside';
 const autoInfo = todayRecord ? resolveRecordStatus(todayRecord) : null;
 const automatic_status = {
   is_inside: Boolean(isInside),
   suggested_action: isInside ? 'exit' : 'enter',
   status_label: isInside 
     ? (todayRecord?.late_minutes > 0 ? `حاضر داخل موقع العمل (تأخير ${todayRecord.late_minutes} دقيقة)` : 'حاضر داخل موقع العمل (في الموعد)') 
     : (todayRecord?.last_out ? (autoInfo?.status_label || 'تم تسجيل الانصراف') : 'خارج موقع العمل (جاهز لتسجيل الحضور)'),
   next_action_label: isInside ? 'تسجيل الانصراف' : 'تسجيل الحضور',
   exit_reason_label: autoInfo?.exit_reason_label || (isInside ? 'قيد الدوام (على رأس العمل)' : '—')
 };
 const enhancedRecords = records.map(r => {
   const res = resolveRecordStatus(r);
   return { ...r, ...res, counted_minutes: countedMinutes(r) };
 });
 respond(res,{records:enhancedRecords,shift,account:safeAccount(req.user),automatic_status});
}));
// Offline evidence is never promoted directly to approved attendance.
app.post('/api/attendance/offline',employee,wrap(async(req,res)=>{
 uuid(req.body.request_id);const detail=req.body.evidence;
 if(!detail||typeof detail!=='object'||JSON.stringify(detail).length>8000)error('VALIDATION','حجم الدليل غير صالح');
 await db.query("INSERT INTO attendance_events(employee_id,kind,request_id,details) VALUES($1,'offline_pending_review',$2,$3) ON CONFLICT(employee_id,request_id) DO NOTHING",[req.user.id,req.body.request_id,JSON.stringify(detail)]);
 respond(res,{pending_review:true});
}));

async function recordsFor(user,from,to){
 const broad=['super_admin','hr_admin'].includes(user.role);
 return (await db.query("SELECT r.*,a.name,a.identifier,b.name AS branch_name,s.name AS shift_name,s.start_time,s.end_time,s.grace_minutes FROM duty_records r JOIN accounts a ON a.id=r.employee_id JOIN branches b ON b.id=r.branch_id JOIN shifts s ON s.id=r.shift_id WHERE ($1::boolean OR r.branch_id=$2) AND (r.shift_start AT TIME ZONE 'Asia/Aden')::date BETWEEN $3::date AND $4::date ORDER BY r.shift_start DESC LIMIT 5000",[broad,user.branch_id,from,to])).rows;
}
function dateRange(req){const today=policy.localDay();const from=req.query.from||today,to=req.query.to||today;for(const d of [from,to])if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d)))error('DATE','تاريخ غير صالح');if(from>to||Date.parse(to)-Date.parse(from)>366*86400000)error('DATE','الفترة لا تتجاوز سنة');return [from,to];}
function countedMinutes(r){if(r.state==='inside'||!r.last_out)return null;return Math.max(0,Math.floor((new Date(r.last_out)-new Date(r.first_in))/60000)-(r.deduct_away?Math.floor(r.away_seconds/60):0));}
app.get('/api/admin/records',admin,wrap(async(req,res)=>{
 const rows=await recordsFor(req.user,...dateRange(req));
 respond(res,rows.map(r=>({
  ...r,
  counted_minutes:countedMinutes(r),
  ...resolveRecordStatus(r)
 })));
}));
app.patch('/api/admin/records/:id',admin,allow('attendance.edit'),wrap(async(req,res)=>{
 const recordId=id(req.params.id),b=req.body,reason=string(b.reason,500);
 respond(res,await db.transaction(async c=>{
  const old=(await c.query('SELECT * FROM duty_records WHERE id=$1 FOR UPDATE',[recordId])).rows[0];
  if(!old)error('NOT_FOUND','سجل الحضور غير موجود',404);
  scope(req.user,old.branch_id);
  const firstIn=b.first_in===undefined?old.first_in:(b.first_in?new Date(b.first_in):null);
  const lastOut=b.last_out===undefined?old.last_out:(b.last_out?new Date(b.last_out):null);
  if(!firstIn||isNaN(firstIn.getTime()))error('VALIDATION','وقت الدخول غير صالح');
  if(lastOut&&isNaN(lastOut.getTime()))error('VALIDATION','وقت الخروج غير صالح');
  if(lastOut&&lastOut<firstIn)error('VALIDATION','وقت الخروج يجب أن يكون بعد وقت الدخول');
  const state=b.state===undefined?old.state:b.state;
  if(!['inside','outside','closed'].includes(state))error('VALIDATION','حالة الحضور غير صالحة');
  if(state==='inside'){
   const other=(await c.query("SELECT id FROM duty_records WHERE employee_id=$1 AND state='inside' AND id<>$2",[old.employee_id,recordId])).rows;
   if(other.length)error('CONFLICT','الموظف لديه سجل حضور مفتوح آخر',409);
  }
  const exitReason=b.exit_reason===undefined?old.exit_reason:(b.exit_reason?string(b.exit_reason,50):null);
  const deductAway=b.deduct_away===undefined?old.deduct_away:bool(b.deduct_away);
  const r=await c.query("UPDATE duty_records SET first_in=$1,last_out=$2,state=$3,exit_reason=$4,deduct_away=$5 WHERE id=$6 RETURNING *",[firstIn,lastOut,state,exitReason,deductAway,recordId]);
  const updated=r.rows[0];
  await audit(c,req.user,'attendance.edit',recordId,reason,{before:old,after:updated});
  return {...updated,counted_minutes:countedMinutes(updated)};
 }));
}));
app.get('/api/admin/settings',admin,wrap(async(req,res)=>{
 const settingsRows = (await db.query('SELECT key, value FROM system_settings')).rows;
 const settingsMap = {};
 for(const row of settingsRows) settingsMap[row.key] = row.value;

 const dbTest=await db.query('SELECT NOW() as now');
 respond(res,{
  company_name: settingsMap.company_name || 'شركة أساس الذكاء الاصطناعي (AI-ASAAS)',
  timezone: settingsMap.timezone || 'Asia/Aden',
  max_gps_accuracy: Number(settingsMap.max_gps_accuracy || 250),
  email_notifications: settingsMap.email_notifications === 'true',
  support_contact: settingsMap.support_contact || '+967 770000000',
  server_time:new Date().toISOString(),
  db_time:dbTest.rows[0]?.now,
  node_version:process.version,
  environment:process.env.NODE_ENV||'development',
  host:process.env.HOST||'127.0.0.1',
  port:Number(process.env.PORT||5000),
  web_origin:origin(),
  qr_secret_configured:Boolean(process.env.QR_SECRET&&process.env.QR_SECRET.length>=32&&!process.env.QR_SECRET.startsWith('REPLACE_'))
 });
}));

app.put('/api/admin/settings',admin,allow('locations.write'),wrap(async(req,res)=>{
 const {company_name, timezone, max_gps_accuracy, email_notifications, support_contact} = req.body;
 await db.transaction(async c => {
  if(company_name !== undefined){
   await c.query(`INSERT INTO system_settings(key, value, updated_at) VALUES('company_name', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`, [string(company_name, 200)]);
  }
  if(timezone !== undefined){
   await c.query(`INSERT INTO system_settings(key, value, updated_at) VALUES('timezone', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`, [string(timezone, 100)]);
  }
  if(max_gps_accuracy !== undefined){
   await c.query(`INSERT INTO system_settings(key, value, updated_at) VALUES('max_gps_accuracy', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`, [String(integer(max_gps_accuracy, 10, 1000))]);
  }
  if(email_notifications !== undefined){
   await c.query(`INSERT INTO system_settings(key, value, updated_at) VALUES('email_notifications', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`, [email_notifications ? 'true' : 'false']);
  }
  if(support_contact !== undefined){
   await c.query(`INSERT INTO system_settings(key, value, updated_at) VALUES('support_contact', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`, [string(support_contact, 100)]);
  }
  await audit(c, req.user, 'settings.update', null, 'تحديث إعدادات النظام الحقيقية');
 });
 respond(res, { saved: true, message: 'تم حفظ إعدادات النظام وتطبيقها فوراً' });
}));
app.get('/api/admin/dashboard',admin,wrap(async(req,res)=>{
 await closeScheduled();const broad=['super_admin','hr_admin'].includes(req.user.role);
 const accounts=(await db.query("SELECT id,name,branch_id FROM accounts WHERE role='employee' AND active=TRUE AND ($1::boolean OR branch_id=$2)",[broad,req.user.branch_id])).rows;
 const today=policy.localDay(),records=await recordsFor(req.user,today,today);
 const active=(await db.query("SELECT r.* FROM duty_records r WHERE state='inside' AND ($1::boolean OR branch_id=$2)",[broad,req.user.branch_id])).rows;
 const fresh=active.filter(r=>r.last_seen&&Date.now()-new Date(r.last_seen)<90000&&r.gps_state==='inside').length;
 respond(res,{total:accounts.length,present:new Set(records.map(r=>r.employee_id)).size,inside:fresh,uncertain:active.length-fresh,late:records.filter(r=>r.late_minutes>0).length,records:records.map(r=>({...r,counted_minutes:countedMinutes(r)}))});
}));
app.get('/api/admin/reports.csv',admin,allow('reports.export'),wrap(async(req,res)=>{
 const [from,to]=dateRange(req);
 const rows=await recordsFor(req.user,from,to);
 const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
 const header=['الرقم الوظيفي','الموظف','الفرع','تاريخ الدوام','أول دخول (صنعاء)','آخر خروج (صنعاء)','الحالة التلقائية','سبب الخروج التلقائي','الدقائق المحتسبة','خصم فترات المغادرة'];
 const lines=rows.map(r=>{
  const auto=resolveRecordStatus(r);
  return [
   r.identifier,
   r.name,
   r.branch_name,
   new Date(r.shift_start).toLocaleDateString('ar-YE',{timeZone:'Asia/Aden'}),
   new Date(r.first_in).toLocaleTimeString('ar-YE',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Aden'}),
   r.last_out?new Date(r.last_out).toLocaleTimeString('ar-YE',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Aden'}):'قيد الدوام',
   auto.status_label,
   auto.exit_reason_label,
   countedMinutes(r)||0,
   r.deduct_away?'نعم':'لا'
  ];
 });
 await audit(db,req.user,'reports.export','attendance','تصدير CSV',{count:rows.length});
 res.type('text/csv').attachment(`asas-attendance-${from}-${to}.csv`).send('\uFEFF'+[header,...lines].map(row=>row.map(cell).join(',')).join('\r\n'));
}));

app.get('/api/admin/reports.txt',admin,allow('reports.export'),wrap(async(req,res)=>{
 const [from,to]=dateRange(req);
 const rows=await recordsFor(req.user,from,to);
 const nowStr=new Date().toLocaleString('ar-YE',{timeZone:'Asia/Aden'});
 let content=`========================================================================================================================\r\n`;
 content+=`                                      تقرير الحضور والانصراف - نظام أساس\r\n`;
 content+=`                                        توقيت صنعاء، الجمهورية اليمنية\r\n`;
 content+=`                                       الفترة: من ${from} إلى ${to}\r\n`;
 content+=`========================================================================================================================\r\n`;
 content+=`تاريخ ووقت الإصدار : ${nowStr} (بتوقيت صنعاء)\r\n`;
 content+=`إجمالي السجلات     : ${rows.length}\r\n`;
 content+=`------------------------------------------------------------------------------------------------------------------------\r\n`;
 content+=`الموظف               الرقم الوظيفي   الفرع          الدخول       الخروج       الحالة                سبب الخروج                     الدقائق\r\n`;
 content+=`------------------------------------------------------------------------------------------------------------------------\r\n`;
 for(const r of rows){
  const auto=resolveRecordStatus(r);
  const name=(r.name||'').padEnd(20).slice(0,20);
  const id=(r.identifier||'').padEnd(14).slice(0,14);
  const branch=(r.branch_name||'').padEnd(14).slice(0,14);
  const inTime=new Date(r.first_in).toLocaleTimeString('ar-YE',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Aden'}).padEnd(12);
  const outTime=(r.last_out?new Date(r.last_out).toLocaleTimeString('ar-YE',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Aden'}):'قيد الدوام').padEnd(12);
  const state=(auto.status_label||'').padEnd(20).slice(0,20);
  const reason=(auto.exit_reason_label||'').padEnd(30).slice(0,30);
  const mins=String(countedMinutes(r)||0).padEnd(8);
  content+=`${name} ${id} ${branch} ${inTime} ${outTime} ${state} ${reason} ${mins}\r\n`;
 }
 content+=`========================================================================================================================\r\n`;
 await audit(db,req.user,'reports.export','attendance','تصدير TXT',{count:rows.length});
 res.setHeader('Content-Type','text/plain; charset=utf-8');
 res.attachment(`asas-attendance-${from}-${to}.txt`).send('\uFEFF'+content);
}));

app.get('/api/admin/reports.doc',admin,allow('reports.export'),wrap(async(req,res)=>{
 const [from,to]=dateRange(req);
 const rows=await recordsFor(req.user,from,to);
 const nowStr=new Date().toLocaleString('ar-YE',{timeZone:'Asia/Aden'});
 const html=`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>تقرير الحضور والانصراف - نظام أساس</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; text-align: right; margin: 24px; color: #231f20; }
.header { text-align: center; border-bottom: 2px solid #b59045; padding-bottom: 12px; margin-bottom: 20px; }
.header h1 { margin: 0 0 6px; color: #231f20; font-size: 24px; }
.header p { margin: 2px 0; color: #775b24; font-size: 13px; font-weight: bold; }
.meta { margin-bottom: 16px; font-size: 13px; color: #474143; }
.meta strong { color: #231f20; }
table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
th { background-color: #231f20; color: #ffffff; padding: 10px 8px; border: 1px solid #1a1718; text-align: right; }
td { padding: 8px; border: 1px solid #e0dacb; text-align: right; }
tr:nth-child(even) { background-color: #faf9f5; }
.badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; }
.badge-in { background-color: #eaf4ee; color: #2d6a4f; }
.badge-out { background-color: #f5f3f0; color: #474143; }
.footer { margin-top: 24px; text-align: center; font-size: 11px; color: #8a8275; border-top: 1px solid #ebdcc0; padding-top: 10px; }
</style>
</head>
<body>
<div class='header'>
 <h1>نظام أساس للحضور والانصراف</h1>
 <p>ASAS Attendance Management System</p>
 <p>تقرير الحضور والانصراف الرسمي · توقيت صنعاء (اليمن)</p>
</div>
<div class='meta'>
 <div><strong>الفترة المحددة:</strong> من ${from} إلى ${to}</div>
 <div><strong>تاريخ الإصدار:</strong> ${nowStr} (بتوقيت صنعاء)</div>
 <div><strong>إجمالي السجلات:</strong> ${rows.length} سجل</div>
</div>
<table>
 <thead>
  <tr>
   <th>الرقم الوظيفي</th>
   <th>اسم الموظف</th>
   <th>الفرع</th>
   <th>تاريخ الدوام</th>
   <th>وقت الدخول</th>
   <th>وقت الخروج</th>
   <th>الحالة التلقائية</th>
   <th>سبب الخروج التلقائي</th>
   <th>الدقائق المحتسبة</th>
  </tr>
 </thead>
 <tbody>
  ${rows.map(r=>{
   const auto=resolveRecordStatus(r);
   return `
  <tr>
   <td><strong>${r.identifier}</strong></td>
   <td>${r.name}</td>
   <td>${r.branch_name}</td>
   <td>${new Date(r.shift_start).toLocaleDateString('ar-YE',{timeZone:'Asia/Aden'})}</td>
   <td style='color:#2d6a4f; font-weight:bold;'>${new Date(r.first_in).toLocaleTimeString('ar-YE',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Aden'})}</td>
   <td>${r.last_out?new Date(r.last_out).toLocaleTimeString('ar-YE',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Aden'}):'<span class="badge badge-in">قيد الدوام</span>'}</td>
   <td><span class='badge ${auto.status_key.includes('inside')?'badge-in':'badge-out'}'>${auto.status_label}</span></td>
   <td style='color:#775b24; font-weight:500;'>${auto.exit_reason_label}</td>
   <td><strong>${countedMinutes(r)||0} د</strong></td>
  </tr>`;
  }).join('')}
 </tbody>
</table>
<div class='footer'>
 تم استخراج هذا التقرير آلياً وموثق بواسطة نظام أساس للحضور والانصراف · توقيت صنعاء، الجمهورية اليمنية
</div>
</body>
</html>`;
 await audit(db,req.user,'reports.export','attendance','تصدير Word',{count:rows.length});
 res.setHeader('Content-Type','application/msword; charset=utf-8');
 res.attachment(`asas-attendance-${from}-${to}.doc`).send('\uFEFF'+html);
}));
app.get('/api/admin/audit',admin,allow('audit.read'),wrap(async(req,res)=>{
 if(req.user.role!=='super_admin')error('FORBIDDEN','سجل النظام لمدير النظام فقط',403);
 respond(res,(await db.query('SELECT l.*,a.name AS actor FROM audit_log l LEFT JOIN accounts a ON a.id=l.actor_id ORDER BY id DESC LIMIT 200')).rows);
}));
app.get('/api/leave',wrap(async(req,res)=>{
 const isEmployee=req.user.role==='employee',broad=['super_admin','hr_admin'].includes(req.user.role);
 const rows=await db.query('SELECT l.*,a.name FROM leave_requests l JOIN accounts a ON a.id=l.employee_id WHERE ($1::boolean AND l.employee_id=$2) OR (NOT $1::boolean AND ($3::boolean OR a.branch_id=$4)) ORDER BY l.id DESC LIMIT 200',[isEmployee,req.user.id,broad,req.user.branch_id]);respond(res,rows.rows);
}));
app.post('/api/leave',employee,wrap(async(req,res)=>{
 const b=req.body;const [from,to]=dateRange({query:{from:b.from_date,to:b.to_date}});const reason=string(b.reason,1000);
 respond(res,await db.transaction(async c=>{await c.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE',[req.user.id]);const overlap=await c.query("SELECT id FROM leave_requests WHERE employee_id=$1 AND status IN ('pending','approved') AND from_date<=$3 AND to_date>=$2",[req.user.id,from,to]);if(overlap.rows.length)error('OVERLAP','لديك طلب متداخل',409);return (await c.query('INSERT INTO leave_requests(employee_id,from_date,to_date,reason) VALUES($1,$2,$3,$4) RETURNING *',[req.user.id,from,to,reason])).rows[0];}));
}));
app.patch('/api/leave/:id',admin,allow('leave.review'),wrap(async(req,res)=>{
 const b=req.body;if(!['approved','rejected'].includes(b.status))error('VALIDATION','قرار غير صالح');const comment=string(b.comment,1000);
 respond(res,await db.transaction(async c=>{
  const row=(await c.query('SELECT l.*,a.name,a.email,a.branch_id FROM leave_requests l JOIN accounts a ON a.id=l.employee_id WHERE l.id=$1 FOR UPDATE OF l',[id(req.params.id)])).rows[0];
  if(!row)error('NOT_FOUND','الطلب غير موجود',404);
  scope(req.user,row.branch_id);
  if(row.status!=='pending')error('CONFLICT','تمت مراجعة الطلب',409);
  await c.query('UPDATE leave_requests SET status=$1,comment=$2,reviewed_by=$3 WHERE id=$4',[b.status,comment,req.user.id,row.id]);
  await audit(c,req.user,'leave.review',row.id,comment,{status:b.status});
  notifications.notifyLeaveUpdate({name:row.name,email:row.email},{...row,comment},b.status).catch(err=>console.error('[Notification Error] Leave update email failed:',err.message));
  return {updated:true};
 }));
}));
app.use((req,res)=>res.status(404).json({success:false,error:'NOT_FOUND',message:'المسار غير موجود'}));
app.use((err,req,res,next)=>{
 const conflict=err.code==='23505',validation=err.code==='23503'||err.code==='23514'||err.type==='entity.parse.failed';
 const status=err.statusCode||(conflict?409:validation?400:500);
 if(status===500)console.error('Request failed:',err.message);
 res.status(status).json({success:false,error:err.isOperational?err.code:'REQUEST_FAILED',message:err.isOperational?err.message:conflict?'السجل موجود مسبقاً':validation?'تحقق من البيانات المدخلة':'تعذر تنفيذ العملية'});
});
module.exports=app;
