'use strict';

const nodemailer = require('nodemailer');

// Configure transporter from environment or fallback
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : (port === 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null; // SMTP not yet configured with credentials
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

const fromAddress = () => process.env.SMTP_FROM || `"نظام أساس للحضور" <${process.env.SMTP_USER || 'notifications@asas.ye'}>`;

async function sendMail({ to, subject, html, text }) {
  if (!to || !to.includes('@')) return false;

  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[Notification Sim] Email to: ${to} | Subject: ${subject}`);
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddress(),
      to,
      subject,
      text: text || subject,
      html
    });
    console.log(`[Notification Sent] MessageId: ${info.messageId} to ${to}`);
    return true;
  } catch (err) {
    console.error(`[Notification Error] Failed to send email to ${to}:`, err.message);
    return false;
  }
}

// ─── 1. Welcome / Auto-Registration Email ─────────────────────────────────
async function notifyAccountCreated(account, deviceName) {
  if (!account.email) return;
  const subject = `🎉 مرحباً بك في أساس - رقمك الوظيفي الثابت المعتمد (${account.identifier})`;
  const html = `
    <div dir="rtl" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e0dacb; border-radius: 12px; overflow: hidden;">
      <div style="background: #231f20; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 24px; color: #b59045;">نظام أساس للحضور والانصراف</h1>
        <p style="margin: 6px 0 0; font-size: 13px; color: #d2c5ac;">ASAS Attendance System</p>
      </div>
      <div style="padding: 24px; color: #231f20; line-height: 1.6;">
        <h2 style="font-size: 18px; color: #231f20;">أهلاً بك يا ${account.name}،</h2>
        <p>تم تسجيل وتفعيل حسابك بنجاح في نظام أساس للحضور والانصراف عبر حساب Google الخاص بك.</p>
        
        <div style="background: #fbf7ee; border: 2px solid #b59045; border-radius: 10px; padding: 18px; margin: 18px 0;">
          <div style="text-align: center; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed #d2c5ac;">
            <span style="font-size: 13px; color: #775b24; display: block;">رقمك الوظيفي الدائم والمعتمد في النظام</span>
            <span style="display: inline-block; background: #231f20; color: #b59045; font-size: 26px; font-weight: bold; padding: 4px 20px; border-radius: 8px; font-family: monospace; letter-spacing: 2px; margin-top: 6px;">
              ${account.identifier}
            </span>
          </div>
          <p style="margin: 6px 0;">👤 <strong>اسم الموظف:</strong> ${account.name}</p>
          <p style="margin: 6px 0;">📧 <strong>البريد المقترن (Gmail):</strong> ${account.email}</p>
          <p style="margin: 6px 0;">📱 <strong>الجهاز المقترن للحماية:</strong> ${deviceName || 'جهازك الحالي'}</p>
        </div>

        <p style="font-size: 13px; color: #231f20;">🔑 <strong>بيانات الدخول:</strong> يمكنك دائماً الدخول إلى النظام باستخدام بريدك الإلكتروني (Gmail) بضغطة زر، أو باستخدام رقمك الوظيفي الثابت (<strong>${account.identifier}</strong>).</p>
        <p style="font-size: 13px; color: #775b24;">🛡️ <strong>حماية الحساب:</strong> تم تقييد حسابك بجهازك الحالي تلقائياً لمنع تسجيل الحضور بالنيابة وضمان نزاهة وموثوقية السجلات.</p>
      </div>
      <div style="background: #f8f7f4; padding: 14px; text-align: center; font-size: 11px; color: #8a8275; border-top: 1px solid #ebdcc0;">
        هذا إشعار رسمي تلقائي من نظام أساس لإدارة الموارد البشرية · توقيت صنعاء (اليمن)
      </div>
    </div>
  `;
  return sendMail({ to: account.email, subject, html });
}

// ─── 2. Check-In Notification Email ───────────────────────────────────────
async function notifyCheckIn(account, branchName, timeStr) {
  if (!account.email) return;
  const subject = `✅ [أساس] تم تسجيل حضورك بنجاح (${timeStr})`;
  const html = `
    <div dir="rtl" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e0dacb; border-radius: 12px; overflow: hidden;">
      <div style="background: #2d6a4f; padding: 20px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px;">تم توثيق تسجيل الحضور ✅</h2>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">نظام أساس للحضور والانصراف</p>
      </div>
      <div style="padding: 24px; color: #231f20; line-height: 1.6;">
        <p style="font-size: 15px;">عزيزي الموظف <strong>${account.name}</strong>،</p>
        <p>تم تسجيل حضورك وبدء احتساب ساعات دوامك الرسمي لليوم بنجاح وفق التفاصيل التالية:</p>

        <div style="background: #f4faf6; border: 1px solid #b8dfcb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;">⏰ <strong>وقت الحضور:</strong> ${timeStr} (توقيت صنعاء)</p>
          <p style="margin: 4px 0;">🏢 <strong>مقر الفرع:</strong> ${branchName || 'مقر الفرع المعتمد'}</p>
          <p style="margin: 4px 0;">📍 <strong>التحقق الجغرافي:</strong> تم التوثيق بنجاح داخل النطاق المسموح (GPS Verified)</p>
          <p style="margin: 4px 0;">📱 <strong>الجهاز المستخدم:</strong> ${account.bound_device_name || 'جهازك المعتمد'}</p>
        </div>

        <p style="font-size: 12.5px; color: #52796f;">نتمنى لك يوماً موفقاً ومثمراً!</p>
      </div>
      <div style="background: #f8f7f4; padding: 12px; text-align: center; font-size: 11px; color: #8a8275; border-top: 1px solid #ebdcc0;">
        نظام أساس للحضور · توقيت صنعاء الرسمي (اليمن)
      </div>
    </div>
  `;
  return sendMail({ to: account.email, subject, html });
}

// ─── 3. Check-Out Notification Email ──────────────────────────────────────
async function notifyCheckOut(account, branchName, timeStr, workingMinutes) {
  if (!account.email) return;
  const hours = Math.floor((workingMinutes || 0) / 60);
  const minutes = (workingMinutes || 0) % 60;
  const durationText = hours > 0 ? `${hours} ساعة و ${minutes} دقيقة` : `${minutes} دقيقة`;

  const subject = `👋 [أساس] تم توثيق انصرافك بنجاح (${timeStr})`;
  const html = `
    <div dir="rtl" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e0dacb; border-radius: 12px; overflow: hidden;">
      <div style="background: #231f20; padding: 20px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px; color: #d2c5ac;">تم توثيق تسجيل الانصراف 👋</h2>
        <p style="margin: 4px 0 0; font-size: 13px; color: #a39c8f;">نظام أساس للحضور والانصراف</p>
      </div>
      <div style="padding: 24px; color: #231f20; line-height: 1.6;">
        <p style="font-size: 15px;">عزيزي الموظف <strong>${account.name}</strong>،</p>
        <p>تم إنهاء مناوبتك وتوثيق خروجك بنجاح وفق التفاصيل التالية:</p>

        <div style="background: #fdfaf4; border: 1px solid #ebdcc0; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;">⏰ <strong>وقت الانصراف:</strong> ${timeStr} (توقيت صنعاء)</p>
          <p style="margin: 4px 0;">⏱️ <strong>إجمالي ساعات العمل المحتسبة:</strong> <span style="color: #2d6a4f; font-weight: 700;">${durationText}</span></p>
          <p style="margin: 4px 0;">🏢 <strong>مقر الفرع:</strong> ${branchName || 'مقر الفرع المعتمد'}</p>
        </div>

        <p style="font-size: 12.5px; color: #736d65;">شكراً لجهودك اليوم وتقبل خالص التحية!</p>
      </div>
      <div style="background: #f8f7f4; padding: 12px; text-align: center; font-size: 11px; color: #8a8275; border-top: 1px solid #ebdcc0;">
        نظام أساس للحضور · توقيت صنعاء الرسمي (اليمن)
      </div>
    </div>
  `;
  return sendMail({ to: account.email, subject, html });
}

// ─── 4. Leave Request / Status Email ──────────────────────────────────────
async function notifyLeaveUpdate(account, leave, status) {
  if (!account.email) return;
  const statusLabels = {
    pending: 'قيد المراجعة',
    approved: 'تمت الموافقة ✅',
    rejected: 'تم الرفض ❌'
  };
  const statusColors = {
    pending: '#b59045',
    approved: '#2d6a4f',
    rejected: '#a83232'
  };

  const subject = `[أساس] تحديث بخصوص طلب إجازتك (${statusLabels[status] || status})`;
  const html = `
    <div dir="rtl" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e0dacb; border-radius: 12px; overflow: hidden;">
      <div style="background: #231f20; padding: 20px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px; color: #d2c5ac;">طلب إجازة</h2>
      </div>
      <div style="padding: 24px; color: #231f20; line-height: 1.6;">
        <p style="font-size: 15px;">عزيزي الموظف <strong>${account.name}</strong>،</p>
        <p>تم تحديث حالة طلب إجازتك المسجل في النظام:</p>

        <div style="background: #fbf7ee; border: 1px solid #ebdcc0; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;">📅 <strong>الفترة:</strong> من ${leave.from_date} إلى ${leave.to_date}</p>
          <p style="margin: 4px 0;">📝 <strong>السبب:</strong> ${leave.reason}</p>
          <p style="margin: 4px 0;">📊 <strong>الحالة:</strong> <strong style="color: ${statusColors[status] || '#231f20'};">${statusLabels[status] || status}</strong></p>
          ${leave.comment ? `<p style="margin: 4px 0;">💬 <strong>ملاحظة الإدارة:</strong> ${leave.comment}</p>` : ''}
        </div>
      </div>
      <div style="background: #f8f7f4; padding: 12px; text-align: center; font-size: 11px; color: #8a8275; border-top: 1px solid #ebdcc0;">
        نظام أساس للحضور وإدارة الموارد البشرية
      </div>
    </div>
  `;
  return sendMail({ to: account.email, subject, html });
}

module.exports = {
  sendMail,
  notifyAccountCreated,
  notifyCheckIn,
  notifyCheckOut,
  notifyLeaveUpdate
};
