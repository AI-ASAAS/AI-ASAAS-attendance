/**
 * The kit's own interface words, in Arabic and English.
 *
 * The language is read from `<html lang>` at render time, so the site's
 * language provider only has to set `lang`/`dir` on the document and remount
 * (or re-render) the tree. Sites can reword any entry with `setKitText`.
 */
const ar = {
  close: 'إغلاق',
  cancel: 'إلغاء',
  delete: 'حذف',
  deleting: 'جارٍ الحذف…',
  saving: 'جارٍ الحفظ…',
  loading: 'جارٍ التحميل',
  loadError: 'تعذر تحميل البيانات',
  unexpectedError: 'حدث خطأ غير متوقع',
  retry: 'إعادة المحاولة',
  menu: 'القائمة',
  mainNav: 'التنقل الرئيسي',
  pickMonth: 'اختيار الشهر',
  prevMonth: 'الشهر السابق',
  nextMonth: 'الشهر التالي',
  backToThisMonth: 'العودة للشهر الحالي',
  showPassword: 'إظهار كلمة المرور',
  hidePassword: 'إخفاء كلمة المرور',
  show: 'إظهار',
  hide: 'إخفاء',
  passwordStrength: 'قوة كلمة المرور',
  strength0: 'ضعيفة جداً',
  strength1: 'ضعيفة',
  strength2: 'مقبولة',
  strength3: 'جيدة',
  strength4: 'قوية',
  statusPaid: 'مدفوع',
  statusPartial: 'جزئي',
  statusUnpaid: 'لم يدفع',
  goodMorning: 'صباح الخير',
  goodEvening: 'مساء الخير',
  greetingName: '{salutation} يا {name}',
  assistantTitle: 'مساعد أساس',
  assistantSubtitle: 'اسأل وسأجيبك',
  assistantLead: 'كيف أقدر أساعدك اليوم؟',
  assistantError: 'تعذر الوصول للمساعد، حاول مرة أخرى',
  assistantNewChat: 'محادثة جديدة',
  assistantTyping: 'المساعد يكتب',
  assistantPlaceholder: 'اكتب سؤالك…',
  assistantInput: 'سؤالك للمساعد',
  assistantSend: 'إرسال',
  assistantDisclaimer: 'يجيب من بيانات الموقع فقط، وقد يخطئ.',
};

export type KitTextKey = keyof typeof ar;
export type KitLang = 'ar' | 'en';

const en: Record<KitTextKey, string> = {
  close: 'Close',
  cancel: 'Cancel',
  delete: 'Delete',
  deleting: 'Deleting…',
  saving: 'Saving…',
  loading: 'Loading',
  loadError: 'Could not load the data',
  unexpectedError: 'Something went wrong',
  retry: 'Try again',
  menu: 'Menu',
  mainNav: 'Main navigation',
  pickMonth: 'Choose a month',
  prevMonth: 'Previous month',
  nextMonth: 'Next month',
  backToThisMonth: 'Back to this month',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  show: 'Show',
  hide: 'Hide',
  passwordStrength: 'Password strength',
  strength0: 'Very weak',
  strength1: 'Weak',
  strength2: 'Fair',
  strength3: 'Good',
  strength4: 'Strong',
  statusPaid: 'Paid',
  statusPartial: 'Partial',
  statusUnpaid: 'Unpaid',
  goodMorning: 'Good morning',
  goodEvening: 'Good evening',
  greetingName: '{salutation}, {name}',
  assistantTitle: 'Asaas assistant',
  assistantSubtitle: 'Ask and I will answer',
  assistantLead: 'How can I help you today?',
  assistantError: 'Could not reach the assistant, please try again',
  assistantNewChat: 'New chat',
  assistantTyping: 'The assistant is typing',
  assistantPlaceholder: 'Type your question…',
  assistantInput: 'Your question for the assistant',
  assistantSend: 'Send',
  assistantDisclaimer: 'Answers come from this site only and may be wrong.',
};

const dictionaries: Record<KitLang, Record<KitTextKey, string>> = { ar: { ...ar }, en: { ...en } };

/** The document's language: English when `<html lang>` starts with "en", Arabic otherwise. */
export function kitLang(): KitLang {
  if (typeof document === 'undefined') return 'ar';
  return document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'ar';
}

/** A kit word in the document's language; `{name}` placeholders are filled from `vars`. */
export function kitText(key: KitTextKey, vars?: Record<string, string>): string {
  const text = dictionaries[kitLang()][key];
  return vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => vars[name] ?? match) : text;
}

/** Reword kit entries for one language, e.g. `setKitText('en', { assistantTitle: 'Help' })`. */
export function setKitText(lang: KitLang, entries: Partial<Record<KitTextKey, string>>): void {
  Object.assign(dictionaries[lang], entries);
}
