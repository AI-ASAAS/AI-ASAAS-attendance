package com.asas.attendance;

import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;

final class Api {
 static class Failure extends Exception { final int status; Failure(int status,String message){super(message);this.status=status;} }
 static JSONObject call(SecureStore store,String path,JSONObject body) throws Exception {
  URL base=new URL(store.get("server"));
  if(!"https".equals(base.getProtocol())||base.getUserInfo()!=null)throw new Exception("يلزم عنوان HTTPS موثوق للشركة");
  HttpURLConnection c=(HttpURLConnection)new URL(base,path).openConnection();
  c.setInstanceFollowRedirects(false);c.setConnectTimeout(15000);c.setReadTimeout(15000);
  c.setRequestMethod(body==null?"GET":"POST");c.setRequestProperty("X-Asas-Client","android");
  String token=store.get("token");if(!token.isEmpty())c.setRequestProperty("Authorization","Bearer "+token);
  try {
   if(body!=null){c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");try(java.io.OutputStream out=c.getOutputStream()){out.write(body.toString().getBytes(StandardCharsets.UTF_8));}}
   int status=c.getResponseCode();InputStream input=status>=400?c.getErrorStream():c.getInputStream();
   ByteArrayOutputStream out=new ByteArrayOutputStream();
   if(input!=null)try(InputStream stream=input){byte[] bytes=new byte[4096];int n;while((n=stream.read(bytes))!=-1){out.write(bytes,0,n);if(out.size()>2000000)throw new Exception("استجابة كبيرة غير متوقعة");}}
   JSONObject response=new JSONObject(out.toString("UTF-8"));
   if(status<200||status>=300)throw new Failure(status,response.optString("message","تعذر الاتصال"));
   return response.optJSONObject("data");
  } finally {c.disconnect();}
 }
}
