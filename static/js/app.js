(function () {
  var currentScript = document.currentScript;
  var mainSrc = currentScript && currentScript.hasAttribute('data-main-minified')
    ? '/static/js/app_main.min.js'
    : '/static/js/app_main.js';
  var mainLoaded = false;
  var mainLoading = false;

  function loadMain() {
    if (mainLoaded || mainLoading) return;
    mainLoading = true;

    var s = document.createElement('script');
    s.src = mainSrc;
    s.defer = true;
    s.onload = function () {
      mainLoaded = true;
      mainLoading = false;
    };
    s.onerror = function () {
      mainLoading = false;
    };
    document.body.appendChild(s);
  }

  function scheduleDeferredLoad() {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(loadMain, { timeout: 1200 });
    } else {
      window.setTimeout(loadMain, 0);
    }
  }

  function onFirstInteraction() {
    loadMain();
    window.removeEventListener('pointerdown', onFirstInteraction, true);
    window.removeEventListener('touchstart', onFirstInteraction, true);
    window.removeEventListener('keydown', onFirstInteraction, true);
  }

  window.addEventListener('pointerdown', onFirstInteraction, { capture: true, passive: true, once: true });
  window.addEventListener('touchstart', onFirstInteraction, { capture: true, passive: true, once: true });
  window.addEventListener('keydown', onFirstInteraction, { capture: true, once: true });

  if (document.readyState === 'complete') {
    scheduleDeferredLoad();
  } else {
    window.addEventListener('load', scheduleDeferredLoad, { once: true });
  }
})();
