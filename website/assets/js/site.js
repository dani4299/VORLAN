/* DSRF Softech Studios - site behaviour. No dependencies. Loaded deferred on every page.
 * Forms post natively to FormSubmit (see the form markup), so they work without JavaScript;
 * this file only adds validation, a sending state and the file check. */
(function () {
  "use strict";

  var doc = document;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Mobile menu ---- */
  var toggle = doc.querySelector(".nav__toggle");
  var links = doc.getElementById("nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.querySelector("span").textContent = open ? "Close" : "Menu";
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && links.classList.contains("is-open")) {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.querySelector("span").textContent = "Menu";
        toggle.focus();
      }
    });
  }

  /* ---- Nav border once the page scrolls ---- */
  var nav = doc.querySelector(".nav");
  function onScroll() {
    if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---- Scroll reveals ---- */
  var targets = doc.querySelectorAll(".reveal, .img-reveal");
  if (targets.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("is-in"); });
    } else {
      // Clipped image frames have no visible area to intersect, so their parent is observed instead.
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          if (el.classList.contains("reveal")) el.classList.add("is-in");
          el.querySelectorAll(".img-reveal").forEach(function (child) { child.classList.add("is-in"); });
          io.unobserve(el);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
      var watched = new Set();
      targets.forEach(function (el) {
        var host = el.classList.contains("img-reveal") ? (el.parentElement || el) : el;
        if (!watched.has(host)) { watched.add(host); io.observe(host); }
      });
    }
  }

  /* ---- Gradient sphere: glides down the page as you scroll (every page) ---- */
  var arts = doc.querySelectorAll("[data-parallax]");
  if (arts.length && !reduceMotion) {
    var current = 0;
    var target = 0;
    var running = false;
    var LIMIT = 1100;

    var paint = function () {
      current += (target - current) * 0.1;
      if (Math.abs(target - current) < 0.4) current = target;
      var vh = window.innerHeight || 800;
      // Full strength for the first screen, then it dissolves so it never sits behind body text.
      var fade = 1 - Math.min(1, Math.max(0, (window.scrollY - vh * 0.6) / (vh * 0.9)));
      arts.forEach(function (a) {
        a.style.setProperty("--parallax", current.toFixed(1) + "px");
        a.style.setProperty("--art-opacity", fade.toFixed(3));
      });
      if (current !== target) window.requestAnimationFrame(paint);
      else running = false;
    };

    var onArtScroll = function () {
      target = Math.min(window.scrollY * 1.05, LIMIT);
      if (!running) { running = true; window.requestAnimationFrame(paint); }
    };
    window.addEventListener("scroll", onArtScroll, { passive: true });
    onArtScroll();
  }

  /* ---- Forms ---- */
  var MAX_FILE = 5 * 1024 * 1024;

  doc.querySelectorAll("form[data-form]").forEach(function (form) {
    var status = form.querySelector(".form-status");
    var button = form.querySelector("button[type=submit]");

    function say(text, state) {
      if (!status) return;
      status.textContent = text;
      status.setAttribute("data-state", state || "");
    }

    form.addEventListener("submit", function (event) {
      var problem = null;
      var fields = form.querySelectorAll("[required]");
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i];
        f.removeAttribute("aria-invalid");
        var empty = f.type === "checkbox" ? !f.checked : !String(f.value || "").trim();
        var badEmail = f.type === "email" && !empty && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim());
        if ((empty || badEmail) && !problem) {
          problem = { el: f, msg: f.type === "checkbox"
            ? "Please confirm the consent box so we can consider your application."
            : "Please complete all required fields and enter a valid email address." };
        }
        if (empty || badEmail) f.setAttribute("aria-invalid", "true");
      }

      var file = form.querySelector("input[type=file]");
      if (!problem && file && file.files && file.files[0]) {
        var picked = file.files[0];
        if (!/\.(pdf|doc|docx)$/i.test(picked.name)) {
          problem = { el: file, msg: "Please attach your CV as a PDF, DOC or DOCX file." };
        } else if (picked.size > MAX_FILE) {
          problem = { el: file, msg: "That file is larger than 5 MB. Please attach a smaller version." };
        }
      }

      if (problem) {
        event.preventDefault();
        say(problem.msg, "error");
        problem.el.focus();
        return;
      }

      if (button) button.disabled = true;
      say("One moment: opening the security check…", "");
    });

    // Re-enable if the visitor returns with the back button after submitting.
    window.addEventListener("pageshow", function (e) {
      if (e.persisted && button) { button.disabled = false; say("", ""); }
    });
  });
})();
