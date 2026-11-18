/* global window, document */
// Applies the stored theme preference (localStorage "insta.theme": light | dark | system) to <html>
// before the app boots, so there is no light/dark flash. Mirrors src/state/theme.ts.
(function () {
  try {
    var pref = window.localStorage.getItem("insta.theme");
    if (pref === "light" || pref === "dark") {
      document.documentElement.setAttribute("data-theme", pref);
    }
  } catch (_e) {
    /* storage unavailable: fall back to prefers-color-scheme */
  }
})();
