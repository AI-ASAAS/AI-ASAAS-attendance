package com.asas.attendance;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.location.*;
import android.net.Uri;
import android.os.*;
import android.view.View;
import android.widget.*;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;
import org.json.*;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

public class MainActivity extends Activity {
 private SecureStore store;private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private LinearLayout root;private TextView message;private String action="enter";private boolean busy;
 @Override public void onCreate(Bundle saved){super.onCreate(saved);store=new SecureStore(this);screen();}
 private void text(String value){runOnUiThread(()->message.setText(value));}
 private EditText field(String hint,boolean password){EditText input=new EditText(this);input.setHint(hint);input.setSingleLine();if(password)input.setInputType(129);root.addView(input,new LinearLayout.LayoutParams(-1,-2));return input;}
 private void button(String label,Runnable work){Button b=new Button(this);b.setText(label);b.setTextColor(Color.WHITE);b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(35,31,32)));root.addView(b,new LinearLayout.LayoutParams(-1,-2));b.setOnClickListener(v->{if(!busy)work.run();});}
 private void screen(){
  root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setPadding(35,60,35,30);root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);root.setBackgroundColor(Color.rgb(239,233,216));ScrollView scroll=new ScrollView(this);scroll.addView(root);setContentView(scroll);
  TextView title=new TextView(this);title.setText("أساس\nالحضور وإدارة الدوام");title.setTextSize(30);title.setTextColor(Color.rgb(35,31,32));root.addView(title);
  message=new TextView(this);message.setPadding(0,25,0,25);message.setTextSize(16);root.addView(message);
  try{
   if(store.get("token").isEmpty()){
    EditText server=field("رابط نظام الشركة https://…",false);server.setText(store.get("server"));EditText identifier=field("الرقم الوظيفي",false),password=field("كلمة المرور",true);
    button("تسجيل الدخول",()->{busy=true;text("جارٍ تسجيل الدخول…");worker.execute(()->{try{
     String url=server.getText().toString().trim();java.net.URL parsed=new java.net.URL(url);if(!"https".equals(parsed.getProtocol())||parsed.getUserInfo()!=null)throw new Exception("استخدم رابط HTTPS موثوقاً من مسؤول الشركة");store.put("server",url);
     JSONObject r=Api.call(store,"/api/auth/login",new JSONObject().put("identifier",identifier.getText().toString()).put("password",password.getText().toString()));
     JSONObject account=r.getJSONObject("account");if(!"employee".equals(account.getString("role")))throw new Exception("هذا التطبيق لحساب الموظف. استخدم لوحة الويب للإدارة.");
     store.put("token",r.getString("token"));store.put("account_id",account.getString("id"));runOnUiThread(this::screen);
    }catch(Exception e){text(e.getMessage());}finally{busy=false;}});});
   }else{
    text("يستخدم التطبيق موقعك أثناء الحضور المفتوح لتأكيد مغادرة نطاق الشركة. يظهر إشعار طوال المتابعة. إيقاف التطبيق أو إذن الموقع يمنع تأكيد الخروج التلقائي.");
    button("مسح QR للدخول أو العودة",()->scan("enter"));button("مسح QR للخروج",()->scan("exit"));button("تحديث حالة الحضور",this::refresh);
    button("فتح سجلي وطلبات الإجازة",()->{try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(store.get("server")+"/asas")));}catch(Exception e){text(e.getMessage());}});
    button("تسجيل الخروج من الحساب",()->{busy=true;worker.execute(()->{try{
     JSONObject r=Api.call(store,"/api/attendance/me",null);JSONArray records=r.getJSONArray("records");if(records.length()>0&&"inside".equals(records.getJSONObject(0).getString("state")))throw new Exception("سجل خروجك من الدوام أولاً حتى لا تتوقف متابعة الموقع أثناء حضور مفتوح");
     Api.call(store,"/api/auth/logout",new JSONObject());store.remove("token");stopService(new Intent(this,LocationService.class));runOnUiThread(this::screen);
    }catch(Exception e){text(e.getMessage());}finally{busy=false;}});});
   }
  }catch(Exception e){text("تعذر قراءة التخزين الآمن. أعد فتح التطبيق أو تواصل مع المسؤول.");}
 }
 private boolean permissions(){
  if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},10);text("امنح الموقع الدقيق ثم أعد الضغط على المسح.");return false;}
  if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},11);
  return true;
 }
 private void scan(String nextAction){if(!permissions())return;action=nextAction;new IntentIntegrator(this).setDesiredBarcodeFormats(IntentIntegrator.QR_CODE).setPrompt("امسح رمز أساس اليومي").setBeepEnabled(false).initiateScan();}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);IntentResult scan=IntentIntegrator.parseActivityResult(request,result,data);if(scan==null||scan.getContents()==null)return;
  try{
   Uri uri=Uri.parse(scan.getContents()),base=Uri.parse(store.get("server"));
   if(!"https".equals(uri.getScheme())||!base.getHost().equalsIgnoreCase(uri.getHost())||base.getPort()!=uri.getPort())throw new Exception("الرمز لا ينتمي إلى رابط الشركة المسجل");
   String fragment=uri.getFragment();if(fragment==null||!fragment.startsWith("qr="))throw new Exception("رمز غير صالح");capture(Uri.decode(fragment.substring(3)));
  }catch(Exception e){text(e.getMessage());}
 }
 private void capture(String token){
  if(!permissions())return;busy=true;text("جارٍ الحصول على موقع حديث…");
  LocationManager manager=(LocationManager)getSystemService(LOCATION_SERVICE);Handler handler=new Handler(Looper.getMainLooper());
  final boolean[] done={false};final LocationListener[] listener={null};
  Runnable timeout=()->{if(!done[0]){done[0]=true;manager.removeUpdates(listener[0]);busy=false;text("تعذر تحديد موقع دقيق. تحرك إلى مكان مكشوف وأعد المحاولة.");}};
  listener[0]=new LocationListener(){public void onLocationChanged(Location l){
   if(done[0]||System.currentTimeMillis()-l.getTime()>60000||!l.hasAccuracy()||l.getAccuracy()>30)return;
   done[0]=true;handler.removeCallbacks(timeout);manager.removeUpdates(this);
   if(l.isFromMockProvider()){busy=false;text("الموقع التجريبي غير مقبول");return;}
   worker.execute(()->{try{
    JSONObject fix=new JSONObject().put("latitude",l.getLatitude()).put("longitude",l.getLongitude()).put("accuracy",l.getAccuracy()).put("captured_at",Instant.ofEpochMilli(l.getTime()).toString());
    JSONObject r=Api.call(store,"/api/attendance/action",new JSONObject().put("action",action).put("token",token).put("request_id",UUID.randomUUID().toString()).put("fix",fix));
    text(r.optString("message","تم التحقق من حالة الحضور"));
    runOnUiThread(()->{if("enter".equals(action))startForegroundService(new Intent(MainActivity.this,LocationService.class));else stopService(new Intent(MainActivity.this,LocationService.class));});
   }catch(Exception e){text(e.getMessage());}finally{busy=false;}});
  }public void onProviderDisabled(String p){}public void onProviderEnabled(String p){}public void onStatusChanged(String p,int s,Bundle b){}};
  try{boolean any=false;for(String provider:new String[]{LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER})if(manager.isProviderEnabled(provider)){manager.requestLocationUpdates(provider,1000,0,listener[0]);any=true;}if(!any){busy=false;text("فعّل خدمة الموقع أولاً");return;}handler.postDelayed(timeout,30000);}catch(SecurityException e){busy=false;text("إذن الموقع غير متاح");}
 }
 private void refresh(){busy=true;worker.execute(()->{try{JSONObject r=Api.call(store,"/api/attendance/me",null);JSONArray records=r.getJSONArray("records");String state=records.length()>0?records.getJSONObject(0).getString("state"):"none";text("inside".equals(state)?"حضورك مفتوح. متابعة الموقع فعالة عند منح الإذن.":"لا يوجد حضور مفتوح حالياً");runOnUiThread(()->{if("inside".equals(state)&&permissions())startForegroundService(new Intent(this,LocationService.class));else stopService(new Intent(this,LocationService.class));});}catch(Exception e){text(e.getMessage());}finally{busy=false;}});}
 @Override protected void onDestroy(){worker.shutdown();super.onDestroy();}
}
