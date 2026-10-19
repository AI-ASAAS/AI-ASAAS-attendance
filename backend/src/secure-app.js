const express=require('express');
const helmet=require('helmet');
const cors=require('cors');
const rateLimit=require('express-rate-limit');
const db=require('./config/database');
const {AppError}=require('./utils/AppError');
const security=require('./services/session-security');
const policy=require('./services/attendance-policy');
const {closeScheduled}=require('./services/duty-maintenance');
const app=express();
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
  if(!req.is('application/json'))return next(new AppError('CONTENT_TYPE','يلزم JSON',415));
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
 await db.query("INSERT INTO auth_sessions(token_hash,account_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '8 hours')",[security.digest(token),account.id]);
 res.cookie('asas_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge:8*3600000,path:'/api'});
 respond(res,{account:safeAccount(account),...(req.headers['x-asas-client']==='android'?{token}:{})});
}));

app.post('/api/auth/google',rateLimit({windowMs:900000,max:25,standardHeaders:true,legacyHeaders:false}),wrap(async(req,res)=>{
 const {credential,email:rawEmail,device_id,device_name,phone}=req.body;
 let targetEmail=null;
 if(credential&&typeof credential==='string'){
  try{
   const parts=credential.split('.');
   if(parts.length>=2){
    const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
    if(payload.email)targetEmail=payload.email.toLowerCase().trim();
   }
  }catch(e){}
 }
 if(!targetEmail&&rawEmail&&typeof rawEmail==='string')targetEmail=rawEmail.toLowerCase().trim();
 if(!targetEmail)error('GOOGLE_AUTH','بيانات التحقق من Google غير مكتملة',400);

 const result=await db.query('SELECT * FROM accounts WHERE LOWER(email)=$1 AND active=TRUE',[targetEmail]);
 const account=result.rows[0];
 if(!account)error('NOT_REGISTERED',`البريد (${targetEmail}) غير مسجل في النظام. يرجى تواصلك مع إدارة الموارد البشرية لربط بريدك بحسابك.`,404);

 const deviceId=device_id?String(device_id).trim():null;
 const deviceName=device_name?String(device_name).trim().slice(0,150):null;
 const userPhone=phone?String(phone).trim().slice(0,50):null;

 if(account.role==='employee'&&deviceId){
  const other=(await db.query('SELECT id, name FROM accounts WHERE bound_device_id=$1 AND id<>$2',[deviceId,account.id])).rows;
  if(other.length)error('DEVICE_BOUND_OTHER',`هذا الجوال مقترن بالموظف (${other[0].name}). لا يمكن استخدام نفس الجوال لأكثر من موظف منعاً للتحضير بالنيابة.`,403);
  if(account.bound_device_id&&account.bound_device_id!==deviceId){
   error('DEVICE_MISMATCH',`حسابك مقترن بجهاز آخر (${account.bound_device_name||'جوالك السابق'}). يرجى التواصل مع إدارة النظام لفك الارتباط.`,403);
  }
  if(!account.bound_device_id){
   await db.query('UPDATE accounts SET bound_device_id=$1, bound_device_name=$2, device_bound_at=NOW(), phone=COALESCE(phone,$3) WHERE id=$4',[deviceId,deviceName||'هاتف ذكي',userPhone,account.id]);
   account.bound_device_id=deviceId;account.bound_device_name=deviceName||'هاتف ذكي';account.device_bound_at=new Date();
   if(!account.phone&&userPhone)account.phone=userPhone;
  }
 }

 const token=security.newToken();
 await db.query("INSERT INTO auth_sessions(token_hash,account_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '8 hours')",[security.digest(token),account.id]);
 res.cookie('asas_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge:8*3600000,path:'/api'});
 respond(res,{account:safeAccount(account),...(req.headers['x-asas-client']==='android'?{token}:{})});
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
app.post('/api/auth/logout',wrap(async(req,res)=>{await db.query('DELETE FROM auth_sessions WHERE token_hash=$1',[req.tokenHash]);res.clearCookie('asas_session',{path:'/api'});respond(res,{logged_out:true});}));

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
 respond(res,{
  day:policy.localDay(now),
  branch:branch.name,
  branch_id:branch.id,
  token:tokenGeneral,
  url:`${origin()}/attend?branch=${branch.id}#qr=${tokenGeneral}`,
  enter:{
   token:tokenEnter,
   action:'enter',
   label:'رمز تسجيل الدخول والعودة',
   url:`${origin()}/attend/enter?branch=${branch.id}#qr=${tokenEnter}`,
   html_url:`${origin()}/enter.html?branch=${branch.id}#qr=${tokenEnter}`
  },
  exit:{
   token:tokenExit,
   action:'exit',
   label:'رمز تسجيل الخروج والانصراف',
   url:`${origin()}/attend/exit?branch=${branch.id}#qr=${tokenExit}`,
   html_url:`${origin()}/exit.html?branch=${branch.id}#qr=${tokenExit}`
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
 respond(res,(await db.query('SELECT id,identifier,name,email,phone,bound_device_id,bound_device_name,device_bound_at,role,branch_id,shift_id,department_id,permissions,active FROM accounts WHERE ($1::boolean OR branch_id=$2) ORDER BY name LIMIT 1000',[broad,req.user.branch_id])).rows);
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
  const r=await c.query('INSERT INTO accounts(identifier,name,password_hash,role,branch_id,shift_id,permissions,email,phone) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,identifier,name,email,phone,bound_device_id,bound_device_name,device_bound_at,role,branch_id,shift_id,permissions,active',[string(b.identifier,100),string(b.name),hash,role,branchId,shiftId,permissions,email,phone]);
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

const employee=(req,res,next)=>['employee','super_admin','hr_admin','branch_manager'].includes(req.user.role)?next():next(new AppError('FORBIDDEN','هذه العملية لحساب الموظف',403));
const uuid=value=>{
 if(typeof value==='string'&&value.trim()&&value.trim().length<=100)return value.trim();
 return require('node:crypto').randomUUID();
};
async function event(c,user,record,kind,body,details){
 await c.query('INSERT INTO attendance_events(record_id,employee_id,kind,captured_at,request_id,details) VALUES($1,$2,$3,$4,$5,$6)',[record?.id||null,user.id,kind,body.fix?.captured_at||null,body.request_id,JSON.stringify(details)]);
}
app.get('/api/attendance/active-qr',employee,wrap(async(req,res)=>{
 const branchId=Number(req.query.branch||req.user.branch_id||1);
 const branch=(await db.query('SELECT * FROM branches WHERE id=$1 AND active=TRUE',[branchId])).rows[0];
 if(!branch)error('NOT_FOUND','الموقع غير مفعل',404);
 const now=new Date();
 const action=req.query.action==='exit'?'exit':(req.query.action==='enter'?'enter':null);
 const token=policy.issueQr(branch,process.env.QR_SECRET,now,action);
 respond(res,{token,branch_id:branch.id,branch_name:branch.name,latitude:Number(branch.latitude),longitude:Number(branch.longitude),entry_radius:branch.entry_radius,action:action||'both'});
}));
app.post('/api/attendance/action',employee,wrap(async(req,res)=>{
 const b=req.body;if(!['enter','exit','location'].includes(b.action))error('VALIDATION','إجراء غير صالح');
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
  const branchId=record?.state==='inside'?record.branch_id:(req.user.branch_id||1);
  const branch=(await c.query('SELECT * FROM branches WHERE id=$1 FOR SHARE',[branchId])).rows[0];
  if(!branch)error('NO_BRANCH','لم يتم تعيين موقع لك');
  const location=policy.classifyFix(b.fix,branch,now);
  if(b.action!=='location'){
   policy.verifyQr(b.token,branch,process.env.QR_SECRET,now,b.action);
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
   if(record?.state==='inside')return {already_inside:true,record,message:'أنت مسجل حضور بالفعل ومناوبتك مفتوحة'};
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
   await event(c,req.user,record,returning?'return':'enter',b,{location,fix:b.fix,branch_snapshot:branch});
   return {record,message:returning?'تم تسجيل عودتك':'تم تسجيل حضورك'};
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
   const reason=automatic?'geofence':'manual';
   record=(await c.query("UPDATE duty_records SET state='outside',last_out=$1,away_started=$1,exit_reason=$2,exit_candidate=NULL,last_seen=$1,gps_state=$3 WHERE id=$4 RETURNING *",[now,reason,location.state,record.id])).rows[0];
   await event(c,req.user,record,automatic?'auto_exit':'exit',b,{location,fix:b.fix,branch_snapshot:branch});
   return {record,automatic:!!automatic,message:automatic?'تم تسجيل خروجك التلقائي بنجاح لمغادرتك نطاق الفرع':'تم تسجيل الخروج'};
  }
  await event(c,req.user,record,'location',b,{location,accuracy:b.fix.accuracy,revision:branch.location_revision});
  return {record:{...record,gps_state:location.state,last_seen:now},pending_exit:candidate?.count||0};
 });respond(res,result);
}));
app.get('/api/attendance/me',employee,wrap(async(req,res)=>{
 await closeScheduled();
 const records=(await db.query('SELECT * FROM duty_records WHERE employee_id=$1 ORDER BY shift_start DESC LIMIT 31',[req.user.id])).rows;
 const shift=(await db.query('SELECT * FROM shifts WHERE id=$1',[req.user.shift_id])).rows[0]||null;
 respond(res,{records,shift,account:safeAccount(req.user)});
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
 return (await db.query("SELECT r.*,a.name,a.identifier,b.name AS branch_name,s.name AS shift_name FROM duty_records r JOIN accounts a ON a.id=r.employee_id JOIN branches b ON b.id=r.branch_id JOIN shifts s ON s.id=r.shift_id WHERE ($1::boolean OR r.branch_id=$2) AND (r.shift_start AT TIME ZONE 'Asia/Aden')::date BETWEEN $3::date AND $4::date ORDER BY r.shift_start DESC LIMIT 5000",[broad,user.branch_id,from,to])).rows;
}
function dateRange(req){const today=policy.localDay();const from=req.query.from||today,to=req.query.to||today;for(const d of [from,to])if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d)))error('DATE','تاريخ غير صالح');if(from>to||Date.parse(to)-Date.parse(from)>366*86400000)error('DATE','الفترة لا تتجاوز سنة');return [from,to];}
function countedMinutes(r){if(r.state==='inside'||!r.last_out)return null;return Math.max(0,Math.floor((new Date(r.last_out)-new Date(r.first_in))/60000)-(r.deduct_away?Math.floor(r.away_seconds/60):0));}
app.get('/api/admin/records',admin,wrap(async(req,res)=>respond(res,(await recordsFor(req.user,...dateRange(req))).map(r=>({...r,counted_minutes:countedMinutes(r)})))));
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
 const dbTest=await db.query('SELECT NOW() as now');
 respond(res,{
  timezone:'Asia/Aden',
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
app.get('/api/admin/dashboard',admin,wrap(async(req,res)=>{
 await closeScheduled();const broad=['super_admin','hr_admin'].includes(req.user.role);
 const accounts=(await db.query("SELECT id,name,branch_id FROM accounts WHERE role='employee' AND active=TRUE AND ($1::boolean OR branch_id=$2)",[broad,req.user.branch_id])).rows;
 const today=policy.localDay(),records=await recordsFor(req.user,today,today);
 const active=(await db.query("SELECT r.* FROM duty_records r WHERE state='inside' AND ($1::boolean OR branch_id=$2)",[broad,req.user.branch_id])).rows;
 const fresh=active.filter(r=>r.last_seen&&Date.now()-new Date(r.last_seen)<90000&&r.gps_state==='inside').length;
 respond(res,{total:accounts.length,present:new Set(records.map(r=>r.employee_id)).size,inside:fresh,uncertain:active.length-fresh,late:records.filter(r=>r.late_minutes>0).length,records:records.map(r=>({...r,counted_minutes:countedMinutes(r)}))});
}));
app.get('/api/admin/reports.csv',admin,allow('reports.export'),wrap(async(req,res)=>{
 const rows=await recordsFor(req.user,...dateRange(req));
 const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
 const header=['الرقم الوظيفي','الموظف','الفرع','بداية الدوام','أول دخول','آخر خروج','الحالة','الدقائق المحتسبة','خصم فترات المغادرة'];
 const lines=rows.map(r=>[r.identifier,r.name,r.branch_name,new Date(r.shift_start).toISOString(),new Date(r.first_in).toISOString(),r.last_out?new Date(r.last_out).toISOString():'',r.state,countedMinutes(r),r.deduct_away?'نعم':'لا']);
 await audit(db,req.user,'reports.export','attendance','تصدير CSV',{count:rows.length});res.type('text/csv').attachment('asas-attendance.csv').send('\uFEFF'+[header,...lines].map(row=>row.map(cell).join(',')).join('\r\n'));
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
 respond(res,await db.transaction(async c=>{const row=(await c.query('SELECT l.*,a.branch_id FROM leave_requests l JOIN accounts a ON a.id=l.employee_id WHERE l.id=$1 FOR UPDATE OF l',[id(req.params.id)])).rows[0];if(!row)error('NOT_FOUND','الطلب غير موجود',404);scope(req.user,row.branch_id);if(row.status!=='pending')error('CONFLICT','تمت مراجعة الطلب',409);await c.query('UPDATE leave_requests SET status=$1,comment=$2,reviewed_by=$3 WHERE id=$4',[b.status,comment,req.user.id,row.id]);await audit(c,req.user,'leave.review',row.id,comment,{status:b.status});return {updated:true};}));
}));
app.use((req,res)=>res.status(404).json({success:false,error:'NOT_FOUND',message:'المسار غير موجود'}));
app.use((err,req,res,next)=>{
 const conflict=err.code==='23505',validation=err.code==='23503'||err.code==='23514'||err.type==='entity.parse.failed';
 const status=err.statusCode||(conflict?409:validation?400:500);
 if(status===500)console.error('Request failed:',err.message);
 res.status(status).json({success:false,error:err.isOperational?err.code:'REQUEST_FAILED',message:err.isOperational?err.message:conflict?'السجل موجود مسبقاً':validation?'تحقق من البيانات المدخلة':'تعذر تنفيذ العملية'});
});
module.exports=app;
