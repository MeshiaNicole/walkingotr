// Walk Log display settings: light/dark mode and accent color.
// Loaded before the page draws so it never flashes the wrong look.
(function () {
  // Each accent has a light-mode and a dark-mode version:
  // [main color, soft background, text on main color, readable text color]
  var ACCENTS = {
    green:  { name: "Green",  light: ["#1d8a5a", "#e2f2e9", "#ffffff", "#1d8a5a"], dark: ["#3fbf86", "#16291f", "#0f1113", "#3fbf86"] },
    blue:   { name: "Blue",   light: ["#2f6fe8", "#e3ecfd", "#ffffff", "#2a62cf"], dark: ["#6ea8ff", "#15233d", "#0f1113", "#6ea8ff"] },
    purple: { name: "Purple", light: ["#7b4fe0", "#eee7fc", "#ffffff", "#6a3fd1"], dark: ["#a78bfa", "#261d3d", "#0f1113", "#b9a3fb"] },
    pink:   { name: "Pink",   light: ["#e0457b", "#fce4ec", "#ffffff", "#c93369"], dark: ["#f472a8", "#3a1827", "#0f1113", "#f78bb9"] },
    red:    { name: "Red",    light: ["#d93a3a", "#fbe5e3", "#ffffff", "#c22f2f"], dark: ["#f26b6b", "#3a1a1a", "#0f1113", "#f58585"] },
    orange: { name: "Orange", light: ["#e8670e", "#fdeadb", "#ffffff", "#bf540a"], dark: ["#fb923c", "#3a2410", "#0f1113", "#fca15a"] },
    yellow: { name: "Yellow", light: ["#e6b000", "#fdf4d3", "#1a1a1a", "#8a6500"], dark: ["#f5c518", "#33290a", "#0f1113", "#f5c518"] },
    gray:   { name: "Gray",   light: ["#6b7280", "#eceef1", "#ffffff", "#565c68"], dark: ["#a1a7b0", "#24282e", "#0f1113", "#b4b9c1"] },
    black:  { name: "Black",  light: ["#14171c", "#e6e7e9", "#ffffff", "#14171c"], dark: ["#eef0f2", "#2a2e34", "#0f1113", "#eef0f2"] }
  };
  // Water is normally blue and mood is normally amber. When the accent would
  // look the same, those two switch to a different color so they stay easy to tell apart.
  var WATER_ALT = { light: ["#0f97a8", "#dff3f5"], dark: ["#3cc7d6", "#11292d"] };
  var MOOD_ALT = { light: ["#d64f8f", "#fbe4ef"], dark: ["#f27bb3", "#3a1828"] };

  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function getTheme() { var t = read("walklog.theme"); return t === "light" || t === "dark" ? t : "system"; }
  function getAccent() { var a = read("walklog.accent"); return ACCENTS[a] ? a : "green"; }
  function isDark() {
    var t = getTheme();
    if (t !== "system") return t === "dark";
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  function apply() {
    var root = document.documentElement, t = getTheme(), a = getAccent(), mode = isDark() ? "dark" : "light";
    if (t === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", t);
    root.setAttribute("data-accent", a);
    var c = ACCENTS[a][mode], st = root.style;
    st.setProperty("--steps", c[0]);
    st.setProperty("--steps-soft", c[1]);
    st.setProperty("--on-steps", c[2]);
    st.setProperty("--steps-text", c[3]);
    if (a === "blue") { st.setProperty("--water", WATER_ALT[mode][0]); st.setProperty("--water-soft", WATER_ALT[mode][1]); }
    else { st.removeProperty("--water"); st.removeProperty("--water-soft"); }
    if (a === "orange" || a === "yellow") { st.setProperty("--mood", MOOD_ALT[mode][0]); st.setProperty("--mood-soft", MOOD_ALT[mode][1]); }
    else { st.removeProperty("--mood"); st.removeProperty("--mood-soft"); }
  }

  window.WalkTheme = { ACCENTS: ACCENTS, apply: apply, getTheme: getTheme, getAccent: getAccent, isDark: isDark };
  apply();
  try {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onChange = function () { if (getTheme() === "system") { apply(); document.dispatchEvent(new Event("walklog:theme")); } };
    if (mq.addEventListener) mq.addEventListener("change", onChange); else if (mq.addListener) mq.addListener(onChange);
  } catch (e) {}
})();
