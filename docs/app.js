// NekoCut app.js — refined GSAP animations, GitHub API, i18n, downloads
(function () {
  "use strict";

  // ===== LANGUAGE =====
  var saved = localStorage.getItem("nekocut-lang");
  var browser = (navigator.language || "en").startsWith("vi") ? "vi" : "en";
  var currentLang = saved || browser;
  var releaseVersion = null;

  function splitHeroWords() {
    var h1 = document.querySelector(".hero h1");
    if (!h1) return;
    var key = h1.getAttribute("data-i18n");
    var dict = I18N[currentLang] || I18N.en;
    var text = key && dict[key] ? dict[key] : h1.textContent.trim();
    var words = text.trim().split(/\s+/);
    h1.innerHTML = words.map(function (w) {
      var accent = w.toLowerCase().includes("beautiful") || w.toLowerCase().includes("đẹp");
      var inner = accent ? '<span class="accent">' + w + "</span>" : w;
      return '<span class="word"><span>' + inner + "</span></span>";
    }).join(" ");
  }

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
    splitHeroWords();
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
  var REPO = "the-wiii-lab/NekoCut";
  var API = "https://api.github.com/repos/" + REPO;

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
    var os = detectOS();
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
        var primary = document.querySelector('[data-dl="' + os + '"]');
        if (primary) primary.closest(".dl-os").classList.add("detected");
      })
      .catch(function () {
        document.querySelectorAll("[data-release-ver]").forEach(function (el) {
          el.textContent = currentLang === "vi" ? "sắp ra mắt" : "coming soon";
        });
      });
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

  // ===== GSAP =====
  function initGSAP() {
    if (typeof gsap === "undefined") return;
    if (typeof ScrollTrigger !== "undefined") gsap.registerPlugin(ScrollTrigger);

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    // --- Hero entrance ---
    var tl = gsap.timeline({ delay: 0.2 });
    tl.from(".h-badge", { y: 14, opacity: 0, duration: 0.5, ease: "power2.out" })
      .from(".hero h1 .word > span", { yPercent: 100, duration: 0.7, stagger: 0.06, ease: "power3.out" }, "-=0.15")
      .from(".hero .sub", { y: 16, opacity: 0, duration: 0.5, ease: "power2.out" }, "-=0.35")
      .from(".hero-cta .btn", { y: 14, opacity: 0, duration: 0.4, stagger: 0.08, ease: "power2.out" }, "-=0.25")
      .from(".hero-alt", { opacity: 0, duration: 0.4, ease: "power2.out" }, "-=0.2")
      .from(".hero-shot", { y: 28, opacity: 0, duration: 0.8, ease: "power3.out" }, "-=0.35");

    // --- Floating hero image ---
    gsap.to(".hero-shot", { y: -8, duration: 3, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 2 });

    if (typeof ScrollTrigger === "undefined") return;

    // --- Nav scroll ---
    var nav = document.querySelector(".nav");
    ScrollTrigger.create({
      trigger: "body", start: "50 top",
      onEnter: function () { nav.classList.add("scrolled"); },
      onLeaveBack: function () { nav.classList.remove("scrolled"); }
    });

    // --- Section heads ---
    document.querySelectorAll(".s-head").forEach(function (h) {
      gsap.from(h.children, {
        scrollTrigger: { trigger: h, start: "top 85%" },
        y: 18, opacity: 0, duration: 0.5, stagger: 0.08, ease: "power2.out"
      });
    });

    // --- Download cards ---
    gsap.from(".dl-os", {
      scrollTrigger: { trigger: ".dl-row", start: "top 82%" },
      y: 20, opacity: 0, duration: 0.5, stagger: 0.08, ease: "power2.out"
    });

    // --- Core features ---
    document.querySelectorAll(".core").forEach(function (c) {
      var tx = c.querySelector(".core-tx");
      var im = c.querySelector(".core-im");
      var rev = c.classList.contains("rev");
      gsap.from(tx, { scrollTrigger: { trigger: c, start: "top 78%" }, x: rev ? 30 : -30, opacity: 0, duration: 0.6, ease: "power3.out" });
      gsap.from(im, { scrollTrigger: { trigger: c, start: "top 78%" }, x: rev ? -30 : 30, opacity: 0, duration: 0.6, delay: 0.12, ease: "power3.out" });
    });

    // --- Grid ---
    gsap.from(".gi", {
      scrollTrigger: { trigger: ".grid", start: "top 80%" },
      y: 18, opacity: 0, duration: 0.45, stagger: 0.05, ease: "power2.out"
    });

    // --- FAQ ---
    gsap.from(".faq-i", {
      scrollTrigger: { trigger: ".faq-l", start: "top 82%" },
      y: 14, opacity: 0, duration: 0.4, stagger: 0.06, ease: "power2.out"
    });

    // --- Footer wordmark ---
    gsap.from(".ft-wm", {
      scrollTrigger: { trigger: ".ft", start: "top 88%" },
      scale: 1.15, opacity: 0, duration: 0.9, ease: "power2.out"
    });

    // --- Refresh ---
    ScrollTrigger.refresh();
    window.addEventListener("load", function () { ScrollTrigger.refresh(); });
    setTimeout(function () { ScrollTrigger.refresh(); }, 2000);
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
    setTimeout(initGSAP, 50);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
