// NekoCut app.js — GSAP animations, GitHub API, i18n, downloads
(function () {
  "use strict";

  // ===== LANGUAGE TOGGLE =====
  var currentLang = localStorage.getItem("nekocut-lang") ||
    (navigator.language || "en").startsWith("vi") ? "vi" : "en";

  function applyLang(lang) {
    currentLang = lang;
    localStorage.setItem("nekocut-lang", lang);
    document.documentElement.lang = lang;
    var dict = I18N[lang] || I18N.en;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (dict[key] !== undefined) el.textContent = dict[key];
    });
    // Update lang toggle button
    var toggle = document.getElementById("lang-toggle");
    if (toggle) toggle.textContent = lang === "en" ? "VI" : "EN";
  }

  function toggleLang() {
    applyLang(currentLang === "en" ? "vi" : "en");
  }

  // ===== GITHUB API: STARS + RELEASES =====
  var REPO = "the-wiii-lab/NekoCut";
  var API = "https://api.github.com/repos/" + REPO;

  function fmtCount(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + "k";
    return String(n);
  }

  function fetchStars() {
    fetch(API)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var count = d.stargazers_count || 0;
        document.querySelectorAll("[data-stars]").forEach(function (el) {
          el.textContent = fmtCount(count);
        });
      })
      .catch(function () {});
  }

  // Detect OS
  function detectOS() {
    var ua = (navigator.userAgent || "").toLowerCase();
    var plat = (navigator.platform || "").toLowerCase();
    if (ua.includes("mac") || plat.includes("mac")) return "macos";
    if (ua.includes("win") || plat.includes("win")) return "windows";
    if (ua.includes("linux") || plat.includes("linux")) return "linux";
    return "windows";
  }

  function fetchReleases() {
    var os = detectOS();
    var dlWrap = document.getElementById("download-platforms");
    var detectLabel = document.getElementById("dl-detect-label");
    if (!dlWrap) return;

    fetch(API + "/releases/latest")
      .then(function (r) {
        if (!r.ok) throw new Error("no releases");
        return r.json();
      })
      .then(function (rel) {
        // Show version
        document.querySelectorAll("[data-release-ver]").forEach(function (el) {
          el.textContent = rel.tag_name;
        });
        // Parse assets by OS
        var assets = { macos: null, windows: null, linux: null };
        (rel.assets || []).forEach(function (a) {
          var n = a.name.toLowerCase();
          if (n.endsWith(".dmg") || n.endsWith(".zip") && n.includes("mac")) assets.macos = a;
          if (n.endsWith(".exe") || n.endsWith(".msi")) assets.windows = a;
          if (n.endsWith(".appimage") || n.endsWith(".deb") || n.endsWith(".snap")) assets.linux = a;
        });
        // Update buttons
        ["macos", "windows", "linux"].forEach(function (plat) {
          var btn = document.querySelector('[data-dl="' + plat + '"]');
          if (!btn) return;
          var a = assets[plat];
          if (a) {
            btn.href = a.browser_download_url;
            btn.classList.remove("disabled");
          } else {
            btn.href = "https://github.com/" + REPO + "/releases";
            btn.classList.add("disabled");
          }
        });
        // Highlight detected OS
        var primary = document.querySelector('[data-dl="' + os + '"]');
        if (primary) primary.classList.add("detected");
        if (detectLabel) detectLabel.style.display = "";
      })
      .catch(function () {
        // No releases yet — show coming soon
        document.querySelectorAll("[data-dl]").forEach(function (btn) {
          btn.classList.add("disabled");
        });
        document.querySelectorAll("[data-release-ver]").forEach(function (el) {
          var lang = currentLang;
          el.textContent = lang === "vi" ? "Sắp ra mắt" : "Coming soon";
        });
      });
  }

  // ===== FAQ ACCORDION =====
  function initFAQ() {
    document.querySelectorAll(".faq-q").forEach(function (q) {
      q.addEventListener("click", function () {
        var item = this.closest(".faq-item");
        var ans = item.querySelector(".faq-a");
        var isOpen = item.classList.contains("open");
        document.querySelectorAll(".faq-item.open").forEach(function (o) {
          o.classList.remove("open");
          o.querySelector(".faq-a").style.maxHeight = null;
        });
        if (!isOpen) {
          item.classList.add("open");
          ans.style.maxHeight = ans.scrollHeight + "px";
        }
      });
    });
  }

  // ===== GSAP ANIMATIONS =====
  function initGSAP() {
    if (typeof gsap === "undefined") {
      // Fallback: show everything immediately
      document.querySelectorAll(".gsap-fade, .gsap-hero, .gsap-section, .gsap-card, .core-item, .grid-item, .faq-item, .footer-wordmark, .download-section")
        .forEach(function (el) { el.style.opacity = "1"; el.style.transform = "none"; });
      return;
    }

    if (typeof ScrollTrigger !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);
    }

    var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      gsap.set(".gsap-hero, .gsap-section, .gsap-card, .core-item, .grid-item, .faq-item, .footer-wordmark, .download-section", { opacity: 1, y: 0, x: 0, scale: 1 });
      return;
    }

    // --- Hero entrance timeline ---
    var heroTl = gsap.timeline({ delay: 0.15 });
    heroTl
      .from(".hero-badge", { y: 20, opacity: 0, duration: 0.5, ease: "power2.out" })
      .from(".hero h1 .word", { y: 80, opacity: 0, duration: 0.6, stagger: 0.08, ease: "power3.out" }, "-=0.2")
      .from(".hero .sub", { y: 20, opacity: 0, duration: 0.5, ease: "power2.out" }, "-=0.3")
      .from(".hero-cta .btn", { y: 20, opacity: 0, duration: 0.4, stagger: 0.1, ease: "power2.out" }, "-=0.2")
      .from(".hero-shot", { scale: 0.95, opacity: 0, y: 30, duration: 0.7, ease: "power3.out" }, "-=0.3");

    // --- Nav scroll effect ---
    if (typeof ScrollTrigger !== "undefined") {
      var nav = document.querySelector(".nav");
      ScrollTrigger.create({
        trigger: "body",
        start: "60 top",
        onEnter: function () { nav.classList.add("scrolled"); },
        onLeaveBack: function () { nav.classList.remove("scrolled"); }
      });

      // --- Core features: alternating slide-in ---
      document.querySelectorAll(".core-item").forEach(function (item, i) {
        var textCol = item.querySelector(".core-text");
        var imgCol = item.querySelector(".core-img");
        var isReverse = item.classList.contains("reverse");
        gsap.from(textCol, {
          scrollTrigger: { trigger: item, start: "top 80%" },
          x: isReverse ? 50 : -50, opacity: 0, duration: 0.7, ease: "power3.out"
        });
        gsap.from(imgCol, {
          scrollTrigger: { trigger: item, start: "top 80%" },
          x: isReverse ? -50 : 50, opacity: 0, duration: 0.7, delay: 0.15, ease: "power3.out"
        });
      });

      // --- Grid items stagger ---
      gsap.from(".grid-item", {
        scrollTrigger: { trigger: ".grid", start: "top 80%" },
        y: 30, opacity: 0, scale: 0.95, duration: 0.5, stagger: 0.08, ease: "power2.out"
      });

      // --- FAQ items ---
      gsap.from(".faq-item", {
        scrollTrigger: { trigger: ".faq-list", start: "top 85%" },
        x: -20, opacity: 0, duration: 0.4, stagger: 0.1, ease: "power2.out"
      });

      // --- Section headers ---
      document.querySelectorAll(".section-head").forEach(function (head) {
        gsap.from(head.children, {
          scrollTrigger: { trigger: head, start: "top 85%" },
          y: 20, opacity: 0, duration: 0.5, stagger: 0.1, ease: "power2.out"
        });
      });

      // --- Footer wordmark ---
      gsap.from(".footer-wordmark", {
        scrollTrigger: { trigger: ".footer", start: "top 90%" },
        scale: 1.3, opacity: 0, duration: 1, ease: "power2.out"
      });

      // --- Download cards ---
      gsap.from(".download-section .dl-card", {
        scrollTrigger: { trigger: ".download-section", start: "top 80%" },
        y: 30, opacity: 0, duration: 0.5, stagger: 0.1, ease: "power2.out"
      });
    }

    // --- Hero image floating loop ---
    gsap.to(".hero-shot", {
      y: -12, duration: 2.5, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.5
    });
  }

  // ===== INIT =====
  function init() {
    applyLang(currentLang);

    // Split hero h1 into words for GSAP (after i18n text is applied)
    var h1 = document.querySelector(".hero h1");
    if (h1) {
      var words = h1.textContent.trim().split(/\s+/);
      h1.innerHTML = words.map(function (w) {
        var isAccent = w.toLowerCase().includes("beautiful") || w.includes("đẹp");
        var inner = isAccent ? '<span class="accent">' + w + "</span>" : w;
        return '<span class="word" style="display:inline-block;overflow:hidden;vertical-align:top;white-space:nowrap"><span style="display:inline-block">' + inner + "</span></span>";
      }).join(" ");
    }

    // Lang toggle button
    var toggle = document.getElementById("lang-toggle");
    if (toggle) toggle.addEventListener("click", toggleLang);

    initFAQ();
    fetchStars();
    fetchReleases();
    setInterval(fetchStars, 300000); // refresh every 5 min

    // Init GSAP after a tick so DOM is ready
    setTimeout(initGSAP, 50);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
