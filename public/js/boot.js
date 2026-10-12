/* Author: Ahmad Shaukat
   Runs before first paint: marks JS as available and decides whether to show the
   first-visit boot sequence. External file so the CSP can stay script-src 'self'. */
(function () {
  var d = document.documentElement;
  d.setAttribute('data-js', '');
  try {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce && !window.sessionStorage.getItem('aw-booted')) {
      d.setAttribute('data-boot', '');
    }
  } catch (e) {
    /* storage blocked: skip the boot sequence */
  }
})();
