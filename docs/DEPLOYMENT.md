# دليل تشغيل ونشر نظام حضور أساس (Asas Attendance System)

هذا الدليل يوضح خطوات تثبيت، وتشغيل، وإدارة نظام حضور شركة أساس على بيئة **Windows** مع خادم **Node.js** وقاعدة بيانات **PostgreSQL**، بالإضافة إلى إجراءات النسخ الاحتياطي والاستعادة.

---

## 1. المتطلبات الأساسية (Prerequisites)

- نظام تشغيل: **Windows 10 / 11** أو **Windows Server 2019/2022**.
- **Node.js 18+** (يوصى بـ LTS v20 أو v22).
- **PostgreSQL 14+** (مثبت محلياً كخدمة Windows أو عبر Docker).
- **Git** (اختياري لإدارة التحديثات).
- شهادة **HTTPS / SSL** عند إتاحة النظام لهواتف الموظفين عبر الشبكة أو الإنترنت.

---

## 2. إعداد قاعدة البيانات (PostgreSQL Database)

### الخطوة 1: إنشاء مستخدم وقاعدة بيانات
من خلال سطر أوامر `psql` أو تطبيق `pgAdmin`:

```sql
-- إنشاء المستخدم
CREATE USER asas WITH PASSWORD 'اختر_كلمة_مرور_قوية_جداً';

-- إنشاء قاعدة البيانات
CREATE DATABASE asas OWNER asas;

-- منح الصلاحيات
GRANT ALL PRIVILEGES ON DATABASE asas TO asas;
```

### الخطوة 2: تهيئة جدول النظام وحساب مدير النظام
يقوم سكريبت التهيئة بتطبيق ملف `database/asas-schema.sql` وإنشاء حساب مدير النظام الأول (Super Admin) دون إدخال أي بيانات وهمية أو تجريبية:

```cmd
cd asas-attendance\scripts\windows
setup-db.bat
```
أو يدوياً عبر Node:
```cmd
set SETUP_ADMIN_IDENTIFIER=admin
set SETUP_ADMIN_PASSWORD=كلمة_مرور_قوية_12_حرفا_على_الأقل
node backend\src\utils\setup-asas.js
```

---

## 3. إعداد وتشغيل الخادم الخلفي (Backend API)

### الخطوة 1: ضبط متغيرات البيئة `.env`
انسخ ملف النموذج `backend\.env.example` إلى `backend\.env`:

```env
HOST=127.0.0.1
PORT=5000
DATABASE_URL=postgresql://asas:كلمة_المرور@127.0.0.1:5432/asas
DB_SSL=false
QR_SECRET=أدخل_هنا_نص_عشوائي_طويل_32_حرفا_على_الأقل
WEB_ORIGIN=http://localhost:3000
NODE_ENV=production
```

> [!IMPORTANT]
> - `QR_SECRET`: مفتاح سري للتوقيع الرقمي لرموز QR اليومية (HMAC-SHA256). يجب أن يحتوي على 32 حرفاً عشوائياً على الأقل.
> - المنطقة الزمنية المعتمدة في النظام بالكامل هي `Asia/Aden` (توقيت اليمن العربي).

### الخطوة 2: تشغيل الخادم
```cmd
scripts\windows\start-backend.bat
```
أو مباشرة:
```cmd
cd backend
npm start
```
سيعمل الخادم على المنفذ `5000`، ويمكن التحقق من جاهزيته عبر:
`GET http://127.0.0.1:5000/health` -> `{"success":true,"data":{"service":"أساس","status":"ready"}}`

---

## 4. إعداد وتشغيل لوحة التحكم (Frontend Dashboard)

### الخطوة 1: تشغيل الواجهة
```cmd
scripts\windows\start-frontend.bat
```
أو يدوياً:
```cmd
cd frontend
npm run dev
```

تفتح لوحة التحكم عبر المتصفح على الرابط:
`http://localhost:3000`

---

## 5. تشغيل النظام كخدمة Windows تلقائية (Windows Service)

لضمان عمل النظام في الخلفية وإعادة تشغيله تلقائياً مع إقلاع نظام Windows دون الحاجة لبقاء موجه الأوامر مفتوحاً، يمكن استخدام **NSSM (Non-Sucking Service Manager)**:

1. نزل أداة NSSM من الموقع الرسمي وضعها في مجلد النظام.
2. تثبيت خدمة الخادم الخلفي:
   ```cmd
   nssm install AsasBackend "C:\Program Files\nodejs\node.exe" "C:\path\to\asas-attendance\backend\src\asas-server.js"
   nssm set AsasBackend AppDirectory "C:\path\to\asas-attendance\backend"
   nssm set AsasBackend Start SERVICE_AUTO_START
   nssm start AsasBackend
   ```
3. تثبيت خدمة الواجهة الأمامية (أو تشغيلها عبر خادم ويب عكسي مثل Nginx / IIS).

---

## 6. النسخ الاحتياطي واستعادة البيانات (Backup & Disaster Recovery)

### أخذ نسخة احتياطية:
تم توفير سكريبت مخصص يقوم بحفظ نسخة مخصصة مضغوطة (`.dump`) ونسخة SQL نصية مؤرخة بالتاريخ والوقت في مجلد `backups/`:

```cmd
scripts\windows\backup-db.bat
```

### استعادة نسخة احتياطية:
```cmd
scripts\windows\restore-db.bat backups\asas_backup_YYYYMMDD_HHMMSS.dump
```
> سيطلب السكريبت تأكيداً صريحاً بكتابة `YES` قبل تطبيق الاستعادة لضمان عدم المساس بالبيانات بالخطأ.

---

## 7. قواعد الأمان المطبقة في النظام

1. **المصادقة والتشفير**:
   - تشفير كلمات المرور باستخدام خوارزمية `scrypt` المقاومة للهجمات الموازية مع Salt عشوائي فريد لكل مستخدم.
   - حماية مسار الدخول من هجمات التخمين بتحديد معدل الطلبات (Rate Limiting) واختبار زمني موحد (Constant Time) يمنع هجمات توقيت فحص الحسابات (Timing Attacks).
   - الجلسات مؤمنة برموز 256 بت مشفرة ومنتهية الصلاحية بعد 8 ساعات.

2. **رموز QR اليومية**:
   - رمز يومي موقّع مشتق من فرع الشركة وتاريخ اليوم وفق توقيت `Asia/Aden`.
   - إبطال الرمز آلياً بانتهاء اليوم، مع إمكانية إبطاله يدوياً مع ذكر سبب الإبطال في سجل العمليات.
   - تصوير الرمز لا يكفي لتسجيل الحضور، إذ يتطلب طلباً مصادقاً وموقعاً جغرافياً موثوقاً داخل النطاق المحدد.

3. **حماية السجلات وسجل العمليات (Audit Trail)**:
   - كافة العمليات الحساسة (تعديل المواقع، تغيير جداول الدوام، تعديل الصلاحيات، تصحيح الحضور الإداري، إبطال الرموز) تتطلب إدخال سبب معتمد وتُوثق آلياً في جدول `audit_log`.
