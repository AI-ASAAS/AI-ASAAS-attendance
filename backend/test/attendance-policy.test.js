const {test} = require('node:test');
const assert = require('node:assert/strict');
const {localDay, issueQr, verifyQr, classifyFix, advanceExit, shiftWindow} = require('../src/services/attendance-policy');
const secret='a'.repeat(48);
const branch={id:1,qr_revision:1,location_revision:1,active:true,latitude:15,longitude:44,entry_radius:80,exit_radius:120,max_accuracy:30,exit_samples:3,exit_delay_seconds:120};
const now=new Date('2026-10-18T06:00:00Z');
const fix=(latitude=15,accuracy=5,time=now)=>({latitude,longitude:44,accuracy,captured_at:time.toISOString()});
test('QR is permanent and rejects tampered, revoked, and other-branch codes',()=>{
 const before=new Date('2026-10-17T20:59:59Z'),after=new Date('2026-10-17T21:00:00Z');
 const token=issueQr(branch,secret,before);
 assert.equal(localDay(after),'2026-10-18');
 assert.equal(verifyQr(token,branch,secret,before),true);
 assert.equal(verifyQr(token,branch,secret,after),true); // permanent code is valid across different days!
 for(const [b,t,n] of [[branch,token+'x',before],[{...branch,id:2},token,before],[{...branch,qr_revision:2},token,before]]) assert.throws(()=>verifyQr(t,b,secret,n));
 const enterToken = issueQr(branch, secret, before, 'enter');
 const exitToken = issueQr(branch, secret, before, 'exit');
 assert.equal(verifyQr(enterToken, branch, secret, before, 'enter'), true);
 assert.equal(verifyQr(exitToken, branch, secret, before, 'exit'), true);
 assert.throws(() => verifyQr(enterToken, branch, secret, before, 'exit'), err => err.code === 'QR_ACTION_MISMATCH');
 assert.throws(() => verifyQr(exitToken, branch, secret, before, 'enter'), err => err.code === 'QR_ACTION_MISMATCH');
});
test('GPS requires fresh finite coordinates and respects accuracy bounds',()=>{
 assert.equal(classifyFix(fix(),branch,now).state,'inside');
 assert.equal(classifyFix(fix(15,60),branch,now).state,'uncertain');
 assert.equal(classifyFix(fix(15.0011,20),branch,now).state,'uncertain');
 assert.equal(classifyFix(fix(15.01),branch,now).state,'outside');
 for(const bad of [{}, {...fix(),latitude:NaN},{...fix(),latitude:'15'},{...fix(),accuracy:0},fix(15,5,new Date(now-61000))]) assert.throws(()=>classifyFix(bad,branch,now));
});
test('exit needs distinct fixes AND elapsed server time; uncertainty clears pending exit',()=>{
 let state;
 for(const sec of [0,60,120]) {const t=new Date(+now+sec*1000),f=fix(15.01,5,t); state=advanceExit(state,classifyFix(f,branch,t),f,branch,t); assert.equal(state.exit,sec===120);}
 const duplicate=advanceExit(state,{state:'outside'},fix(15.01,5,new Date(+now+120000)),branch,new Date(+now+120000)); assert.equal(duplicate.exit,false);
 const t=new Date(+now+130000),f=fix(15,60,t); state=advanceExit(state,classifyFix(f,branch,t),f,branch,t); assert.equal(state.count,0);
});
test('location changes and long gaps reset automatic exit confirmation',()=>{
 const f=fix(15.01),s=advanceExit(null,{state:'outside'},f,branch,now);
 const t=new Date(+now+120000);
 assert.equal(advanceExit(s,{state:'outside'},fix(15.01,5,t),branch,t).count,1);
 const t2=new Date(+now+60000);
 assert.equal(advanceExit(s,{state:'outside'},fix(15.01,5,t2),{...branch,location_revision:2},t2).count,1);
});
test('overnight shift belongs to its starting day and not QR calendar date',()=>{
 const s={start_time:'22:00',end_time:'06:00',work_days:[0,1,2,3,4,5,6]};
 const w=shiftWindow(s,new Date('2026-10-18T01:00:00Z'));
 assert.equal(w.day,'2026-10-17'); assert.equal(w.end.toISOString(),'2026-10-18T03:00:00.000Z');
 assert.throws(()=>shiftWindow(s,new Date('2026-10-18T08:00:00Z')));
});
