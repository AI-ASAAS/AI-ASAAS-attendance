'use client';
import React, {useState,useEffect,useCallback,useRef} from 'react';
import {LayoutDashboard,Users,MapPin,QrCode,Clock3,CalendarDays,FileText,File,ShieldCheck,LogOut,Menu,X,Plus,RefreshCw,Download,ArrowUpLeft,Search,Building2,Signal,CheckCircle2,AlertCircle,Printer,Settings2,LogIn,Smartphone,Mail,Phone,KeyRound,ShieldAlert,Unlock,Camera} from 'lucide-react';
import {QRCodeSVG} from 'qrcode.react';
import {getDeviceId,getDeviceName} from '../../utils/device';

async function api(path, method = 'GET', body, retries = 2) {
  let attempt = 0;
  while (true) {
    try {
      const r = await fetch(`/api${path}`, {
        method,
        credentials: 'same-origin',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store'
      });

      let value = null;
      const contentType = r.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try { value = await r.json(); } catch {}
      } else {
        try {
          const text = await r.text();
          try { value = JSON.parse(text); } catch {}
        } catch {}
      }

      if (!r.ok) {
        if ([502, 503, 504].includes(r.status) && attempt < retries) {
          attempt++;
          await new Promise(res => setTimeout(res, 800 * attempt));
          continue;
        }
        const msg = value?.message || value?.error || (r.status === 401 ? 'يرجى تسجيل الدخول' : 'تعذر الاتصال بالخادم');
        throw Object.assign(new Error(msg), { status: r.status });
      }

      return value ? value.data : null;
    } catch (netErr) {
      if (attempt < retries && (!netErr.status || [502, 503, 504].includes(netErr.status))) {
        attempt++;
        await new Promise(res => setTimeout(res, 800 * attempt));
        continue;
      }
      if (!netErr.status) {
        throw Object.assign(new Error('تعذر الاتصال بخادم أساس وقاعدة البيانات'), { status: 0 });
      }
      throw netErr;
    }
  }
}
const today=()=>{
 try { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Aden'}).format(new Date()); }
 catch(_) { return new Date().toISOString().slice(0,10); }
};
const time=v=>{
 if(!v) return '—';
 try {
  const d = new Date(v);
  if(isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('ar-YE',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Aden'});
 } catch(_) { return '—'; }
};
const date=v=>{
 if(!v) return '—';
 try {
  const d = new Date(v);
  if(isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ar-YE',{timeZone:'Asia/Aden'});
 } catch(_) { return '—'; }
};
const states={inside:'حضور مفتوح',outside:'تم الخروج',closed:'مغلق',pending:'قيد المراجعة',approved:'مقبولة',rejected:'مرفوضة'};
const roles={super_admin:'مدير النظام',hr_admin:'الموارد البشرية',branch_manager:'مدير الفرع',viewer:'للعرض فقط',employee:'موظف'};
const tabs=[['dashboard','نظرة عامة',LayoutDashboard],['records','الحضور والانصراف',CalendarDays],['accounts','الموظفون والأجهزة',Users],['branches','المواقع والفروع',MapPin],['qr','رموز QR المعتمدة',QrCode],['shifts','الدوام والاحتساب',Clock3],['leave','الإجازات',FileText],['audit','سجل العمليات',ShieldCheck],['settings','إعدادات النظام',Settings2]];
const permissions={'employees.read':'عرض الموظفين','employees.write':'إدارة الموظفين','locations.write':'تعديل المواقع','qr.manage':'إدارة QR','shifts.write':'الدوام والاحتساب','reports.export':'تصدير التقارير','attendance.edit':'تصحيح الحضور','leave.review':'مراجعة الإجازات','audit.read':'سجل العمليات'};
const defaults={branches:{name:'',latitude:'',longitude:'',entry_radius:80,exit_radius:120,max_accuracy:30,exit_samples:3,exit_delay_seconds:120,active:true,reason:''},shifts:{name:'',start_time:'08:00',end_time:'16:00',work_days:[0,1,2,3,4],grace_minutes:15,close_policy:'actual_exit',deduct_away:false,reason:''},accounts:{name:'',identifier:'',email:'',phone:'',password:'',role:'employee',branch_id:'',shift_id:'',permissions:[]},records:{first_in:'',last_out:'',state:'closed',exit_reason:'انتهاء ساعات الدوام الرسمي في الموعد',deduct_away:false,reason:''}};
function Brand(){return <div className="asas-logo"><span className="asas-mark"><img src="/brand/asas-logo.png" alt="شعار أساس"/></span><div><strong>أساس</strong><small>نظام إدارة الحضور</small></div></div>;}
function Button({children,icon:Icon,variant='',...props}){return <button className={`asas-btn ${variant}`} {...props}>{Icon&&<Icon/>}{children}</button>;}
function Badge({state}){return <span className={`asas-badge ${state}`}>{states[state]||state}</span>;}
function Empty({children='لا توجد سجلات بعد'}){return <div className="asas-empty"><FileText/>{children}</div>;}
function Field({label,children,...props}){return <label className="asas-label">{label}{children||<input className="asas-input" {...props}/>}</label>;}
function Records({rows=[],onEdit,canEdit}){
 const list = Array.isArray(rows) ? rows : [];
 if (!list.length) return <Empty/>;
 return <div className="asas-table-wrap"><table className="asas-table"><thead><tr>{['الموظف','الفرع','الدوام','أول دخول','آخر خروج','الحالة التلقائية','سبب الخروج التلقائي','الاحتساب',...(canEdit?['إجراء']:[] )].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{list.map((r, idx)=>{
 const isInside = r.state === 'inside';
 const isEarly = r.status_key === 'early_exit';
 const isLate = r.status_key && typeof r.status_key === 'string' && r.status_key.startsWith('late');
 const statusLabel = r.status_label || (isInside ? 'حاضر في الموعد' : 'تم الانصراف');
 const rawExitReason = r.exit_reason_label || (isInside ? 'قيد الدوام (على رأس العمل)' : ({geofence:'مغادرة نطاق الموقع تلقائياً (GPS)',manual:'انتهاء ساعات الدوام الرسمي في الموعد',scheduled:'انتهاء فترة المناوبة المجدولة تلقائياً',admin_correction:'تصحيح إداري'}[r.exit_reason]||r.exit_reason||'انتهاء الدوام الرسمي'));
 const exitReasonLabel = String(rawExitReason || '—');

 return <tr key={r.id || ('rec-' + idx)}>
  <td><strong>{r.name}</strong><small>{r.identifier}</small></td>
  <td>{r.branch_name}</td>
  <td>{date(r.shift_start)}</td>
  <td><span style={{color:'#2d6a4f',fontWeight:600}}>{time(r.first_in)}</span></td>
  <td><span style={{color:isInside?'#856404':'#231f20'}}>{time(r.last_out)}</span></td>
  <td>
   <span className={`asas-badge ${isInside ? 'inside' : 'outside'}`} style={{
     display:'inline-flex',
     alignItems:'center',
     gap:4,
     background: isInside ? (isLate ? '#fff3cd' : '#eaf4ee') : (isEarly ? '#ffe8cc' : '#f5f3f0'),
     color: isInside ? (isLate ? '#856404' : '#2d6a4f') : (isEarly ? '#d9480f' : '#474143'),
     fontWeight: 600
   }}>
     {isInside ? (isLate ? <Clock3 size={12}/> : <CheckCircle2 size={12}/>) : <LogOut size={12}/>}
     {statusLabel}
   </span>
  </td>
  <td>
   <span style={{
     fontSize:12,
     color: isInside ? '#736d65' : (exitReasonLabel.includes('مبكر') ? '#c92a2a' : (exitReasonLabel.includes('إضافي') ? '#1e7e34' : '#2b8a3e')),
     fontWeight: exitReasonLabel.includes('مبكر') || exitReasonLabel.includes('إضافي') ? 600 : 500,
     display:'inline-block'
   }}>
     {exitReasonLabel}
   </span>
  </td>
  <td>{r.counted_minutes==null?'مفتوح':`${r.counted_minutes} دقيقة`}<small>{r.deduct_away?'مع خصم المغادرة':'دون خصم المغادرة'}</small></td>
  {canEdit&&<td><Button onClick={()=>onEdit(r)}>تصحيح</Button></td>}
 </tr>;
})}</tbody></table></div>;
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="asas-app" style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',padding:20}}>
          <div className="asas-card" style={{maxWidth:500,width:'100%',padding:24,textAlign:'center'}}>
            <Brand/>
            <h2 style={{color:'#c92a2a',marginTop:16}}>حدث خطأ أثناء عرض الصفحة</h2>
            <p className="asas-muted" style={{marginTop:8}}>
              {this.state.error?.message || 'تعذر استكمال العرض. تم تسجيل الخطأ لحمايتك.'}
            </p>
            <div style={{marginTop:20,display:'flex',gap:10,justifyContent:'center'}}>
              <Button variant="primary" onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>
                🔄 إعادة تحميل الصفحة
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AsasAppInner(){
 const [user,setUser]=useState(null),[boot,setBoot]=useState(true),[tab,setTab]=useState('dashboard'),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[open,setOpen]=useState(false),[notice,setNotice]=useState('');
 const [modal,setModal]=useState(null),[form,setForm]=useState({}),[branches,setBranches]=useState([]),[shifts,setShifts]=useState([]),[qr,setQr]=useState(null),[branchId,setBranchId]=useState(''),[from,setFrom]=useState(today),[to,setTo]=useState(today),[search,setSearch]=useState('');
 const [liveTime,setLiveTime]=useState('');
 useEffect(()=>{
  const update=()=>setLiveTime(new Intl.DateTimeFormat('ar-YE',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Aden'}).format(new Date()));
  update();
  const id=setInterval(update,1000);
  return()=>clearInterval(id);
 },[]);
 const can=p=>user?.role==='super_admin'||user?.permissions?.includes(p);
  const checkAuth = useCallback(async (isManual = false) => {
    if (isManual) setBusy(true);
    let attempts = 0;
    const maxAttempts = isManual ? 1 : 3;
    while (attempts < maxAttempts) {
      attempts++;
      try {
        const u = await api('/auth/me');
        setUser(u);
        setError('');
        setBoot(false);
        if (isManual) setBusy(false);
        return;
      } catch (e) {
        if (e.status === 401) {
          setUser(null);
          setError('');
          setBoot(false);
          if (isManual) setBusy(false);
          return;
        }
        if (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 1000));
        } else {
          const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
          const msg = isVercel
            ? 'تعذر الاتصال بالخادم عبر الرابط السحابي. يرجى استخدام الرابط المحلي المستقر: http://localhost:3000/asas'
            : 'تعذر الاتصال بالخادم. تحقق من تشغيل خدمة أساس وقاعدة البيانات.';
          setError(msg);
          setBoot(false);
          if (isManual) setBusy(false);
        }
      }
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Periodic Auto-Healing Reconnect (checks every 4s if in error state to auto-clear error once online)
  useEffect(() => {
    if (!error || user) return;
    const interval = setInterval(() => {
      api('/auth/me').then(u => {
        setUser(u);
        setError('');
      }).catch(e => {
        if (e.status === 401) {
          setUser(null);
          setError('');
        }
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [error, user]);
 const load=useCallback(async()=>{
  if(!user||user.role==='employee')return;setBusy(true);setError('');
  try{
   const path=tab==='qr'?'/admin/branches':tab==='leave'?'/leave':tab==='records'?`/admin/records?from=${from}&to=${to}`:tab==='settings'?'/admin/settings':`/admin/${tab}`;
   const result=await api(path);setData(result);
   if(tab==='branches'||tab==='qr')setBranches(result);
  }catch(e){setData(null);setError(e.message);if(e.status===401)setUser(null);}finally{setBusy(false);}
 },[user,tab,from,to]);
 useEffect(()=>{
  load();
  const timer=setInterval(load,6000);
  const onVisible=()=>{if(document.visibilityState==='visible')load();};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{
   clearInterval(timer);
   document.removeEventListener('visibilitychange',onVisible);
  };
 },[load]);
 useEffect(()=>{setQr(null);},[branchId]);
 async function logout(){try{await api('/auth/logout','POST',{});setUser(null);}catch(e){setError(e.message);}}
 async function edit(kind,item){
  setError('');setNotice('');
  if(kind==='records'){
   const isoLocal = d => d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset()*60000).toISOString().slice(0, 16) : '';
   setForm({
    id: item.id,
    name: item.name,
    first_in: isoLocal(item.first_in),
    last_out: isoLocal(item.last_out),
    state: item.state,
    exit_reason: item.exit_reason || 'admin_correction',
    deduct_away: Boolean(item.deduct_away),
    reason: ''
   });
   setModal('records');
   return;
  }
  setForm({...defaults[kind],...item,reason:''});setModal(kind);
  if(kind==='accounts'){try{const [b,s]=await Promise.all([api('/admin/branches'),api('/admin/shifts')]);setBranches(b);setShifts(s);}catch(e){setError(e.message);}}
 }
 async function save(e){e.preventDefault();setBusy(true);setError('');try{
  if(modal==='records'){
   const body={
    first_in: form.first_in ? new Date(form.first_in).toISOString() : undefined,
    last_out: form.last_out ? new Date(form.last_out).toISOString() : null,
    state: form.state,
    exit_reason: form.exit_reason,
    deduct_away: form.deduct_away,
    reason: form.reason
   };
   await api(`/admin/records/${form.id}`, 'PATCH', body);
   setModal(null);setNotice('تم حفظ تصحيح الحضور وتوثيقه في سجل العمليات');await load();return;
  }
  const body={...form};if(modal==='branches'){for(const k of ['latitude','longitude','entry_radius','exit_radius','max_accuracy','exit_samples','exit_delay_seconds'])body[k]=Number(body[k]);}
  if(modal==='shifts')body.grace_minutes=Number(body.grace_minutes);
  if(modal==='accounts'){body.branch_id=body.branch_id?Number(body.branch_id):null;body.shift_id=body.shift_id?Number(body.shift_id):null;if(body.id){delete body.role;if(!body.password)delete body.password;delete body.bound_device_id;delete body.bound_device_name;delete body.device_bound_at;}}
  await api(`/admin/${modal}${body.id?`/${body.id}`:''}`,body.id?(modal==='accounts'?'PATCH':'PUT'):'POST',body);
  setModal(null);setNotice('تم حفظ التغييرات وتوثيقها في سجل العمليات');await load();
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 async function showQr(){setBusy(true);try{setQr(await api(`/admin/branches/${branchId}/qr`));setError('');}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function exportCsv(){setBusy(true);try{const r=await fetch(`/api/admin/reports.csv?from=${from}&to=${to}`,{credentials:'same-origin'});if(!r.ok)throw new Error('تعذر تصدير التقرير');const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=url;a.download=`asas-${from}-${to}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function exportWord(){setBusy(true);try{const r=await fetch(`/api/admin/reports.doc?from=${from}&to=${to}`,{credentials:'same-origin'});if(!r.ok)throw new Error('تعذر تصدير تقرير Word');const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=url;a.download=`تقرير-حضور-أساس-${from}-${to}.doc`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function exportTxt(){setBusy(true);try{const r=await fetch(`/api/admin/reports.txt?from=${from}&to=${to}`,{credentials:'same-origin'});if(!r.ok)throw new Error('تعذر تصدير التقرير النصي');const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=url;a.download=`تقرير-حضور-أساس-${from}-${to}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(e.message);}finally{setBusy(false);}}
 if(boot)return <div className="asas-app"><Empty>جارٍ التحقق من الجلسة…</Empty></div>;
 if(!user)return <Login onLogin={setUser} initialError={error} onRetry={() => checkAuth(true)}/>;
 if(user.role==='employee')return <Employee user={user} logout={logout}/>;
 const title=tabs.find(t=>t[0]===tab)?.[1];
 const rows=Array.isArray(data)?data:[];
 const set=(k,value)=>setForm(f=>({...f,[k]:value}));
 return <div className="asas-app">
  {open&&<div className="asas-modal-backdrop" style={{background:'rgba(35,31,32,0.4)',zIndex:25}} onClick={()=>setOpen(false)}/>}
  <aside className={`asas-sidebar ${open?'open':''}`}><Brand/><p className="asas-nav-label">مساحة إدارة الفريق</p><nav className="asas-nav">{tabs.filter(([key])=>key!=='accounts'||can('employees.read')).filter(([key])=>key!=='audit'||can('audit.read')).map(([key,label,Icon])=><button className={tab===key?'active':''} key={key} onClick={()=>{setTab(key);setOpen(false);setData(null);setNotice('');setSearch('');}}><Icon/>{label}</button>)}</nav><div className="asas-sidebar-foot"><div className="asas-profile"><span className="asas-avatar">{(user?.name || user?.identifier || 'أ')[0] || 'أ'}</span><div><strong>{user.name}</strong><p>{roles[user.role]}</p></div></div><Button icon={LogOut} onClick={logout}>تسجيل الخروج</Button></div></aside>
  <div className="asas-main"><header className="asas-topbar"><div className="asas-actions"><button className="asas-btn asas-menu" aria-label="القائمة" onClick={()=>setOpen(!open)}><Menu size={18}/></button><span>مساحة العمل / <strong>{title}</strong></span></div><span>{new Date().toLocaleDateString('ar-YE',{weekday:'long',day:'numeric',month:'long',timeZone:'Asia/Aden'})} · {liveTime||'—'} · توقيت صنعاء (اليمن)</span></header>
  <main className="asas-content"><div className="asas-heading"><div><p className="asas-eyebrow">أساس · إدارة الحضور</p><h1>{title}</h1><p className="asas-muted">حضور واضح، إدارة أدق، وفريق أكثر اتصالاً.</p></div><div className="asas-actions"><Button icon={RefreshCw} onClick={load} disabled={busy}>تحديث</Button>{['branches','shifts','accounts'].includes(tab)&&can({branches:'locations.write',shifts:'shifts.write',accounts:'employees.write'}[tab])&&<Button variant="primary" icon={Plus} onClick={()=>edit(tab)}>إضافة {tab==='branches'?'موقع':tab==='shifts'?'دوام':'موظف'}</Button>}</div></div>
  {error&&<div role="alert" className="asas-notice error" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><span>{error}</span><Button type="button" icon={RefreshCw} onClick={load} disabled={busy} style={{padding:'4px 10px',fontSize:12}}>إعادة المحاولة</Button></div>}{notice&&<div role="status" className="asas-notice">{notice}</div>}
  {busy&&!data&&<Empty>جارٍ تحميل البيانات…</Empty>}
   {tab==='dashboard'&&data&&<><section className="asas-banner"><div className="asas-banner-copy"><p className="asas-eyebrow">كل يوم يبدأ من أساس</p><h2>صورة أوضح ليوم فريقك.</h2><p>تابع الحضور والمواقع من مساحة واحدة مصممة لك.</p><Button variant="gold" icon={QrCode} onClick={()=>setTab('qr')}>عرض الرموز المعتمدة</Button></div><div className="asas-banner-emblem" aria-hidden="true"><img src="/brand/asas-logo.png" alt=""/><span>ذكاء أكثر سيادة</span></div></section><section className="asas-stats">{[[Users,'إجمالي الموظفين',data.total,'الحسابات النشطة'],[CheckCircle2,'سجّلوا الحضور',data.present,'خلال اليوم الحالي'],[MapPin,'داخل النطاق',data.inside,'حسب آخر موقع حديث'],[AlertCircle,'الموقع غير مؤكد',data.uncertain,'تحتاج اتصالاً أو قراءة أدق']].map(([Icon,label,value,caption])=><article className="asas-stat" key={label}><div className="asas-stat-top">{label}<Icon/></div><strong>{value}</strong><small>{caption}</small></article>)}</section><section className="asas-grid"><article className="asas-card"><div className="asas-card-head"><h2>حضور اليوم</h2><span className="asas-badge">{data.total?Math.round(data.present/data.total*100):0}%</span></div><div className="asas-card-body"><p className="asas-muted">نسبة الموظفين الذين سجلوا دخولهم اليوم</p><div className="asas-progress"><span style={{width:`${data.total?Math.min(100,data.present/data.total*100):0}%`}}/></div><div className="asas-mini-row"><span>لم يسجلوا حضوراً اليوم</span><strong>{Math.max(0,data.total-data.present)}</strong></div><div className="asas-mini-row"><span>حالات التأخير</span><strong>{data.late}</strong></div><p className="asas-help">عدم التسجيل لا يعني غياباً نهائياً؛ يراجع وفق جدول الموظف وإجازاته.</p></div></article><article className="asas-card"><div className="asas-card-head"><h2>إدارة موقع العمل</h2><Building2 size={18}/></div><div className="asas-card-body"><p className="asas-muted">اضبط حدود الشركة ودقة الموقع وفترة التحقق قبل الخروج التلقائي.</p><div className="asas-mini-row"><span>رمز الحضور</span><span>دائم ومستمر</span></div><div className="asas-mini-row"><span>سياسة الاحتساب</span><span>حسب جدول الموظف</span></div><Button icon={ArrowUpLeft} onClick={()=>setTab('branches')}>إدارة المواقع</Button></div></article></section><section className="asas-card"><div className="asas-card-head"><h2>آخر سجلات الحضور</h2><Button onClick={()=>setTab('records')}>جميع السجلات</Button></div><Records rows={data.records.slice(0,10)} onEdit={r=>edit('records',r)} canEdit={can('attendance.edit')}/></section></>}
   {tab==='records'&&<><div className="asas-search" style={{flexWrap:'wrap',gap:8}}><Field label="من تاريخ" type="date" value={from} onChange={e=>setFrom(e.target.value)}/><Field label="إلى تاريخ" type="date" value={to} onChange={e=>setTo(e.target.value)}/>{can('reports.export')&&<div className="asas-actions" style={{display:'inline-flex',gap:6,alignItems:'flex-end'}}><Button icon={Download} disabled={busy} onClick={exportCsv}>تصدير Excel/CSV</Button><Button icon={FileText} disabled={busy} onClick={exportWord}>تصدير Word</Button><Button icon={File} disabled={busy} onClick={exportTxt}>تصدير نصي (TXT)</Button></div>}</div><div className="asas-card"><Records rows={rows} onEdit={r=>edit('records',r)} canEdit={can('attendance.edit')}/></div></>}
    {tab==='branches'&&<div className="asas-form-grid">{rows.map(b=><article className="asas-card" key={b.id}><div className="asas-card-head"><h2>{b.name}</h2><span className="asas-badge">{b.active?'مفعل':'متوقف'}</span></div><div className="asas-card-body"><div className="asas-mini-row"><span>نطاق الدخول / الخروج</span><strong>{b.entry_radius} / {b.exit_radius} م</strong></div><div className="asas-mini-row"><span>أقصى هامش خطأ</span><strong>{b.max_accuracy} م</strong></div><div className="asas-mini-row"><span>تأكيد المغادرة</span><strong>{b.exit_samples} قراءات / {b.exit_delay_seconds} ثانية</strong></div><p className="asas-help" dir="ltr">{b.latitude}, {b.longitude}</p><iframe className="asas-map" src={`https://maps.google.com/maps?q=${b.latitude},${b.longitude}&hl=ar&z=17&output=embed`} loading="lazy" title={`خريطة Google - ${b.name}`} allowFullScreen/><div className="asas-actions" style={{marginTop:15}}>{can('locations.write')&&<Button icon={MapPin} variant="gold" onClick={async()=>{if(!navigator.geolocation)return setError('خدمة تحديد الموقع غير مدعومة');setBusy(true);setError('');navigator.geolocation.getCurrentPosition(async(pos)=>{try{await api(`/admin/branches/${b.id}`,'PUT',{...b,latitude:pos.coords.latitude,longitude:pos.coords.longitude,reason:'تحديث إحداثيات الفرع إلى موقع الجهاز الحالي'});setNotice(`تم تعيين موقع الفرع بنجاح على إحداثيات جهازك الحالية (${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)})`);await load();}catch(e){setError(e.message);}finally{setBusy(false);}},(err)=>{setError('تعذر قراءة الموقع: '+err.message);setBusy(false);},{enableHighAccuracy:true,timeout:15000});}}>تعيين الفرع على موقعي الحالي</Button>}{can('locations.write')&&<Button icon={Settings2} onClick={()=>edit('branches',b)}>تعديل الموقع</Button>}<a className="asas-btn" href={`https://www.google.com/maps?q=${b.latitude},${b.longitude}`} target="_blank" rel="noreferrer">فتح في Google Maps</a></div></div></article>)}{!rows.length&&!busy&&<Empty>أضف موقع الشركة الفعلي للبدء. لا توجد إحداثيات تجريبية.</Empty>}</div>}
   {tab==='shifts'&&<><div className="asas-notice">تغيير سياسة الإغلاق أو الخصم يطبّق على المناوبات الجديدة؛ تحتفظ المناوبات السابقة بسياستها الأصلية.</div><div className="asas-form-grid">{rows.map(s=><article className="asas-card" key={s.id}><div className="asas-card-head"><h2>{s.name}</h2><Clock3 size={18}/></div><div className="asas-card-body"><div className="asas-mini-row"><span>وقت الدوام</span><strong dir="ltr">{s.start_time.slice(0,5)} — {s.end_time.slice(0,5)}</strong></div><div className="asas-mini-row"><span>نهاية الدوام</span><strong>{s.close_policy==='scheduled'?'إغلاق تلقائي':'انتظار الخروج الفعلي'}</strong></div><div className="asas-mini-row"><span>خصم مدد المغادرة</span><strong>{s.deduct_away?'مفعّل':'غير مفعّل'}</strong></div>{can('shifts.write')&&<Button onClick={()=>edit('shifts',s)}>تعديل السياسة</Button>}</div></article>)}{!rows.length&&!busy&&<Empty>أضف جدول الدوام وحدد سياسة الاحتساب.</Empty>}</div></>}
   {tab==='accounts'&&<><div className="asas-search"><Search size={18}/><input className="asas-input" aria-label="البحث عن موظف" placeholder="ابحث بالاسم أو الرقم الوظيفي أو البريد أو الهاتف…" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="asas-card asas-table-wrap"><table className="asas-table"><thead><tr><th>الموظف</th><th>حالة الحضور اليوم</th><th>البريد والهاتف</th><th>الجهاز المقيد</th><th>الصلاحية</th><th>الحساب</th><th>الإجراء</th></tr></thead><tbody>{rows.filter(a=>`${a.name} ${a.identifier} ${a.email||''} ${a.phone||''}`.includes(search)).map(a=><tr key={a.id}><td><strong>{a.name}</strong><small>{a.identifier}</small></td><td>{a.attendance_status==='inside'?(<div><span className="asas-badge inside" style={{display:'inline-flex',alignItems:'center',gap:4}}><CheckCircle2 size={12}/>حاضر الآن</span>{a.today_first_in&&<small style={{display:'block',color:'#2d6a4f',fontSize:10}}>دخول: {time(a.today_first_in)}</small>}</div>):a.attendance_status==='outside'?(<div><span className="asas-badge outside" style={{display:'inline-flex',alignItems:'center',gap:4}}><LogOut size={12}/>تم الانصراف</span>{a.today_last_out&&<small style={{display:'block',color:'#736d65',fontSize:10}}>خروج: {time(a.today_last_out)}</small>}</div>):a.attendance_status==='leave'?(<span className="asas-badge pending" style={{display:'inline-flex',alignItems:'center',gap:4}}><CalendarDays size={12}/>في إجازة</span>):(<span className="asas-badge" style={{background:'#f5f3f0',color:'#736d65',display:'inline-flex',alignItems:'center',gap:4}}><AlertCircle size={12}/>لم يسجل اليوم</span>)}</td><td><div><strong>{a.email||'—'}</strong><small style={{display:'block'}}>{a.phone||'—'}</small></div></td><td>{a.bound_device_id?<div><span className="asas-badge inside" style={{display:'inline-flex',alignItems:'center',gap:4}}><Smartphone size={12}/>{a.bound_device_name||'جوال مقيد'}</span><small style={{display:'block',color:'#736d65',fontSize:10}} dir="ltr">{a.bound_device_id.slice(0,12)}…</small></div>:<span className="asas-badge outside">غير مقيد</span>}</td><td>{roles[a.role]}</td><td><span className={`asas-badge ${a.active?'inside':'outside'}`}>{a.active?'نشط':'معطّل'}</span></td><td><div className="asas-actions">{can('employees.write')&&<Button onClick={()=>edit('accounts',a)}>إدارة</Button>}{can('employees.write')&&a.bound_device_id&&<Button variant="danger" title="فك ارتباط هذا الجوال ليتمكن الموظف من تسجيل الدخول من جهاز جديد" onClick={async()=>{if(window.confirm(`هل أنت متأكد من فك ارتباط الجهاز للموظف (${a.name})؟ سيتمكن من ربط جوال جديد عند أول تسجيل دخول.`)){try{await api(`/admin/accounts/${a.id}/reset-device`,'POST',{reason:'فك قيد الجهاز بطلب من الإدارة'});setNotice(`تم فك قيد الجهاز للموظف ${a.name} بنجاح`);await load();}catch(e){setError(e.message);}}}}><Unlock size={14}/>فك الجهاز</Button>}</div></td></tr>)}</tbody></table>{!rows.length&&!busy&&<Empty/>}</div></>}
    {tab==='qr'&&<div className="asas-card"><div className="asas-card-head"><h2>رموز الحضور والانصراف المعتمدة</h2><span className="asas-badge">رمز دائم وثابت · توقيت صنعاء (اليمن)</span></div><div className="asas-card-body"><div className="asas-search"><select className="asas-input" aria-label="الفرع" value={branchId} onChange={e=>setBranchId(e.target.value)}><option value="">اختر الفرع</option>{branches.filter(b=>b.active).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><Button variant="primary" onClick={showQr} disabled={!branchId||busy}>عرض الرموز المعتمدة</Button></div>
    {qr ? (
       <div className="asas-qr-poster">
        {(()=>{
          const fixUrl=(u)=>{
           if(!u)return '';
           if(typeof window==='undefined')return u;
           try{
            const p=new URL(u,window.location.origin);
            if(p.hostname==='localhost'||p.hostname==='127.0.0.1'){
             return `${window.location.origin}${p.pathname}${p.search}${p.hash}`;
            }
            return p.toString();
           }catch(e){return u;}
          };
          const autoUrl=fixUrl(qr.auto?.url || qr.url);
          const autoHtml=fixUrl(qr.auto?.html_url || `/attend.html?branch=${branchId}`);
          const enterUrl=fixUrl(qr.enter?.url || qr.url);
          const exitUrl=fixUrl(qr.exit?.url || qr.url);
          const enterHtml=fixUrl(qr.enter?.html_url || `/enter.html?branch=${branchId}`);
          const exitHtml=fixUrl(qr.exit?.html_url || `/exit.html?branch=${branchId}`);
          return <>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:12}}>
          <div>
            <Brand/>
            <h2 style={{fontSize:22,marginTop:8}}>{qr.branch}</h2>
            <p className="asas-muted">رموز QR الدائمة المشفرة بـ HMAC-SHA256 · ثابتة ومستمرة حتى الإبطال الإداري · توقيت صنعاء (اليمن)</p>
          </div>
          <div className="asas-actions">
            <Button icon={Printer} onClick={()=>window.print()}>طباعة الملصق (A4)</Button>
            <a className="asas-btn primary" href={autoUrl} target="_blank" rel="noreferrer"><QrCode size={15}/>الكود الموحد الذكي</a>
            <a className="asas-btn" href={enterUrl} target="_blank" rel="noreferrer"><LogIn size={15}/>صفحة كود الدخول</a>
            <a className="asas-btn" href={exitUrl} target="_blank" rel="noreferrer"><LogOut size={15}/>صفحة كود الخروج</a>
            <a className="asas-btn" href={fixUrl(`/attend?branch=${branchId}`)} target="_blank" rel="noreferrer"><Smartphone size={15}/>صفحة الآيفون العامة</a>
            <Button variant="danger" onClick={async()=>{const reason=window.prompt('سبب إبطال الرموز وتجديدها:');if(!reason)return;try{await api(`/admin/branches/${branchId}/qr/revoke`,'POST',{reason});setQr(null);setNotice('تم إبطال الرموز بنجاح وإصدار مراجعة جديدة. اضغط عرض الرموز لإصدار البديل فوراً.');}catch(e){setError(e.message);}}}>إبطال وتجديد الرموز</Button>
          </div>
        </div>

        <div className="asas-qr-grid">
          {/* Smart Unified Auto QR Card */}
          <div className="asas-qr-card auto" style={{gridColumn:'1 / -1',background:'linear-gradient(180deg,#faf7f0 0%,#ffffff 100%)',border:'2px solid #b59045',boxShadow:'0 4px 14px rgba(181,144,69,0.12)'}}>
            <div className="asas-qr-badge" style={{background:'#b59045',color:'#fff',fontSize:12.5,padding:'4px 14px'}}>⭐ الكود الموحد التلقائي الذكي (دخول وخروج تلقائي بحسب حالة الموظف)</div>
            <div className="asas-qr-card-title" style={{fontSize:19,marginTop:8}}><QrCode size={22} color="#b59045"/>كود الحضور والانصراف الموحد التلقائي</div>
            <p className="asas-muted" style={{fontSize:12.5,maxWidth:520,margin:'0 auto 10px'}}>
              يطبع ويعلق في مدخل ومخرج المنشأة: يمسحه الموظف فيتعرف النظام على حالته تلقائياً؛ إذا كان خارج العمل يسجل له <strong>حضور</strong>، وإذا كان مسجلاً دخول يسجل له <strong>انصراف</strong> فوراً دون الحاجة لكودين منفصلين!
            </p>
            <div className="asas-qr-box" style={{borderColor:'#b59045',padding:10}}>
              <QRCodeSVG value={autoUrl} size={220} level="M" includeMargin/>
            </div>
            <span className="asas-badge" style={{background:'#b59045',color:'#fff',marginTop:6}}>رمز موحد تلقائي دائم ومستمر</span>
            <div className="asas-actions" style={{justifyContent:'center',marginTop:8,flexWrap:'wrap',gap:6}}>
              <a className="asas-btn primary" href={autoUrl} target="_blank" rel="noreferrer"><Smartphone size={14}/>فتح صفحة التحضير التلقائية</a>
              <a className="asas-btn" href={autoHtml} target="_blank" rel="noreferrer"><Smartphone size={14}/>HTML للآيفون</a>
              <Button type="button" onClick={()=>{navigator.clipboard?.writeText(autoUrl);setNotice('تم نسخ رابط كود الحضور التلقائي الموحد');}}>نسخ الرابط</Button>
            </div>
          </div>
          {/* Check-In QR Card */}
          <div className="asas-qr-card enter">
            <div className="asas-qr-badge">كود الدخول والعودة المعتمد الدائم</div>
            <div className="asas-qr-card-title"><LogIn size={20}/>تسجيل الدخول والعودة</div>
            <p className="asas-muted" style={{fontSize:12}}>رمز ثابت يطبع مرة واحدة ولا يتغير · يُمسح عند بداية يوم العمل أو العودة</p>
            <div className="asas-qr-box">
              <QRCodeSVG value={enterUrl} size={210} level="M" includeMargin/>
            </div>
            <span className="asas-badge inside" style={{marginTop:6}}>رمز دخول دائم ومستمر</span>
            <div className="asas-actions" style={{justifyContent:'center',marginTop:8,flexWrap:'wrap',gap:6}}>
              <a className="asas-btn" href={enterUrl} target="_blank" rel="noreferrer"><LogIn size={14}/>فتح صفحة الدخول</a>
              <a className="asas-btn" href={enterHtml} target="_blank" rel="noreferrer"><Smartphone size={14}/>HTML للآيفون</a>
              <Button type="button" onClick={()=>{navigator.clipboard?.writeText(enterUrl);setNotice('تم نسخ رابط صفحة كود الدخول');}}>نسخ الرابط</Button>
            </div>
          </div>

          {/* Check-Out QR Card */}
          <div className="asas-qr-card exit">
            <div className="asas-qr-badge">كود الخروج والانصراف المعتمد الدائم</div>
            <div className="asas-qr-card-title"><LogOut size={20}/>تسجيل الخروج والانصراف</div>
            <p className="asas-muted" style={{fontSize:12}}>رمز ثابت يطبع مرة واحدة ولا يتغير · يُمسح عند إنهاء الدوام أو المغادرة</p>
            <div className="asas-qr-box">
              <QRCodeSVG value={exitUrl} size={210} level="M" includeMargin/>
            </div>
            <span className="asas-badge outside" style={{marginTop:6}}>رمز خروج دائم ومستمر</span>
            <div className="asas-actions" style={{justifyContent:'center',marginTop:8,flexWrap:'wrap',gap:6}}>
              <a className="asas-btn" href={exitUrl} target="_blank" rel="noreferrer"><LogOut size={14}/>فتح صفحة الخروج</a>
              <a className="asas-btn" href={exitHtml} target="_blank" rel="noreferrer"><Smartphone size={14}/>HTML للآيفون</a>
              <Button type="button" onClick={()=>{navigator.clipboard?.writeText(exitUrl);setNotice('تم نسخ رابط صفحة كود الخروج');}}>نسخ الرابط</Button>
            </div>
          </div>
        </div>
        </>;
        })()}

        <div className="asas-notice" style={{marginTop:24,textAlign:'right'}}>
          💡 <strong>حماية السجلات وثبات الرموز:</strong> رموز QR الآن دائمة وثابتة يمكن طباعتها وتعليقها دون حاجة لتغييرها يومياً، مع بقاء الحماية المشفرة والتوقيع السيادي بـ HMAC-SHA256؛ وتظل صالحة حتى يقرر المسؤول إبطالها وتجديدها يدوياً.
        </div>
      </div>
    ) : (
      <Empty>اختر الموقع لعرض كود الدخول وكود الخروج المعتمدين الدائمين.</Empty>
    )}
    </div></div>}
   {tab==='leave'&&<div className="asas-card asas-table-wrap"><table className="asas-table"><thead><tr><th>الموظف</th><th>الفترة</th><th>السبب</th><th>الحالة</th><th>المراجعة</th></tr></thead><tbody>{rows.map(l=><tr key={l.id}><td>{l.name}</td><td>{date(l.from_date)} — {date(l.to_date)}</td><td style={{whiteSpace:'normal'}}>{l.reason}</td><td><Badge state={l.status}/></td><td>{l.status==='pending'&&can('leave.review')&&<div className="asas-actions">{[['approved','قبول'],['rejected','رفض']].map(([status,label])=><Button key={status} onClick={async()=>{const comment=window.prompt('ملاحظة المراجعة:');if(!comment)return;try{await api(`/leave/${l.id}`,'PATCH',{status,comment});await load();}catch(e){setError(e.message);}}}>{label}</Button>)}</div>}</td></tr>)}</tbody></table>{!rows.length&&!busy&&<Empty>لا توجد طلبات إجازة.</Empty>}</div>}
   {tab==='audit'&&<div className="asas-card asas-table-wrap"><table className="asas-table"><thead><tr><th>التوقيت</th><th>المستخدم</th><th>العملية</th><th>السبب</th></tr></thead><tbody>{rows.map(a=><tr key={a.id}><td>{date(a.created_at)} {time(a.created_at)}</td><td>{a.actor||'النظام'}</td><td dir="ltr">{a.action}</td><td>{a.reason}</td></tr>)}</tbody></table>{!rows.length&&!busy&&<Empty/>}</div>}
   {tab==='settings'&&<div className="asas-form-grid">
    <article className="asas-card"><div className="asas-card-head"><h2>بيانات النظام والمنطقة الزمنية</h2><Settings2 size={18}/></div><div className="asas-card-body"><div className="asas-mini-row"><span>المنطقة الزمنية المعتمدة</span><strong>Asia/Aden (توقيت صنعاء، اليمن UTC+3)</strong></div><div className="asas-mini-row"><span>صلاحية رموز QR</span><strong>دائمة وثابتة حتى الإبطال الإداري</strong></div><div className="asas-mini-row"><span>توقيع الرمز</span><strong>HMAC-SHA256 مع مفتاح سري</strong></div><div className="asas-mini-row"><span>تشفير كلمات المرور</span><strong>scrypt (KDF آمن مع Salt فريد)</strong></div><div className="asas-mini-row"><span>جلسات العمل</span><strong>رموز مشفرة بـ SHA-256 وصلاحية 8 ساعات</strong></div></div></article>
    <article className="asas-card"><div className="asas-card-head"><h2>الهوية البصرية لأساس</h2><Brand/></div><div className="asas-card-body"><p className="asas-muted">الألوان والخطوط معتمدة وفق وثيقة الهوية البصرية لشركة أساس:</p><div className="asas-mini-row"><span>الفحمي الأساسي (Ink)</span><code dir="ltr">#231F20</code></div><div className="asas-mini-row"><span>الذهبي (Gold)</span><code dir="ltr">#B59045</code></div><div className="asas-mini-row"><span>الرملي الفاتح (Sand)</span><code dir="ltr">#D2C5AC</code></div><div className="asas-mini-row"><span>العاجي (Cream)</span><code dir="ltr">#EFE9D8</code></div><div className="asas-mini-row"><span>الخط العربي المعتمد</span><strong>Thmanyah Sans مع خطوط نظامية بديلة</strong></div></div></article>
    <article className="asas-card" style={{gridColumn:'1 / -1'}}><div className="asas-card-head"><h2>النسخ الاحتياطي واستعادة البيانات على Windows</h2><ShieldCheck size={18}/></div><div className="asas-card-body"><p className="asas-muted">لحفظ نسخة احتياطية من قاعدة البيانات أو استعادتها على بيئة Windows:</p><div className="asas-notice" style={{marginTop:12,fontFamily:'monospace',direction:'ltr',textAlign:'left'}}># أخذ نسخة احتياطية:<br/>cmd /c scripts\windows\backup-db.bat<br/><br/># استعادة نسخة احتياطية:<br/>cmd /c scripts\windows\restore-db.bat backups\asas_backup.dump</div><p className="asas-help">يتم الاحتفاظ بملفات النسخ في مجلد backups المحلي مع توثيق التاريخ والوقت.</p></div></article>
   </div>}
  </main></div>
  {modal&&<div className="asas-modal-backdrop" onClick={e=>{if(e.target===e.currentTarget&&!busy)setModal(null);}}><section className="asas-modal" role="dialog" aria-modal="true" aria-label="تحرير البيانات"><div className="asas-card-head"><h2>{form.id?'تعديل':'إضافة'} {modal==='branches'?'موقع الشركة':modal==='shifts'?'الدوام وسياسة الاحتساب':modal==='records'?'سجل الحضور':'حساب موظف'}</h2><Button icon={X} onClick={()=>setModal(null)} aria-label="إغلاق"/></div><form className="asas-form" onSubmit={save}>{error&&<div className="asas-notice error" role="alert">{error}</div>}{modal!=='records'&&modal!=='accounts'&&<Field label="الاسم" required value={form.name} onChange={e=>set('name',e.target.value)}/>}
    {modal==='records'&&<><Field label="اسم الموظف"><input className="asas-input" disabled value={form.name||''}/></Field><div className="asas-form-grid"><Field label="وقت الدخول" type="datetime-local" required value={form.first_in} onChange={e=>set('first_in',e.target.value)}/><Field label="وقت الخروج" type="datetime-local" value={form.last_out} onChange={e=>set('last_out',e.target.value)}/></div><div className="asas-form-grid"><Field label="الحالة التلقائية"><select className="asas-input" value={form.state} onChange={e=>set('state',e.target.value)}><option value="inside">حاضر الآن (قيد الدوام)</option><option value="outside">تم الانصراف</option><option value="closed">مغلق رسمياً</option></select></Field><Field label="سبب الخروج التلقائي"><select className="asas-input" value={form.exit_reason} onChange={e=>set('exit_reason',e.target.value)}><option value="انتهاء ساعات الدوام الرسمي في الموعد">انتهاء ساعات الدوام الرسمي في الموعد</option><option value="خروج مبكر بموافقة الإدارة">خروج مبكر بموافقة الإدارة</option><option value="خروج مؤقت / إذن رسمي">خروج مؤقت / إذن رسمي</option><option value="مغادرة نطاق الموقع تلقائياً (GPS)">مغادرة نطاق الموقع تلقائياً (GPS)</option><option value="انتهاء فترة المناوبة المجدولة تلقائياً">انتهاء فترة المناوبة المجدولة تلقائياً</option><option value="تصحيح إداري">تصحيح إداري</option></select></Field></div><label className="asas-check"><input type="checkbox" checked={form.deduct_away} onChange={e=>set('deduct_away',e.target.checked)}/>خصم فترات المغادرة والعودة من الوقت المحتسب</label></>}
    {modal==='branches'&&<><div className="asas-form-grid">{[['latitude','خط العرض',-90,90],['longitude','خط الطول',-180,180],['entry_radius','نطاق الدخول بالمتر',10,1000],['exit_radius','نطاق الخروج بالمتر',11,2000],['max_accuracy','أقصى هامش خطأ بالمتر',1,500],['exit_samples','عدد قراءات التأكيد',2,10],['exit_delay_seconds','مدة التأكيد بالثواني',30,600]].map(([k,label,min,max])=><Field key={k} label={label} type="number" required min={min} max={max} step={k==='latitude'||k==='longitude'?'any':1} value={form[k]} onChange={e=>set(k,e.target.value)}/>)}</div><div className="asas-actions" style={{marginTop:10}}><Button type="button" icon={MapPin} onClick={()=>navigator.geolocation?.getCurrentPosition(p=>{set('latitude',p.coords.latitude);set('longitude',p.coords.longitude);},()=>setError('تعذر الحصول على الموقع؛ أدخل الإحداثيات من الخريطة.'),{enableHighAccuracy:true,timeout:15000})}>استخدام موقع هذا الجهاز</Button>{form.latitude&&form.longitude&&<a className="asas-btn" href={`https://www.google.com/maps?q=${form.latitude},${form.longitude}`} target="_blank" rel="noreferrer">عرض في Google Maps</a>}</div>{form.latitude&&form.longitude&&!isNaN(Number(form.latitude))&&!isNaN(Number(form.longitude))&&<iframe className="asas-map" src={`https://maps.google.com/maps?q=${form.latitude},${form.longitude}&hl=ar&z=17&output=embed`} loading="lazy" title="معاينة موقع Google Maps" allowFullScreen/>}<p className="asas-help">يجب التحقق ميدانياً من الإحداثيات والحدود عبر Google Maps. تعديل الموقع يعيد فترة تأكيد الخروج للحضور المفتوح.</p><label className="asas-check"><input type="checkbox" checked={form.active} onChange={e=>set('active',e.target.checked)}/>الموقع مفعل</label></>}
   {modal==='shifts'&&<><div className="asas-form-grid"><Field label="بداية الدوام" type="time" value={form.start_time.slice(0,5)} required onChange={e=>set('start_time',e.target.value)}/><Field label="نهاية الدوام" type="time" value={form.end_time.slice(0,5)} required onChange={e=>set('end_time',e.target.value)}/></div><Field label="فترة السماح بالدقائق" type="number" min="0" max="120" value={form.grace_minutes} onChange={e=>set('grace_minutes',e.target.value)}/><Field label="عند نهاية الدوام"><select className="asas-input" value={form.close_policy} onChange={e=>set('close_policy',e.target.value)}><option value="actual_exit">انتظار الخروج الفعلي</option><option value="scheduled">إغلاق تلقائي بنهاية الدوام</option></select></Field><Field label="احتساب فترات المغادرة والعودة"><select className="asas-input" value={String(form.deduct_away)} onChange={e=>set('deduct_away',e.target.value==='true')}><option value="false">لا تخصم مدد المغادرة</option><option value="true">اخصم مدد المغادرة من الوقت المحتسب</option></select></Field><p className="asas-help">يظل السجل واحداً للمناوبة في الحالتين. هذا احتساب وقت وليس خصماً مالياً من الراتب.</p><div className="asas-days">{['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'].map((d,i)=><label className="asas-check" key={d}><input type="checkbox" checked={form.work_days.includes(i)} onChange={e=>set('work_days',e.target.checked?[...form.work_days,i]:form.work_days.filter(n=>n!==i))}/>{d}</label>)}</div></>}
   {modal==='accounts'&&<>
     <div className="asas-form-grid">
       <Field label="الاسم الكامل للموظف" required value={form.name} onChange={e=>set('name',e.target.value)}/>
       <Field label="الرقم الوظيفي الثابت" placeholder="اتركه فارغاً للتوليد التلقائي (مثل: 003)" disabled={!!form.id} value={form.identifier||''} onChange={e=>set('identifier',e.target.value)}/>
     </div>
     <div className="asas-form-grid">
       <Field label="البريد الإلكتروني (Gmail / الحساب الرسمي)" type="email" placeholder="name@company.com" value={form.email||''} onChange={e=>set('email',e.target.value)}/>
       <Field label="رقم الجوال / الهاتف" type="tel" placeholder="+967 77xxxxxxx" value={form.phone||''} onChange={e=>set('phone',e.target.value)}/>
     </div>
     <Field label={form.id?'كلمة مرور جديدة (اتركها فارغة للاحتفاظ بالحالية)':'كلمة المرور — 12 حرفاً على الأقل'} type="password" autoComplete="new-password" required={!form.id} minLength={12} maxLength={128} value={form.password||''} onChange={e=>set('password',e.target.value)}/>
     {form.bound_device_id&&(
       <div style={{background:'#fcf8f0',border:'1px solid #d2c5ac',padding:12,borderRadius:8,marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
         <div>
           <div style={{fontWeight:600,color:'#775b24',display:'flex',alignItems:'center',gap:6}}>
             <Smartphone size={16}/> الجهاز المقيد: {form.bound_device_name||'هاتف ذكي'}
           </div>
           <small style={{color:'#736d65'}}>معرف الجهاز: <code dir="ltr">{form.bound_device_id.slice(0,20)}…</code></small>
         </div>
         <Button type="button" variant="danger" onClick={async()=>{
           try{
             await api(`/admin/accounts/${form.id}/reset-device`,'POST',{reason:'فك قيد الجهاز من شاشة التعديل'});
             setNotice(`تم فك قيد الجهاز للموظف ${form.name} بنجاح`);
             set('bound_device_id',null);set('bound_device_name',null);
             await load();
           }catch(e){setError(e.message);}
         }}><Unlock size={14}/>فك قيد الجهاز</Button>
       </div>
     )}
     {user.role==='super_admin'&&!form.id&&<Field label="الدور"><select className="asas-input" value={form.role} onChange={e=>set('role',e.target.value)}>{Object.entries(roles).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>}
     <div className="asas-form-grid"><Field label="الفرع"><select className="asas-input" value={form.branch_id||''} required={form.role==='employee'} onChange={e=>set('branch_id',e.target.value)}><option value="">اختر الفرع</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></Field><Field label="جدول الدوام"><select className="asas-input" value={form.shift_id||''} required={form.role==='employee'} onChange={e=>set('shift_id',e.target.value)}><option value="">اختر الدوام</option>{shifts.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field></div>
     {user.role==='super_admin'&&form.role!=='employee'&&<div className="asas-form-grid">{Object.entries(permissions).map(([key,label])=><label className="asas-check" key={key}><input type="checkbox" checked={form.permissions?.includes(key)||false} onChange={e=>set('permissions',e.target.checked?[...form.permissions,key]:form.permissions.filter(p=>p!==key))}/>{label}</label>)}</div>}
     {form.id&&<label className="asas-check"><input type="checkbox" checked={form.active} onChange={e=>set('active',e.target.checked)}/>حساب نشط</label>}
   </>}
   {(form.id||modal==='branches'||modal==='records')&&<Field label="سبب التغيير (يحفظ في سجل العمليات)" required value={form.reason} onChange={e=>set('reason',e.target.value)}/>}
   <div className="asas-modal-footer"><Button type="button" onClick={()=>setModal(null)}>إلغاء</Button><Button variant="primary" type="submit" disabled={busy}>حفظ التغييرات</Button></div></form></section></div>}
 </div>;
}

function Login({onLogin,initialError,onRetry}){
 const [identifier,setIdentifier]=useState(''),[password,setPassword]=useState(''),[phone,setPhone]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(initialError);
 const [googleModal,setGoogleModal]=useState(false),[googleEmail,setGoogleEmail]=useState(''),[googleName,setGoogleName]=useState('');
 const [googleClientId,setGoogleClientId]=useState(()=>typeof window!=='undefined'?(localStorage.getItem('asas_google_client_id')||process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID||'331442639841-s48n1ir37vnn9nckg6ogn1hv8fl9fiq3.apps.googleusercontent.com'):'331442639841-s48n1ir37vnn9nckg6ogn1hv8fl9fiq3.apps.googleusercontent.com');
 const [tempClientId,setTempClientId]=useState('');
 const [modalTab,setModalTab]=useState('console'); // 'console' | 'direct'
 const [copiedOrigin,setCopiedOrigin]=useState(false);

 const handleGoogleCredentialResponse = useCallback(async (res) => {
  if (!res?.credential) return;
  setBusy(true);
  setError('');
  try {
   const device_id = getDeviceId();
   const device_name = getDeviceName();
   const d = await api('/auth/google', 'POST', {
    credential: res.credential,
    phone: phone || undefined,
    device_id,
    device_name
   });
   onLogin(d.account);
  } catch (err) {
   setError(err.message || 'فشل التحقق عبر حساب Google');
  } finally {
   setBusy(false);
  }
 }, [phone, onLogin]);

 useEffect(() => {
  if (!googleClientId || typeof window === 'undefined') return;
  function initGsi() {
   if (!window.google?.accounts?.id) return;
   try {
    window.google.accounts.id.initialize({
     client_id: googleClientId,
     callback: handleGoogleCredentialResponse,
     auto_select: false,
     cancel_on_tap_outside: true,
    });
    const el = document.getElementById('google-btn-container');
    if (el) {
     el.innerHTML = '';
     window.google.accounts.id.renderButton(el, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      width: 320,
      locale: 'ar'
     });
    }
   } catch (err) {
    console.warn('GSI render error:', err);
   }
  }
  if (window.google?.accounts?.id) {
   initGsi();
  } else {
   const timer = setInterval(() => {
    if (window.google?.accounts?.id) {
     clearInterval(timer);
     initGsi();
    }
   }, 300);
   return () => clearInterval(timer);
  }
 }, [googleClientId, handleGoogleCredentialResponse]);

 useEffect(() => {
  setError(initialError);
 }, [initialError]);
 async function submit(e){
  e.preventDefault();setBusy(true);setError('');
  try{
   const device_id=getDeviceId();
   const device_name=getDeviceName();
   const d=await api('/auth/login','POST',{identifier,password,phone:phone||undefined,device_id,device_name});
   onLogin(d.account);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function submitGoogle(e){
  e.preventDefault();setBusy(true);setError('');
  try{
   const device_id=getDeviceId();
   const device_name=getDeviceName();
   const d=await api('/auth/google','POST',{email:googleEmail,name:googleName||undefined,phone:phone||undefined,device_id,device_name});
   onLogin(d.account);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <div className="asas-login">
  <section className="asas-login-hero">
   <Brand/>
   <div>
    <p className="asas-eyebrow">حضورك يصنع الفرق</p>
    <h1>فريق متصل.<br/><span>وأيام أكثر وضوحاً.</span></h1>
    <p>مساحة أساس لإدارة الحضور والدوام المرتبطة بالبريد الإلكتروني وأجهزة الموظفين المعتمدة.</p>
   </div>
   <footer>
    <span>أساس الذكاء الاصطناعي</span>
    <p>نظام حضور سيادي ومحمي</p>
   </footer>
  </section>
  <section className="asas-login-form">
   <div className="asas-login-box">
    <p className="asas-eyebrow">أهلاً بعودتك</p>
    <h2>سجّل الدخول إلى أساس</h2>
    <p className="asas-muted">استخدم بريدك أو رقمك الوظيفي للوصول لمساحة العمل.</p>

    <form onSubmit={submit} className="asas-form">
     {error && (
       <div className="asas-notice error" role="alert" style={{display:'flex',flexDirection:'column',gap:8}}>
         <div>{error}</div>
         {onRetry && (
           <button type="button" onClick={async () => { setBusy(true); await onRetry(); setBusy(false); }} disabled={busy} style={{alignSelf:'flex-start',padding:'4px 12px',borderRadius:6,border:'1px solid #d9480f',background:'#fff',color:'#d9480f',fontWeight:600,fontSize:12,cursor:'pointer'}}>
             🔄 {busy ? 'جارٍ الفحص…' : 'إعادة فحص الاتصال الآن'}
           </button>
         )}
       </div>
     )}
     <Field label="البريد الإلكتروني أو الرقم الوظيفي" value={identifier} onChange={e=>setIdentifier(e.target.value)} autoComplete="username" required placeholder="001 أو name@company.com"/>
     <Field label="كلمة المرور" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required placeholder="••••••••••••"/>
     
     <Button variant="primary" type="submit" disabled={busy}>
      {busy?'جارٍ التحقق…':'تسجيل الدخول'}
      <ArrowUpLeft size={16}/>
     </Button>

     <div style={{display:'flex',alignItems:'center',gap:12,margin:'14px 0'}}>
      <div style={{flex:1,height:1,background:'#d2c5ac'}}/>
      <span style={{fontSize:12,color:'#736d65'}}>أو عبر Google Cloud & Firebase</span>
      <div style={{flex:1,height:1,background:'#d2c5ac'}}/>
     </div>

     {googleClientId ? (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,width:'100%'}}>
       <div id="google-btn-container" style={{display:'flex',justifyContent:'center',width:'100%',minHeight:44}}/>
       <button type="button" onClick={()=>{setTempClientId(googleClientId);setGoogleModal(true);}} style={{background:'none',border:'none',color:'#b59045',fontSize:12,cursor:'pointer',textDecoration:'underline'}}>
        ⚙️ إعدادات Google Console والخيارات البديلة
       </button>
      </div>
     ) : (
      <button type="button" onClick={()=>{setTempClientId(googleClientId);setGoogleModal(true);}} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,width:'100%',padding:'11px 16px',borderRadius:8,border:'1px solid #d2c5ac',background:'#fff',color:'#231f20',fontWeight:600,cursor:'pointer',fontSize:13.5}}>
       <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
       </svg>
       تسجيل الدخول باستخدام Google Cloud / Gmail
      </button>
     )}
    </form>

    <div style={{marginTop:16,padding:12,background:'#fbf7ee',borderRadius:8,fontSize:11.5,color:'#775b24',display:'flex',gap:8,alignItems:'flex-start'}}>
     <ShieldAlert size={16} style={{flexShrink:0,marginTop:2}}/>
     <div>
      <strong>نظام حماية قيد الأجهزة:</strong> يتم ربط حساب الموظف بجواله الشخصي عند أول تسجيل دخول تلقائياً. لا يمكن لموظف آخر تسجيل الدخول من نفس الهاتف، ولا يمكن التحضير من جوال آخر.
     </div>
    </div>
   </div>
  </section>

  {googleModal && (
   <div className="asas-modal-backdrop" onClick={() => setGoogleModal(false)}>
    <section className="asas-modal" style={{maxWidth: 520}} onClick={e => e.stopPropagation()}>
     <div className="asas-card-head">
      <div>
       <h2 style={{fontSize: 16}}>ربط تسجيل الدخول مع Google Cloud & Firebase</h2>
       <small style={{color: '#736d65'}}>مشروع Google Cloud: <code dir="ltr" style={{color: '#b59045', fontWeight: 600}}>centering-aegis-473416-f6</code></small>
      </div>
      <Button icon={X} onClick={() => setGoogleModal(false)}/>
     </div>

     <div style={{display:'flex',gap:8,padding:'8px 16px',background:'#faf8f5',borderBottom:'1px solid #ebdcc0'}}>
      <button type="button" onClick={() => setModalTab('console')} style={{flex:1,padding:'8px 12px',borderRadius:6,border:'1px solid',borderColor:modalTab==='console'?'#b59045':'#d2c5ac',background:modalTab==='console'?'#fff':'transparent',fontWeight:600,fontSize:12.5,cursor:'pointer',color:modalTab==='console'?'#775b24':'#736d65'}}>
       🔑 ربط Google OAuth Client ID
      </button>
      <button type="button" onClick={() => setModalTab('direct')} style={{flex:1,padding:'8px 12px',borderRadius:6,border:'1px solid',borderColor:modalTab==='direct'?'#b59045':'#d2c5ac',background:modalTab==='direct'?'#fff':'transparent',fontWeight:600,fontSize:12.5,cursor:'pointer',color:modalTab==='direct'?'#775b24':'#736d65'}}>
       ⚡ دخول فوري سريع بالبريد
      </button>
     </div>

     {modalTab === 'console' ? (
      <div style={{padding: 16, display:'flex', flexDirection:'column', gap: 14}}>
       <div style={{background: '#fbf7ee', border: '1px solid #ebdcc0', borderRadius: 8, padding: 12, fontSize: 12.5, lineHeight: 1.6, color: '#775b24'}}>
        <strong>خطوات تفعيل تسجيل الدخول بجوجل لمشروعك:</strong>
        <ol style={{margin: '8px 0 0', paddingRight: 18}}>
         <li>افتح صفحة <strong>Credentials (بيانات الاعتماد)</strong> في مشروعك عبر الزر بالأسفل.</li>
         <li>اضغط على <strong>Create Credentials</strong> ثم اختر <strong>OAuth client ID</strong>.</li>
         <li>اختر نوع التطبيق: <strong>Web application</strong>.</li>
         <li>في خانة <strong>Authorized JavaScript origins</strong>، أضف الرابطين التاليين:
          <div style={{margin: '6px 0', display:'flex', flexDirection:'column', gap: 4}}>
           <code dir="ltr" style={{background:'#fff',padding:'2px 6px',borderRadius:4,border:'1px solid #d2c5ac',fontSize:11.5}}>http://localhost:3000</code>
           <code dir="ltr" style={{background:'#fff',padding:'2px 6px',borderRadius:4,border:'1px solid #d2c5ac',fontSize:11.5}}>https://ai-asaas-attendance.vercel.app</code>
          </div>
         </li>
         <li>انسخ <strong>Client ID</strong> (ينتهي بـ <code>.apps.googleusercontent.com</code>) والصقه في الحقل أدناه.</li>
        </ol>
       </div>

       <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <a className="asas-btn" href="https://console.cloud.google.com/apis/credentials?project=centering-aegis-473416-f6" target="_blank" rel="noreferrer" style={{flex:1,justifyContent:'center',fontSize:12}}>
         🌐 فتح Google Cloud Console
        </a>
        <a className="asas-btn" href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" style={{flex:1,justifyContent:'center',fontSize:12}}>
         🔥 فتح Firebase Console
        </a>
       </div>

       <div>
        <label className="asas-label">
         OAuth 2.0 Client ID (معرف العميل من Google Cloud):
         <input
          className="asas-input"
          dir="ltr"
          placeholder="مثال: 123456789-abcdef.apps.googleusercontent.com"
          value={tempClientId}
          onChange={e => setTempClientId(e.target.value.trim())}
         />
        </label>
       </div>

       <div className="asas-modal-footer" style={{marginTop:0}}>
        <Button type="button" onClick={() => setGoogleModal(false)}>إغلاق</Button>
        <Button
         variant="primary"
         type="button"
         onClick={() => {
          if (!tempClientId) {
           alert('يرجى لصق OAuth Client ID من Google Cloud أولاً');
           return;
          }
          localStorage.setItem('asas_google_client_id', tempClientId);
          setGoogleClientId(tempClientId);
          setGoogleModal(false);
          alert('تم حفظ معرف Google Client ID بنجاح! سيظهر الآن زر تسجيل الدخول الرسمي بجوجل.');
         }}
        >
         💾 حفظ وتفعيل زر Google الرسمي
        </Button>
       </div>
      </div>
     ) : (
      <form className="asas-form" onSubmit={submitGoogle} style={{padding: 16}}>
       <p className="asas-muted" style={{background:'#fbf7ee',padding:10,borderRadius:6,border:'1px solid #ebdcc0',color:'#775b24',fontSize:12.5,lineHeight:1.5}}>
        ⚡ <strong>تسجيل ودخول مباشر:</strong> اكتب بريد Google الخاص بك هنا للتجربة أو الدخول الفوري دون انتظار إعدادات OAuth. يتم إصدار الرقم الوظيفي الثابت وربط الجوال تلقائياً!
       </p>
       <Field label="بريد Gmail أو بريد العمل" type="email" required autoFocus value={googleEmail} onChange={e=>setGoogleEmail(e.target.value)} placeholder="your.name@gmail.com"/>
       <Field label="اسم المستخدم أو الاسم الكامل" type="text" value={googleName} onChange={e=>setGoogleName(e.target.value)} placeholder="مثال: anas أو أنس الأغبري"/>
       <div className="asas-modal-footer">
        <Button type="button" onClick={()=>setGoogleModal(false)}>إلغاء</Button>
        <Button variant="primary" type="submit" disabled={busy}>{busy?'جارٍ التحقق والتسجيل…':'دخول / تسجيل تلقائي'}</Button>
       </div>
      </form>
     )}
    </section>
   </div>
  )}
 </div>;
}

function Employee({user,logout}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[token,setToken]=useState(''),[leave,setLeave]=useState({from_date:today(),to_date:today(),reason:''});
 const [liveTime,setLiveTime]=useState('');
 const [cameraModal,setCameraModal]=useState(false);
 const videoRef=useRef(null);
 const streamRef=useRef(null);

 async function startCamera(){
  setCameraModal(true);setError('');
  try{
   const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
   streamRef.current=stream;
   if(videoRef.current){videoRef.current.srcObject=stream;videoRef.current.play();}
   if('BarcodeDetector' in window){
    const detector=new window.BarcodeDetector({formats:['qr_code']});
    const interval=setInterval(async()=>{
     if(!videoRef.current||videoRef.current.readyState<2)return;
     try{
      const codes=await detector.detect(videoRef.current);
      if(codes.length>0){
       const raw=codes[0].rawValue;
       stopCamera();
       let t=raw;
       try{
        const u=new URL(raw);
        const hash=new URLSearchParams(u.hash.replace(/^#/,''));
        t=hash.get('qr')||u.searchParams.get('token')||raw;
       }catch(_){}
       setToken(t);
       act('auto',t);
       clearInterval(interval);
      }
     }catch(_){}
    },350);
   }
  }catch(err){
   setError('تعذر فتح الكاميرا؛ يرجى منح الإذن في المتصفح أو الضغط على زر الحضور التلقائي المباشر');
   setCameraModal(false);
  }
 }

 function stopCamera(){
  if(streamRef.current){
   streamRef.current.getTracks().forEach(t=>t.stop());
   streamRef.current=null;
  }
  setCameraModal(false);
 }

 useEffect(()=>{
  const update=()=>setLiveTime(new Intl.DateTimeFormat('ar-YE',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Aden'}).format(new Date()));
  update();
  const id=setInterval(update,1000);
  return()=>clearInterval(id);
 },[]);

 const load=useCallback(()=>api('/attendance/me').then(setData).catch(e=>setError(e.message)),[]);

 useEffect(()=>{
  load();
  const hash=new URLSearchParams(window.location.hash.slice(1));
  setToken(hash.get('qr')||'');
  window.history.replaceState(null,'',window.location.pathname);

  const poll=setInterval(load,6000);
  const onVisible=()=>{if(document.visibilityState==='visible')load();};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{
   clearInterval(poll);
   document.removeEventListener('visibilitychange',onVisible);
  };
 },[load]);

 async function act(action, customToken = null){
  setBusy(true);setError('');
  try{
   let currentToken = customToken || token;
   if(!currentToken){
    try{
     const qrData = await api(`/attendance/active-qr?action=${action==='auto'?'':action}`);
     if(qrData?.token) currentToken = qrData.token;
    }catch(err){}
   }
   if(!currentToken) throw new Error('يرجى مسح رمز QR الخاص بالشركة أو النقر على الرابط المعتمد');
   const p=await new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(new Error('الموقع غير متاح'));navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:20000,maximumAge:0});});
   const fix={latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,captured_at:new Date(p.timestamp).toISOString()};
   const device_id=getDeviceId();
   const reqId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ('req-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
   const r=await api('/attendance/action','POST',{action,token:currentToken,request_id:reqId,device_id,fix});
   setMessage(r.message||'تم توثيق الحضور بنجاح');
   await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }

 const todayRecord = data?.records?.[0];
 const isInside = todayRecord?.state === 'inside';

 return <div className="asas-app"><main className="asas-employee">
  <div className="asas-heading"><Brand/><Button onClick={logout} icon={LogOut}>خروج</Button></div>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
   <div>
    <div style={{display:'inline-flex',alignItems:'center',gap:6,background:'#fbf7ee',border:'1px solid #ebdcc0',padding:'3px 10px',borderRadius:20,fontSize:11.5,color:'#775b24',fontWeight:600,marginBottom:6}}>
     <Users size={12}/> مساحة الموظف · خدمات الحضور الذاتية (لوحة التحكم للإدارة فقط)
    </div>
    <h1>مرحباً، {user.name}</h1>
    <p className="asas-muted" style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginTop:4}}>
     <span style={{background:'#231f20',color:'#b59045',padding:'2px 8px',borderRadius:4,fontWeight:'bold',fontSize:12.5,fontFamily:'monospace'}}>الرقم الوظيفي: {user.identifier}</span>
     <span className="asas-badge outside" style={{fontSize:11}}>حساب موظف</span>
     <span>{user.email||'بدون بريد'}</span>
     {user.phone&&<span>· {user.phone}</span>}
    </p>
   </div>
   <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
    <div style={{display:'flex',alignItems:'center',gap:6,background:'#231f20',color:'#efe9d8',padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:600}}>
     <Clock3 size={14} style={{color:'#b59045'}}/>
     <span>صنعاء: <strong style={{color:'#b59045'}}>{liveTime||'—'}</strong></span>
    </div>
    <div style={{display:'flex',alignItems:'center',gap:6,background:'#fbf7ee',padding:'6px 12px',borderRadius:20,border:'1px solid #d2c5ac',fontSize:12,color:'#775b24'}}>
     <Smartphone size={14}/>
     <span>الجوال المقيد: <strong>{user.bound_device_name||'هذا الجهاز'}</strong></span>
    </div>
   </div>
  </div>

  <div className="asas-notice" style={{marginTop:20}}>🛡️ تم تقييد حسابك بجهازك المعتمد لحماية السجلات ومنع التحضير بالنيابة. المسح والموقع الجغرافي يوثقان لحظياً بتوقيت صنعاء.</div>
  {error&&<div className="asas-notice error" role="alert" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><span>{error}</span><Button type="button" icon={RefreshCw} onClick={load} disabled={busy} style={{padding:'4px 10px',fontSize:12}}>إعادة المحاولة</Button></div>}
  {message&&<div className="asas-notice">{message}</div>}

  {/* Live Attendance & Exit Time Summary Card */}
  <section className="asas-card" style={{marginTop:20,borderColor:'#b59045'}}>
   <div className="asas-card-head">
    <h2>حالة وسجل حضور اليوم</h2>
    {todayRecord&&<Badge state={todayRecord.state}/>}
   </div>
   <div className="asas-card-body">
    {/* Automatic Status Banner */}
    <div style={{background: isInside ? '#edf7ed' : '#faf6ee', border: `1px solid ${isInside ? '#bfe5bf' : '#ebdcc0'}`, padding: '12px 16px', borderRadius: 10, marginBottom: 14, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8}}>
      <div>
        <span style={{fontSize:12, color:'#736d65', display:'block'}}>حالتك الحالية حسب النظام:</span>
        <strong style={{fontSize:15, color: isInside ? '#1e7e34' : '#775b24', display:'flex', alignItems:'center', gap:6}}>
          {isInside ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
          {data?.automatic_status?.status_label || (isInside ? 'داخل موقع العمل (حضور مفتوح)' : (todayRecord?.last_out ? 'تم تسجيل الانصراف وإنهاء الدوام' : 'خارج موقع العمل (جاهز لتسجيل الحضور)'))}
        </strong>
      </div>
      <span className="asas-badge" style={{background: isInside ? '#c3e6cb' : '#ffeeba', color: isInside ? '#155724' : '#856404', fontWeight:700}}>
        الإجراء التلقائي: {isInside ? 'تسجيل الانصراف' : 'تسجيل الحضور'}
      </span>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:14}}>
     <div style={{background:'#fcfbf7',border:'1px solid #d2c5ac',padding:12,borderRadius:8,textAlign:'center'}}>
      <div style={{fontSize:12,color:'#736d65',marginBottom:4}}>وقت أول دخول (حضور)</div>
      <div style={{fontSize:17,fontWeight:700,color:'#231f20'}}>{todayRecord?.first_in ? time(todayRecord.first_in) : '—'}</div>
      <small style={{color:'#736d65',fontSize:11}}>{todayRecord?.first_in ? (todayRecord.status_label || 'سُجل بنجاح') : 'لم يسجل بعد'}</small>
     </div>
     <div style={{background:'#fcfbf7',border:'1px solid #d2c5ac',padding:12,borderRadius:8,textAlign:'center'}}>
      <div style={{fontSize:12,color:'#736d65',marginBottom:4}}>وقت آخر خروج (انصراف)</div>
      <div style={{fontSize:17,fontWeight:700,color:'#231f20'}}>{todayRecord?.last_out ? time(todayRecord.last_out) : '—'}</div>
      <small style={{color:'#736d65',fontSize:11}}>{todayRecord?.last_out ? 'سُجل بنجاح' : (isInside ? 'قيد الدوام' : 'لم يسجل بعد')}</small>
     </div>
     <div style={{background:'#fcfbf7',border:'1px solid #d2c5ac',padding:12,borderRadius:8,textAlign:'center'}}>
      <div style={{fontSize:12,color:'#736d65',marginBottom:4}}>سبب الخروج التلقائي</div>
      <div style={{fontSize:13,fontWeight:700,color:todayRecord?.exit_reason_label?.includes('مبكر')?'#c92a2a':'#775b24',marginTop:3}}>{todayRecord?.exit_reason_label || data?.automatic_status?.exit_reason_label || (isInside ? 'قيد الدوام' : '—')}</div>
      <small style={{color:'#736d65',fontSize:11}}>حسب توقيت الدوام</small>
     </div>
     <div style={{background:'#fcfbf7',border:'1px solid #d2c5ac',padding:12,borderRadius:8,textAlign:'center'}}>
      <div style={{fontSize:12,color:'#736d65',marginBottom:4}}>التوقيت اللحظي الآن</div>
      <div style={{fontSize:17,fontWeight:700,color:'#b59045'}}>{liveTime||'—'}</div>
      <small style={{color:'#736d65',fontSize:11}}>توقيت صنعاء (اليمن)</small>
     </div>
    </div>

    {/* Camera QR Scanner Modal */}
    {cameraModal && (
      <div className="asas-modal-backdrop" onClick={stopCamera}>
        <section className="asas-modal" style={{maxWidth:400,textAlign:'center'}} onClick={e=>e.stopPropagation()}>
          <div className="asas-card-head">
            <h2>📷 مسح كود الفرع</h2>
            <Button icon={X} onClick={stopCamera}/>
          </div>
          <div style={{padding:16}}>
            <p className="asas-muted" style={{fontSize:12.5,marginBottom:12}}>
              وجّه كاميرا الهاتف نحو كود QR المعلق في مقر الفرع للتحضير الفوري:
            </p>
            <div style={{position:'relative',borderRadius:12,overflow:'hidden',background:'#000',minHeight:240}}>
              <video ref={videoRef} playsInline autoPlay style={{width:'100%',height:240,objectFit:'cover'}}/>
              <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:180,height:180,border:'2px dashed #b59045',borderRadius:12,pointerEvents:'none'}}/>
            </div>
          </div>
          <div className="asas-modal-footer">
            <Button type="button" onClick={stopCamera}>إلغاء</Button>
          </div>
        </section>
      </div>
    )}

    {/* Primary Smart Auto-Button */}
    <Button
      variant="primary"
      disabled={busy}
      onClick={()=>act('auto')}
      style={{
        width:'100%',
        padding:'16px 20px',
        fontSize:16,
        fontWeight:700,
        marginBottom:12,
        background: isInside ? '#842029' : '#198754',
        borderColor: isInside ? '#701a22' : '#146c43',
        color:'#fff',
        display:'flex',
        justifyContent:'center',
        alignItems:'center',
        gap:10
      }}
    >
      {isInside ? <LogOut size={18}/> : <LogIn size={18}/>}
      {isInside
        ? `⚡ تسجيل الانصراف التلقائي الآن ${liveTime?`(${liveTime})`:''}`
        : `⚡ تسجيل الحضور التلقائي الآن ${liveTime?`(${liveTime})`:''}`}
    </Button>

    <div style={{marginBottom:12}}>
      <Button
        type="button"
        icon={Camera}
        onClick={startCamera}
        disabled={busy}
        style={{width:'100%',padding:'12px',fontSize:13.5,fontWeight:600,background:'#fff',border:'1px solid #d2c5ac',color:'#231f20',display:'flex',justifyContent:'center',gap:8}}
      >
        📷 مسح كود الفرع بكاميرا الجوال مباشرة
      </Button>
    </div>

    <div className="asas-actions" style={{justifyContent:'center',gap:8}}>
     <Button disabled={busy} onClick={()=>act('enter')} style={{fontSize:12}}>
      <LogIn size={13}/>
      دخول يدوي
     </Button>
     <Button disabled={busy} onClick={()=>act('exit')} style={{fontSize:12}}>
      <LogOut size={13}/>
      انصراف يدوي
     </Button>
    </div>
   </div>
  </section>

  <section className="asas-card" style={{marginTop:20}}><div className="asas-card-head"><h2>طلب إجازة</h2></div><form className="asas-card-body asas-form" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await api('/leave','POST',leave);setMessage('تم إرسال الطلب للمراجعة');setLeave({...leave,reason:''});}catch(e){setError(e.message);}finally{setBusy(false);}}}><div className="asas-form-grid"><Field label="من" type="date" required value={leave.from_date} onChange={e=>setLeave({...leave,from_date:e.target.value})}/><Field label="إلى" type="date" required value={leave.to_date} onChange={e=>setLeave({...leave,to_date:e.target.value})}/></div><Field label="السبب" required value={leave.reason} onChange={e=>setLeave({...leave,reason:e.target.value})}/><Button type="submit" disabled={busy}>إرسال الطلب</Button></form></section>
  <section className="asas-card" style={{marginTop:20}}><div className="asas-card-head"><h2>سجل حضوري</h2></div><Records rows={(data?.records||[]).map(r=>({...r,name:user.name,identifier:user.identifier}))}/></section>
 </main></div>;
}


export default function AsasApp() {
  return (
    <ErrorBoundary>
      <AsasAppInner />
    </ErrorBoundary>
  );
}
