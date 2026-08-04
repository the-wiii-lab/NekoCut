// NekoCut app.js — i18n, GitHub releases, FAQ accordion. No GSAP.
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

  // ===== OS + ARCH DETECTION =====
  function detectOS() {
    var ua = (navigator.userAgent || "").toLowerCase();
    var uaData = navigator.userAgentData;
    var platform = ((uaData && uaData.platform) || navigator.platform || "").toLowerCase();
    if (/mac|iphone|ipad|ipod/.test(ua) || platform.indexOf("mac") >= 0) return "macos";
    if (/win/.test(ua) || platform.indexOf("win") >= 0) return "windows";
    if (/linux/.test(ua) || platform.indexOf("linux") >= 0) return "linux";
    return "windows";
  }

  // WebGL renderer probe — most reliable client-side Apple Silicon detection.
  // Safari masks arm64 as "Intel" in UA, so UA alone is unreliable.
  function detectAppleSilicon() {
    try {
      var c = document.createElement("canvas");
      var gl = c.getContext("webgl") || c.getContext("experimental-webgl");
      if (!gl) return null;
      var ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (!ext) return null;
      var r = (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "").toLowerCase();
      if (r.indexOf("apple") >= 0 && r.indexOf("intel") < 0) return true;
      if (r.indexOf("intel") >= 0 && r.indexOf("apple") < 0) return false;
      if (r.indexOf("nvidia") >= 0 || r.indexOf("amd") >= 0 || r.indexOf("radeon") >= 0) return false;
      return null;
    } catch (e) {
      return null;
    }
  }

  // ===== GITHUB API =====
  var API = "https://api.github.com/repos/the-wiii-lab/NekoCut";

  function fmtCount(n) {
    return n >= 1000 ? (n / 1000).toFixed(1).replace(".0", "") + "k" : String(n);
  }

  function fmtSize(bytes) {
    if (!bytes) return "";
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + " GB";
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(0) + " MB";
    return Math.round(bytes / 1024) + " KB";
  }

  // Try matchers in order; return first asset that matches any matcher.
  function selectAsset(assets, matchers) {
    for (var i = 0; i < matchers.length; i++) {
      for (var j = 0; j < assets.length; j++) {
        if (matchers[i](assets[j])) return assets[j];
      }
    }
    return null;
  }

  // Exclude auto-update metadata and delta/blockmap files — not user-facing downloads.
  function isInstaller(name) {
    var n = name.toLowerCase();
    if (n.endsWith(".blockmap")) return false;
    if (n.endsWith(".yml") || n.endsWith(".yaml")) return false;
    if (n.endsWith(".sha256") || n.endsWith(".checksum")) return false;
    if (n.endsWith(".txt") && n.includes("checksum")) return false;
    return true;
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

  function fetchRelease() {
    // 1. Try stable release (non-prerelease, non-draft).
    // 2. If 404, fall back to latest release including prereleases.
    //    NekoCut is in beta — all releases may be marked prerelease.
    fetch(API + "/releases/latest")
      .then(function (r) {
        if (r.status === 404) {
          return fetch(API + "/releases?per_page=5")
            .then(function (r2) { return r2.json(); })
            .then(function (arr) {
              // Pick first non-draft release
              return arr.find(function (rel) { return !rel.draft; }) || arr[0];
            });
        }
        if (!r.ok) throw 0;
        return r.json();
      })
      .then(function (rel) {
        if (!rel || !rel.tag_name) throw 0;
        handleRelease(rel);
      })
      .catch(function () {});
  }

  function handleRelease(rel) {
    releaseVersion = rel.tag_name;

    document.querySelectorAll("[data-release-ver]").forEach(function (el) {
      el.textContent = releaseVersion;
    });

    var installers = (rel.assets || []).filter(function (a) {
      return isInstaller(a.name);
    });

    // macOS: detect Apple Silicon vs Intel.
    // Default arm64 — Apple Silicon has been the majority since 2020.
    var silicon = detectAppleSilicon();
    var macArch = silicon === false ? "x64" : "arm64";

    // electron-builder artifactName: "NekoCut-{arch}.{ext}"
    // → NekoCut-arm64.dmg, NekoCut-x64.dmg, NekoCut-arm64.zip, etc.
    var mac = selectAsset(installers, [
      function (a) { return /\.dmg$/i.test(a.name) && a.name.toLowerCase().indexOf(macArch) >= 0; },
      function (a) { return /\.dmg$/i.test(a.name); },
      function (a) { return /\.zip$/i.test(a.name) && a.name.toLowerCase().indexOf(macArch) >= 0; },
      function (a) { return /\.zip$/i.test(a.name) && /mac|darwin/i.test(a.name); }
    ]);

    // electron-builder artifactName: "NekoCut-windows-{arch}.{ext}"
    // → NekoCut-windows-x64.exe (NSIS installer)
    var win = selectAsset(installers, [
      function (a) { return /\.exe$/i.test(a.name); },
      function (a) { return /\.msi$/i.test(a.name); }
    ]);

    // electron-builder artifactName: "NekoCut-linux-x64.{ext}"
    // → NekoCut-linux-x64.AppImage
    var linux = selectAsset(installers, [
      function (a) { return /\.appimage$/i.test(a.name); },
      function (a) { return /\.deb$/i.test(a.name); },
      function (a) { return /\.rpm$/i.test(a.name); }
    ]);

    updateCard("macos", mac, macArch);
    updateCard("windows", win, "x64");
    updateCard("linux", linux, "x64");
  }

  function updateCard(platform, asset, arch) {
    var card = document.querySelector('[data-platform="' + platform + '"]');
    if (!card) return;
    var btn = card.querySelector("[data-dl]");
    var szEl = card.querySelector("[data-size]");
    var archEl = card.querySelector("[data-arch]");

    if (asset) {
      if (btn) {
        btn.href = asset.browser_download_url;
        btn.classList.remove("disabled");
        var span = btn.querySelector("span");
        if (span) span.textContent = currentLang === "vi" ? "Tải xuống" : "Download";
      }
      if (szEl) szEl.textContent = fmtSize(asset.size);
    }
    if (archEl && arch) archEl.textContent = arch;
  }

  // Highlight the visitor's platform (runs immediately, not dependent on release data).
  function highlightOS() {
    var os = detectOS();
    var card = document.querySelector('[data-platform="' + os + '"]');
    if (card) card.classList.add("recommended");
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
    highlightOS();
    fetchStars();
    fetchRelease();
    setInterval(fetchStars, 300000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
