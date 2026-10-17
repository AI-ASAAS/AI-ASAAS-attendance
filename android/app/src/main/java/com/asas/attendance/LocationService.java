package com.asas.attendance;

import android.Manifest;
import android.app.*;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.*;
import android.os.*;
import org.json.*;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

/** Starts from the visible Activity after explicit permission and stops after checkout. */
public class LocationService extends Service implements LocationListener {
 private LocationManager manager;private SecureStore store;private ExecutorService worker;
 private static final String CHANNEL="asas-attendance";
 @Override public void onCreate(){super.onCreate();store=new SecureStore(this);worker=Executors.newSingleThreadExecutor();
  NotificationManager nm=getSystemService(NotificationManager.class);nm.createNotificationChannel(new NotificationChannel(CHANNEL,"متابعة موقع الدوام",NotificationManager.IMPORTANCE_LOW));
 }
 private Notification notification(String text){
  PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  return new Notification.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle("أساس · حضور مفتوح").setContentText(text).setContentIntent(open).setOngoing(true).build();
 }
 private void status(String text){getSystemService(NotificationManager.class).notify(10,notification(text));}
 @Override public int onStartCommand(Intent intent,int flags,int startId){
  startForeground(10,notification("متابعة الموقع أثناء الدوام فقط"));
  if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){status("إذن الموقع غير متاح؛ افتح التطبيق");stopSelf();return START_NOT_STICKY;}
  manager=(LocationManager)getSystemService(LOCATION_SERVICE);
  for(String provider:new String[]{LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER})try{if(manager.isProviderEnabled(provider))manager.requestLocationUpdates(provider,30000,0,this);}catch(SecurityException ignored){}
  worker.execute(()->{try{JSONObject state=Api.call(store,"/api/attendance/me",null);JSONArray records=state.getJSONArray("records");if(records.length()==0||!"inside".equals(records.getJSONObject(0).getString("state")))stopSelf();}catch(Exception e){status("تعذر التحقق من الجلسة؛ افتح التطبيق");}});
  return START_NOT_STICKY;
 }
 @Override public void onLocationChanged(Location location){
  if(location.isFromMockProvider()){status("تم رفض موقع تجريبي؛ فعّل الموقع الحقيقي");return;}
  if(!location.hasAccuracy()||location.getAccuracy()<=0||System.currentTimeMillis()-location.getTime()>60000)return;
  worker.execute(()->{
   JSONObject request=null;
   try{
    JSONObject fix=new JSONObject().put("latitude",location.getLatitude()).put("longitude",location.getLongitude()).put("accuracy",location.getAccuracy()).put("captured_at",Instant.ofEpochMilli(location.getTime()).toString());
    request=new JSONObject().put("action","location").put("request_id",UUID.randomUUID().toString()).put("fix",fix);
    // Capture account identity for offline review isolation across logout/login.
    request.put("account_id",store.get("account_id"));
    flush();JSONObject response=Api.call(store,"/api/attendance/action",request);
    JSONObject record=response.optJSONObject("record");
    if(record!=null&& !"inside".equals(record.optString("state"))){store.put("last_status","تم تسجيل الخروج");stopSelf();}
    else status(response.optInt("pending_exit",0)>0?"جارٍ التأكد من مغادرة الموقع":"متابعة الموقع أثناء الدوام فقط");
   }catch(Api.Failure e){
    if(e.status==401||e.status==409){status("يرجى فتح التطبيق للتحقق من حالة الحضور");stopSelf();}
    else status(e.getMessage());
   }catch(Exception e){
    try{if(request!=null)enqueue(request);}catch(Exception ignored){}
    status("الاتصال غير متاح؛ الأدلة محفوظة للمراجعة وليست خروجاً مؤكداً");
   }
  });
 }
 private void enqueue(JSONObject request)throws Exception{
  String saved=store.get("offline");JSONArray items=saved.isEmpty()?new JSONArray():new JSONArray(saved);
  if(items.length()>=200){store.put("queue_full","true");return;}
  items.put(request);store.put("offline",items.toString());
 }
 private void flush()throws Exception{
  String saved=store.get("offline");if(saved.isEmpty())return;JSONArray items=new JSONArray(saved);JSONArray remaining=new JSONArray();
  for(int i=0;i<items.length();i++){
   JSONObject item=items.getJSONObject(i);
   if(!store.get("account_id").equals(item.optString("account_id"))){remaining.put(item);continue;}
   try{Api.call(store,"/api/attendance/offline",new JSONObject().put("request_id",item.getString("request_id")).put("evidence",item));}
   catch(Exception e){for(int j=i;j<items.length();j++)remaining.put(items.getJSONObject(j));store.put("offline",remaining.toString());throw e;}
  }
  store.put("offline",remaining.toString());
 }
 @Override public void onProviderDisabled(String provider){status("الموقع غير متاح؛ لا يمكن تأكيد المغادرة");}
 @Override public void onProviderEnabled(String provider){}
 @Override public void onStatusChanged(String provider,int status,Bundle extras){}
 @Override public void onDestroy(){if(manager!=null)manager.removeUpdates(this);worker.shutdown();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
 @Override public IBinder onBind(Intent intent){return null;}
}
