(function () {
  try {
    var isMobile = !!(window.matchMedia && window.matchMedia('(max-width: 767px)').matches);
    var theme = null;
    if (!isMobile) {
      var saved = localStorage.getItem('theme');
      theme = (saved === 'light' || saved === 'dark') ? saved : null;
      if (!theme) {
        try {
          var match = document.cookie.match('(?:^|; )theme=([^;]*)');
          var cookieTheme = match ? match[1] : null;
          if (cookieTheme === 'light' || cookieTheme === 'dark') theme = cookieTheme;
        } catch (_) {}
      }
    }
    if (!theme) {
      theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    if (theme) document.documentElement.dataset.theme = theme;
  } catch (_) {}
})();
