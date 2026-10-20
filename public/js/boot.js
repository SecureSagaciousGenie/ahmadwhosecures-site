/* Author: Ahmad Shaukat
   Runs before first paint: marks JavaScript as available and applies a saved theme choice,
   so the page never flashes the wrong theme. External file so the Content-Security-Policy
   can keep script-src 'self'. */
(function () {
  var d = document.documentElement;
  d.setAttribute('data-js', '');
  try {
    if (window.localStorage.getItem('aw-theme') === 'light') d.setAttribute('data-theme', 'light');
  } catch (e) {
    /* storage blocked: keep the default dark theme */
  }
})();
