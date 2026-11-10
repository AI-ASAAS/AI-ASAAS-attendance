// Runs before first paint (loaded from index.html, not inline, so a strict
// Content Security Policy needs no 'unsafe-inline'). Light by default, dark
// only if the visitor chose it; Arabic and right-to-left unless they chose English.
// Serve this file with `Cache-Control: no-cache`: it is not fingerprinted.
(function () {
  var root = document.documentElement;
  var theme = 'light';
  var lang = 'ar';
  try {
    if (localStorage.getItem('asaas-theme') === 'dark') theme = 'dark';
    if (localStorage.getItem('asaas-lang') === 'en') lang = 'en';
  } catch {
    /* storage unavailable: keep the defaults */
  }
  root.dataset.theme = theme;
  root.lang = lang;
  root.dir = lang === 'en' ? 'ltr' : 'rtl';
})();
