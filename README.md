# AI-ASAAS-attendance - نظام حضور وانصراف أساس الذكي

<div align="center">

  <h3>نظام مؤسسي متكامل لإدارة حضور وانصراف الموظفين بالبصمة الذكية والـ QR ومساعد الذكاء الاصطناعي</h3>
  <p><strong>A Modern Enterprise Employee Attendance & Duty System (Next.js 14 & Node.js 22/24 + SQLite 3)</strong></p>

  ![Node.js](https://img.shields.io/badge/Node.js-22%2F24-339933?logo=node.js&logoColor=white)
  ![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)
  ![SQLite 3](https://img.shields.io/badge/SQLite-3%20(WAL%20Mode)-003B57?logo=sqlite&logoColor=white)
  ![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)
  ![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## 🌟 نظرة عامة (Overview)

نظام حضور وانصراف متقدم مصمم لمؤسسة **أساس (AI-ASAAS)**، يجمع بين الأمان العالي وسهولة الاستخدام. يعتمد النظام بالكامل على قاعدة بيانات **SQLite 3** بنمط **WAL (Write-Ahead Logging)** المدمج والمحلي، مما يمنحه سرعة استجابة فائقة (أقل من 3 ملي ثانية) دون أي تأخير شبكي، وبأقل استهلاك ممكن للذاكرة والمعالج.

لا يتطلب النظام تثبيت تطبيقات هاتفية من المتاجر؛ حيث يعمل مباشرة عبر متصفح الجوال أو سطح المكتب مع دعم التحقق الجغرافي الذكي (GPS Geofencing) ورموز الاستجابة السريعة (HMAC-SHA256 Signed QR) ومساعد ذكاء اصطناعي مدمج للموظفين والإدارة.

---

## 🚀 النشر من GitHub (GitHub Deployment Guide)

النظام مهيأ للنشر المباشر من GitHub بضغطة زر وبدون الحاجة لتهيئة قواعد بيانات خارجية.

### الطريقة 1: النشر عبر Docker (الأسهل والأنظف)

```bash
# 1. استنساخ المشروع من GitHub
git clone https://github.com/AI-ASAAS/AI-ASAAS-attendance.git
cd AI-ASAAS-attendance

# 2. بدء التشغيل عبر Docker Compose
docker compose up -d --build
```

- ستقوم الحاويات بالتشغيل التلقائي:
  - **الواجهة الأمامية (Frontend):** المنفذ `3000`
  - **الباك إند (Backend):** المنفذ `5000`
  - **بوابة Caddy العكسية:** المنفذين `80` و `443` مع شهادة SSL تلقائية.
- يتم حفظ قاعدة البيانات محلياً على السيرفر في `./database/asas.db` بحيث لا تُفقد عند إعادة بناء الحاويات.

---

### الطريقة 2: النشر المباشر على سيرفر VPS (Linux / Ubuntu / Windows)

```bash
# 1. استنساخ المشروع
git clone https://github.com/AI-ASAAS/AI-ASAAS-attendance.git
cd AI-ASAAS-attendance

# 2. تثبيت الحزم للباك إند وتشغيله
cd backend
npm install
npm start &

# 3. تثبيت حزم الواجهة وتشغيلها
cd ../frontend
npm install
npm run build
npm start
```

---

### الطريقة 3: النشر على المنصات السحابية (Render / Railway / Fly.io)

1. اربط مستودع GitHub بحسابك على المنصة السحابية.
2. أضف وحدة تخزين ثابتة (**Persistent Disk**) بمقدار `1GB` على المسار `/data`.
3. اضبط متغيرات البيئة:
   ```env
   NODE_ENV=production
   SQLITE_PATH=/data/asas.db
   QR_SECRET=ضع_رمز_تشفير_طويل_لا_يقل_عن_32_حرف
   ```
4. سيتولى السيرفر بناء المشروع وإنشاء الجداول تلقائياً من المرة الأولى.

---

## 🔑 بيانات الدخول الافتراضية (Default Credentials)

عند تشغيل النظام لأول مرة على قاعدة بيانات جديدة، يقوم النظام تلقائياً بإنشاء الفرع الرئيسي والدوام الرسمي وحساب المدير العام:

- **اسم المستخدم (Identifier):** `admin`
- **كلمة المرور الافتراضية:** `Admin@123456`
- **الرابط:** `http://localhost:3000` أو الدومين الخاص بك.

> **تنبيه أمني:** يُرجى تغيير كلمة المرور فور أول تسجيل دخول من لوحة التحكم.

---

## 🏗️ البنية التقنية (Architecture)

| الطبقة | التقنية المستخدمة | التفاصيل |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) + React 18 | تصميم سلس متجاوب بالكامل مبني وفق حزمة `AI-ASAAS/skills` وتدرجات ألوان مريحة للعين |
| **Backend** | Node.js 22+ (Express 4) | RESTful API مع توثيق أمني عالي وحماية من التلاعب |
| **Database** | **SQLite 3** (`node:sqlite DatabaseSync`) | نمط WAL فائق السرعة، سلامة العلاقات (`FOREIGN KEY ON`)، نسخ احتياطي ساخن كل 6 ساعات |
| **AI Assistant** | DeepSeek / LLM7 Keyless Fallback Engine | مساعد ذكي مقيد بسياق العمل وسياسات حضور وانصراف مخصصة لكل موظف مع حماية من Prompt Injection |
| **Security** | Scrypt KDF + HMAC-SHA256 + Rate Limiter | بصمة جهاز مشفرة (Device Lock)، تشفير QR دوري، قفل التلاعب الجغرافي |

---

## 📁 هيكلية المشروع (Project Layout)

```
AI-ASAAS-attendance/
├── backend/
│   ├── src/
│   │   ├── config/database.js          # محرك SQLite المدمج عالي السرعة
│   │   ├── controllers/                # متحكمات الحضور، الحسابات، الإجازات، المساعد
│   │   ├── services/                   # خدمة المساعد الذكي، الأمان، وتتبع الـ GPS
│   │   ├── utils/ensure-db.js          # الفحص التلقائي وإنشاء الجداول والمدير عند أول تشغيل
│   │   └── asas-server.js              # نقطة الانطلاق الأساسية للباك إند
│   ├── test/                           # 32 اختباراً آلياً شاملاً
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/                        # صفحات Next.js 14
│   │   ├── components/                 # مكونات الواجهة وتصميم AI-ASAAS المتجاوب
│   │   └── styles/asas.css             # أنماط وتدرجات وألوان الهوية البصرية
│   └── package.json
│
├── database/
│   ├── asas-sqlite-schema.sql          # المخطط الكامل لقاعدة بيانات SQLite
│   └── asas.db                         # ملف قاعدة البيانات المحلي (مستثنى من Git للأمان)
│
├── docker-compose.yml                  # إعداد التشغيل الموحد بالحاويات
├── Caddyfile                           # خادم الويب العكسي مع HTTPS تلقائي
└── README.md
```

---

## 🧪 الفحص والاختبارات الآلية (Automated Testing)

يحتوي النظام على حزمة اختبارات شاملة تغطي كافة السيناريوهات الأمنية والمنطقية:

```bash
npm test --prefix backend
```

```
ℹ tests 32
ℹ pass 32
ℹ fail 0
```

---

## 📄 الترخيص (License)
هذا المشروع مرخص تحت رخصة [MIT License](LICENSE).
جميع الحقوق محفوظة لمؤسسة **AI-ASAAS**.
