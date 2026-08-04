// NekoCut app.js — i18n, GitHub API, FAQ accordion. No GSAP.
(function () {
  "use strict";

  // ===== LANGUAGE =====
  var saved = localStorage.getItem("nekocut-lang");
  var browser = (navigator.language || "en").startsWith("vi") ? "vi" : "en";
  var currentLang = saved || browser;
  var releaseVersion = null;

  function applyLang(lang) {
    currentLang = lang;
    localStorage.setItem("nekocut-lang", lang);
    document.documentElement.lang = lang;
    var dict = I18N[lang] || I18N.en;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (dict[key] !== undefined) el.textContent = dict[key];
    });
    var toggle = document.getElementById("lang-toggle");
    if (toggle) toggle.textContent = lang === "en" ? "VI" : "EN";
    if (!releaseVersion) {
      var fallback = lang === "vi" ? "sắp ra mắt" : "coming soon";
      document.querySelectorAll("[data-release-ver]").forEach(function (el) {
        el.textContent = fallback;
      });
    }
  }

  function toggleLang() {
    applyLang(currentLang === "en" ? "vi" : "en");
  }

  // ===== GITHUB API =====
  var API = "https://api.github.com/repos/the-wiii-lab/NekoCut";

  function fmtCount(n) {
    return n >= 1000 ? (n / 1000).toFixed(1).replace(".0", "") + "k" : String(n);
  }

  function fetchStars() {
    fetch(API)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var c = d.stargazers_count || 0;
        document.querySelectorAll("[data-stars]").forEach(function (el) {
          el.textContent = fmtCount(c);
        });
      })
      .catch(function () {});
  }

  function detectOS() {
    var ua = (navigator.userAgent || "").toLowerCase();
    var p = (navigator.platform || "").toLowerCase();
    if (ua.includes("mac") || p.includes("mac")) return "macos";
    if (ua.includes("win") || p.includes("win")) return "windows";
    if (ua.includes("linux") || p.includes("linux")) return "linux";
    return "windows";
  }

  function fetchReleases() {
    fetch(API + "/releases/latest")
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (rel) {
        releaseVersion = rel.tag_name;
        document.querySelectorAll("[data-release-ver]").forEach(function (el) {
          el.textContent = releaseVersion;
        });
        var assets = { macos: null, windows: null, linux: null };
        (rel.assets || []).forEach(function (a) {
          var n = a.name.toLowerCase();
          if (n.endsWith(".dmg") || (n.endsWith(".zip") && n.includes("mac"))) assets.macos = a;
          if (n.endsWith(".exe") || n.endsWith(".msi")) assets.windows = a;
          if (n.endsWith(".appimage") || n.endsWith(".deb")) assets.linux = a;
        });
        ["macos", "windows", "linux"].forEach(function (plat) {
          var btn = document.querySelector('[data-dl="' + plat + '"]');
          if (!btn) return;
          var a = assets[plat];
          if (a) {
            btn.href = a.browser_download_url;
            btn.classList.remove("disabled");
            var span = btn.querySelector("span");
            if (span) span.textContent = "Download";
          }
        });
      })
      .catch(function () {});
  }

  // ===== FAQ =====
  function initFAQ() {
    document.querySelectorAll(".faq-q").forEach(function (q) {
      q.addEventListener("click", function () {
        var item = this.closest(".faq-i");
        var ans = item.querySelector(".faq-a");
        var open = item.classList.contains("open");
        document.querySelectorAll(".faq-i.open").forEach(function (o) {
          o.classList.remove("open");
          o.querySelector(".faq-a").style.maxHeight = null;
        });
        if (!open) {
          item.classList.add("open");
          ans.style.maxHeight = ans.scrollHeight + "px";
        }
      });
    });
  }

  // ===== INIT =====
  function init() {
    applyLang(currentLang);
    var t = document.getElementById("lang-toggle");
    if (t) t.addEventListener("click", toggleLang);
    initFAQ();
    fetchStars();
    fetchReleases();
    setInterval(fetchStars, 300000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
