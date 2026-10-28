/* ==========================================================
   Folivance Intensive Spray — scroll-driven frame sequence
   GSAP + ScrollTrigger + Lenis (all from CDN, no build step)
   ========================================================== */
(() => {
  "use strict";

  const FRAME_COUNT = 240;
  const IS_MOBILE = window.matchMedia("(max-width: 768px)").matches;
  // Mobile gets the lighter 1280px / q65 set; desktop the full 1920px / q80 set.
  const FRAME_DIR = IS_MOBILE ? "frames_mobile" : "frames";
  const MAX_DPR = IS_MOBILE ? 1.5 : 2;

  const frameSrc = (i) => `${FRAME_DIR}/frame_${String(i + 1).padStart(4, "0")}.webp`;

  // Horizontal focal point per frame, used when the canvas crops the 16:9
  // footage (portrait screens). Keeps the bottle / spray / hair in view.
  const FOCAL_KEYS = [
    [0, 0.5],    // bottle, centered
    [60, 0.5],   // cap opens
    [110, 0.42], // spray from the left onto the follicle
    [160, 0.56], // hair starts growing
    [239, 0.66], // final strong hair, right of center
  ];

  const canvas = document.getElementById("frameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const loader = document.getElementById("loader");
  const loaderBar = document.getElementById("loaderBar");
  const loaderPct = document.getElementById("loaderPct");
  const railItems = document.querySelectorAll(".rail li");

  const images = new Array(FRAME_COUNT);
  const state = { frame: 0 };
  let lastDrawn = -1;
  let rafPending = false;

  /* ---------- Preload ---------- */
  function preload() {
    let done = 0;

    const tick = () => {
      done++;
      const pct = Math.round((done / FRAME_COUNT) * 100);
      loaderBar.style.width = pct + "%";
      loaderPct.textContent = pct;
    };

    const jobs = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.decoding = "async";
      img.src = frameSrc(i);
      images[i] = img;
      jobs.push(
        (img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej; }))
          .catch(() => { /* keep going; a missing frame falls back to the nearest one */ })
          .finally(tick)
      );
    }
    return Promise.all(jobs);
  }

  /* ---------- Canvas ---------- */
  function focalAt(frame) {
    for (let k = 1; k < FOCAL_KEYS.length; k++) {
      const [f1, x1] = FOCAL_KEYS[k];
      const [f0, x0] = FOCAL_KEYS[k - 1];
      if (frame <= f1) {
        const t = (frame - f0) / (f1 - f0);
        return x0 + (x1 - x0) * t;
      }
    }
    return FOCAL_KEYS[FOCAL_KEYS.length - 1][1];
  }

  function nearestLoaded(i) {
    for (let d = 0; d < FRAME_COUNT; d++) {
      const a = images[i - d], b = images[i + d];
      if (a && a.complete && a.naturalWidth) return a;
      if (b && b.complete && b.naturalWidth) return b;
    }
    return null;
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    lastDrawn = -1;
    draw();
  }

  function draw() {
    rafPending = false;
    const i = Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(state.frame)));
    if (i === lastDrawn) return;
    const img = nearestLoaded(i);
    if (!img) return;

    const cw = canvas.width, ch = canvas.height;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max(cw / iw, ch / ih); // cover
    const dw = iw * s, dh = ih * s;

    const fx = focalAt(i);
    let dx = cw / 2 - fx * dw;
    dx = Math.min(0, Math.max(cw - dw, dx));
    const dy = (ch - dh) / 2;

    ctx.drawImage(img, dx, dy, dw, dh);
    lastDrawn = i;
  }

  function requestDraw() {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(draw);
    }
  }

  /* ---------- Smooth scroll ---------- */
  gsap.registerPlugin(ScrollTrigger);

  const lenis = new Lenis({
    lerp: 0.085,
    smoothWheel: true,
    wheelMultiplier: 0.9,
  });
  lenis.stop();
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const target = id === "#top" ? 0 : document.querySelector(id);
      if (target === null) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: 1.6 });
    });
  });

  /* ---------- Word split (keeps <br> and <em>) ---------- */
  function splitWords(el) {
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(" "));
            } else {
              const w = document.createElement("span");
              w.className = "w";
              w.textContent = part;
              frag.appendChild(w);
            }
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== "BR") {
          walk(child);
        }
      });
    };
    walk(el);
  }
  document.querySelectorAll("[data-split]").forEach(splitWords);

  /* ---------- Scroll timeline ---------- */
  function buildTimeline() {
    const mm = gsap.matchMedia();

    mm.add(
      { desktop: "(min-width: 769px)", mobile: "(max-width: 768px)" },
      ({ conditions }) => {
        const centerY = conditions.desktop ? -50 : 0;
        const phases = gsap.utils.toArray(".phase");
        const [p1, p2, p3, p4] = phases;
        const q = (phase, sel) => phase.querySelectorAll(sel);

        gsap.set(phases, { yPercent: centerY });
        gsap.set([p2, p3, p4], { autoAlpha: 0 });
        gsap.set(p1, { autoAlpha: 1 });
        gsap.set(".scrim--right", { autoAlpha: 1 });
        gsap.set(".scrim--left", { autoAlpha: 0 });

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: "#story",
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            onUpdate: (self) => setRail(self.progress),
          },
        });

        // Frames span the whole 500vh. The timeline is normalised to 0 → 1.
        tl.to(state, { frame: FRAME_COUNT - 1, duration: 1, onUpdate: requestDraw }, 0);

        // Phase entrance: gold line draws, number + label rise, then the
        // headline arrives word by word out of a soft blur.
        const enter = (phase, at) => {
          tl.set(phase, { autoAlpha: 1, y: 0, filter: "blur(0px)" }, at)
            .fromTo(q(phase, ".phase__line"), { scaleX: 0 }, { scaleX: 1, duration: 0.04, ease: "power2.out" }, at)
            .fromTo(q(phase, ".phase__num, .phase__label"),
              { autoAlpha: 0, y: 12 },
              { autoAlpha: 1, y: 0, duration: 0.025, stagger: 0.008, ease: "power2.out" }, at)
            .fromTo(q(phase, ".w"),
              { autoAlpha: 0, y: 46, filter: "blur(12px)" },
              { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.035, stagger: 0.007, ease: "power3.out" }, at + 0.012);
          const sub = q(phase, ".phase__sub");
          if (sub.length) {
            tl.fromTo(sub, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.03, ease: "power2.out" }, at + 0.04);
          }
        };
        // Phase exit: the whole block lifts away into blur.
        const leave = (phase, at) => {
          tl.to(phase, { autoAlpha: 0, y: -50, filter: "blur(10px)", duration: 0.035, ease: "power2.in" }, at);
        };

        tl.to("#scrollHint", { autoAlpha: 0, duration: 0.03 }, 0.005);

        // 1 — the bottle (0 → 0.25)
        leave(p1, 0.195);
        // 2 — cap opens, spray (0.25 → 0.5)
        enter(p2, 0.255);
        leave(p2, 0.445);
        // light wash swaps sides with the text
        tl.to(".scrim--right", { autoAlpha: 0, duration: 0.04 }, 0.46)
          .to(".scrim--left", { autoAlpha: 1, duration: 0.04 }, 0.48);
        // 3 — follicle begins to grow (0.5 → 0.75)
        enter(p3, 0.505);
        leave(p3, 0.70);
        // 4 — final hair, features one after another (0.75 → 1)
        tl.set(p4, { autoAlpha: 1, y: 0, filter: "blur(0px)" }, 0.755)
          .fromTo(q(p4, ".phase__line"), { scaleX: 0 }, { scaleX: 1, duration: 0.04, ease: "power2.out" }, 0.755)
          .fromTo(q(p4, ".phase__num, .phase__label"),
            { autoAlpha: 0, y: 12 },
            { autoAlpha: 1, y: 0, duration: 0.025, stagger: 0.008, ease: "power2.out" }, 0.755);
        q(p4, ".feature").forEach((item, i) => {
          const at = 0.78 + i * 0.055;
          tl.fromTo(item.querySelector(".feature__rule"), { scaleX: 0 }, { scaleX: 1, duration: 0.04, ease: "power2.inOut" }, at)
            .fromTo(item.querySelectorAll(".feature__num, .feature__text"),
              { autoAlpha: 0, y: 26, filter: "blur(8px)" },
              { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.035, stagger: 0.008, ease: "power3.out" }, at + 0.012);
        });

        return () => tl.scrollTrigger && tl.scrollTrigger.kill();
      }
    );
  }

  function setRail(progress) {
    const phase = Math.min(3, Math.floor(progress * 4));
    railItems.forEach((li, i) => li.classList.toggle("is-active", i === phase));
  }

  /* ---------- Intro after loading ---------- */
  function intro() {
    document.body.classList.remove("is-loading");
    loader.classList.add("is-done");
    lenis.start();
    const p1 = document.querySelector(".phase--1");
    gsap.timeline({ delay: 0.35 })
      .from(p1.querySelector(".phase__line"), { scaleX: 0, duration: 1, ease: "power2.out" })
      .from(p1.querySelectorAll(".phase__num, .phase__label"), { autoAlpha: 0, y: 12, duration: 0.8, stagger: 0.1, ease: "power2.out" }, 0)
      .from(p1.querySelectorAll(".w"), { autoAlpha: 0, y: 46, filter: "blur(12px)", duration: 1.1, stagger: 0.09, ease: "power3.out" }, 0.25);
    gsap.from(".header", { autoAlpha: 0, y: -12, duration: 1, ease: "power2.out", delay: 0.2 });
  }

  /* ---------- Boot ---------- */
  window.scrollTo(0, 0);
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  // Observe the canvas itself: it also changes size when the scrollbar
  // appears after loading, which doesn't fire a window resize.
  let resizeTimer;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeCanvas();
      ScrollTrigger.refresh();
    }, 120);
  }).observe(canvas);

  resizeCanvas();
  setRail(0);

  preload().then(() => {
    resizeCanvas();
    buildTimeline();
    ScrollTrigger.refresh();
    intro();
  });
})();
