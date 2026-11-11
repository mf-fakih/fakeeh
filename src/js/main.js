/*
 * Fakeeh portfolio — interactions.
 *
 * One classic script (works from file:// and needs no bundler), organised as
 * small init functions. `boot()` at the bottom is the only thing that runs
 * them, in an order that is safe on a hard refresh:
 *
 *   1. smooth scroll        Lenis driven by the GSAP ticker
 *   2. hero hidden states   set while the preloader still covers the page
 *   3. preloader            counts, waits for fonts + hero image, splits
 *   4. scroll effects       every ScrollTrigger, created once
 *   5. refresh              after fonts / resize, so positions stay correct
 *
 * Every block degrades on its own: no GSAP, no ScrollTrigger, no hover, or
 * prefers-reduced-motion each leave readable, final-state content behind.
 */
(() => {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Environment + helpers                                               */
  /* ------------------------------------------------------------------ */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGsap = typeof window.gsap !== "undefined";
  const hasST = hasGsap && typeof window.ScrollTrigger !== "undefined";

  /** Duration helper: collapses to an instant under reduced motion. */
  const dur = (seconds) => (reduce ? 0.01 : seconds);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pad2 = (n) => String(n).padStart(2, "0");

  if (hasST) gsap.registerPlugin(ScrollTrigger);

  /* ------------------------------------------------------------------ */
  /* 1. Smooth scroll — Lenis in sync with ScrollTrigger                 */
  /* ------------------------------------------------------------------ */

  let lenis = null;

  const initSmoothScroll = () => {
    if (reduce || typeof window.Lenis === "undefined") return;

    lenis = new Lenis({
      lerp: 0.085,
      wheelMultiplier: 1,
      touchMultiplier: 1.7,
      smoothWheel: true,
    });

    if (hasGsap) {
      // One clock for everything: GSAP's ticker drives Lenis, and every Lenis
      // scroll frame tells ScrollTrigger to re-read the position.
      if (hasST) lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const loop = (time) => {
        lenis.raf(time);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  };

  // Temporarily unstick elements to measure their document position.
  const docTop = (el) => {
    const sticky = getComputedStyle(el).position === "sticky";
    if (sticky) el.style.position = "static";
    const y = el.getBoundingClientRect().top + scrollY;
    if (sticky) el.style.position = "";
    return Math.max(0, y);
  };

  const goTo = (el) => {
    if (!el) return;
    const y = docTop(el);
    if (lenis) lenis.scrollTo(y, { duration: 1.25 });
    else scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  };

  const initAnchors = () => {
    $$("[data-nav-link]").forEach((link) => {
      link.addEventListener("click", (e) => {
        const id = link.getAttribute("href") || "";
        if (!id.startsWith("#")) return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        goTo(target);
        history.replaceState(null, "", id);
      });
    });
  };

  /* ------------------------------------------------------------------ */
  /* Text splitting                                                      */
  /* ------------------------------------------------------------------ */

  // Each part becomes <span.sp-w (mask)><span.sp-i (moves)>text</span></span>.
  const wrapPart = (text) => {
    const outer = document.createElement("span");
    outer.className = "sp-w";
    const inner = document.createElement("span");
    inner.className = "sp-i";
    inner.textContent = text;
    outer.appendChild(inner);
    return { outer, inner };
  };

  const splitWords = (el) => {
    const words = (el.textContent || "").trim().split(/\s+/).filter(Boolean);
    el.textContent = "";
    return words.map((word, i) => {
      const { outer, inner } = wrapPart(word);
      el.appendChild(outer);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
      return inner;
    });
  };

  const splitChars = (el) => {
    const chars = Array.from((el.textContent || "").trim());
    el.textContent = "";
    return chars.map((ch) => {
      const { outer, inner } = wrapPart(ch === " " ? " " : ch);
      el.appendChild(outer);
      return inner;
    });
  };

  // Which visual line each word sits on, read at the moment of the reveal so
  // it is correct for the current width (no re-splitting needed on resize).
  const lineIndexes = (parts) => {
    const tops = [];
    return parts.map((part) => {
      const top = Math.round(part.parentElement.offsetTop);
      let line = tops.indexOf(top);
      if (line === -1) line = tops.push(top) - 1;
      return line;
    });
  };

  /* ------------------------------------------------------------------ */
  /* 2. Hero — hidden states, intro, scroll parallax, pointer tilt       */
  /* ------------------------------------------------------------------ */

  const hero = {
    title: $("[data-hero-title]"),
    name: $("[data-hero-name]"),
    img: $("[data-hero-img]"),
    chars: [],
    wraps: [],
    nameLines: [],
    ups: [],
    pops: [],
  };

  // Runs while the preloader covers the page, so nothing flashes.
  const prepHero = () => {
    if (hero.title) {
      hero.chars = splitChars(hero.title);
      hero.wraps = hero.chars.map((c) => c.parentElement);
    }
    hero.nameLines = hero.name ? $$(".hero-name__line > span", hero.name) : [];

    if (!hasGsap) return;

    // Tailwind centers with `translate`; GSAP animates `transform`, so the two never fight.
    gsap.set(hero.chars, { yPercent: 105, rotate: 4, force3D: true });
    gsap.set(hero.nameLines, { yPercent: 110 });
    if (hero.img) gsap.set(hero.img, { yPercent: 5, opacity: 0 });
    hero.ups = $$('#hero [data-anim="up"]');
    hero.pops = $$('#hero [data-anim="pop"]');
    if (hero.ups.length) gsap.set(hero.ups, { opacity: 0, y: 22 });
    if (hero.pops.length) gsap.set(hero.pops, { opacity: 0, scale: 0.7 });
  };

  const heroIntro = (dock) => {
    if (!hasGsap) return dock.reveal();

    const tl = gsap.timeline({
      onComplete: () => gsap.set(hero.wraps, { clipPath: "none" }),
    });

    tl.to(hero.chars, {
      yPercent: 0,
      rotate: 0,
      duration: dur(1.6),
      ease: "power4.out",
      stagger: reduce ? 0 : 0.07,
    })
      .to(
        hero.wraps,
        {
          clipPath: "inset(-45% -25% -45% -25%)",
          duration: dur(1.4),
          ease: "power2.inOut",
          stagger: reduce ? 0 : 0.07,
        },
        reduce ? 0 : 0.9,
      )
      .call(dock.reveal, null, reduce ? 0 : 0.8);

    if (hero.img) {
      tl.to(hero.img, { yPercent: 0, opacity: 1, duration: dur(1.5), ease: "expo.out" }, 0.15);
    }
    if (hero.nameLines.length) {
      tl.to(
        hero.nameLines,
        { yPercent: 0, duration: dur(1.2), ease: "expo.out", stagger: reduce ? 0 : 0.12 },
        0.45,
      );
    }
    if (hero.ups.length) {
      tl.to(hero.ups, { opacity: 1, y: 0, duration: dur(0.9), ease: "expo.out", stagger: 0.09 }, 0.3);
    }
    if (hero.pops.length) {
      tl.to(
        hero.pops,
        { opacity: 1, scale: 1, duration: dur(0.9), ease: reduce ? "none" : "back.out(1.7)" },
        0.5,
      );
    }
  };

  const initHeroScroll = () => {
    if (!hasST || reduce || !hero.title) return;
    const spread = hero.chars.length > 1 ? (hero.chars.length - 1) / 2 : 0;

    // Layers leave at different speeds as <main> slides over the sticky hero.
    gsap
      .timeline({
        scrollTrigger: {
          trigger: "main",
          start: () => `top ${innerHeight - 100}px`,
          end: "top top",
          scrub: true,
          invalidateOnRefresh: true,
        },
      })
      .to(hero.title, { y: -70, scale: 0.9, opacity: 0.45, ease: "none" }, 0)
      .to(hero.chars, { xPercent: (i) => (i - spread) * 9, ease: "none" }, 0)
      .to("[data-hero-portrait]", { yPercent: 8, scale: 1.07, ease: "none" }, 0)
      .to(hero.name, { yPercent: -70, opacity: 0.35, ease: "none" }, 0)
      .to("[data-hero-card]", { scale: 0.95, ease: "none" }, 0);
  };

  const initHeroTilt = () => {
    const tilt = $("[data-hero-tilt]");
    if (!tilt || !canHover || reduce || !hasGsap) return;

    const toX = gsap.quickTo(tilt, "x", { duration: 0.9, ease: "power3" });
    const toY = gsap.quickTo(tilt, "y", { duration: 0.9, ease: "power3" });

    addEventListener(
      "pointermove",
      (e) => {
        if (e.clientY > innerHeight) return;
        toX((e.clientX / innerWidth - 0.5) * -34);
        toY((e.clientY / innerHeight - 0.5) * -22);
      },
      { passive: true },
    );
  };

  /* ------------------------------------------------------------------ */
  /* 3. Preloader — split-curtain typography                             */
  /* ------------------------------------------------------------------ */

  // Counts 0 → 100 (power4.inOut), then waits until fonts and the hero image
  // are really there (capped) before the two halves part. `onReveal` starts
  // the hero intro while the curtains are still moving.
  const initPreloader = (onReveal) => {
    const loader = $("[data-loader]");
    if (!loader) return onReveal();

    if (!hasGsap) {
      loader.remove();
      return onReveal();
    }

    loader.style.animation = "none"; // the script is alive: cancel the CSS failsafe

    const counts = $$("[data-loader-count]", loader);
    const top = $('[data-loader-half="top"]', loader);
    const bottom = $('[data-loader-half="bottom"]', loader);
    const seam = $("[data-loader-seam]", loader);
    const state = { value: 0 };
    const span = dur(2.2);

    const render = () => {
      const value = String(Math.round(state.value));
      counts.forEach((el) => (el.textContent = value));
    };

    if (lenis) lenis.stop();

    const exit = gsap
      .timeline({
        paused: true,
        onComplete: () => {
          loader.classList.add("is-done");
          if (lenis) lenis.start();
        },
      })
      // The backing colour hid any sub-pixel gap on the seam; drop it now.
      .set(loader, { backgroundColor: "transparent" })
      .set(seam, { transformOrigin: "100% 50%" })
      .to(seam, { scaleX: 0, duration: dur(0.6), ease: "power4.inOut" }, 0)
      .to(top, { yPercent: -100, duration: dur(1.3), ease: "power4.inOut" }, 0.12)
      .to(bottom, { yPercent: 100, duration: dur(1.3), ease: "power4.inOut" }, 0.12)
      .call(onReveal, null, reduce ? 0 : 0.6);

    let counted = false;
    let ready = false;
    let leaving = false;

    const tryExit = () => {
      if (leaving || !counted || !ready) return;
      leaving = true;
      if (hasST) ScrollTrigger.refresh();
      exit.play();
    };

    const count = () => {
      loader.classList.add("is-live");
      gsap.to(state, {
        value: 100,
        duration: span,
        ease: "power4.inOut",
        onUpdate: render,
        onComplete: () => {
          render();
          counted = true;
          tryExit();
        },
      });
      gsap.to(seam, { scaleX: 1, duration: span, ease: "power4.inOut" });
    };

    // Start counting once the numeral font is in (or after 1.2s, whichever is first).
    const numeralFont = document.fonts?.load
      ? document.fonts.load('1em "Archivo Black"', "0123456789")
      : Promise.resolve();
    Promise.race([numeralFont, wait(1200)])
      .catch(() => {})
      .then(count);

    const imageReady =
      !hero.img || hero.img.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            hero.img.addEventListener("load", resolve, { once: true });
            hero.img.addEventListener("error", resolve, { once: true });
          });
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();

    Promise.race([Promise.all([fontsReady, imageReady]), wait(3500)])
      .catch(() => {})
      .then(() => {
        ready = true;
        tryExit();
      });
  };

  /* ------------------------------------------------------------------ */
  /* 4a. Scroll reveals — fades, pops, word / line / char splits         */
  /* ------------------------------------------------------------------ */

  const initReveals = () => {
    if (!hasST) return;

    const presets = {
      up: { y: 34, opacity: 0 },
      fade: { opacity: 0 },
      pop: { scale: 0.74, opacity: 0 },
    };

    $$("[data-anim]")
      .filter((el) => !el.closest("#hero"))
      .forEach((el) => {
        gsap.set(el, presets[el.dataset.anim] || presets.up);
        gsap.to(el, {
          y: 0,
          scale: 1,
          opacity: 1,
          duration: dur(1),
          ease: "expo.out",
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
        });
      });

    $$("[data-split]").forEach((el) => {
      if (el === hero.title) return;

      const mode = el.dataset.split;
      const parts = mode === "chars" ? splitChars(el) : splitWords(el);

      if (el.hasAttribute("data-fade-words")) return;

      gsap.set(parts, { yPercent: 115 });

      if (mode === "lines") {
        // Words on the same line rise together; lines follow each other.
        ScrollTrigger.create({
          trigger: el,
          start: "top 88%",
          once: true,
          onEnter: () => {
            const lines = lineIndexes(parts);
            gsap.to(parts, {
              yPercent: 0,
              duration: dur(1.25),
              ease: "expo.out",
              stagger: (i) => (reduce ? 0 : lines[i] * 0.13),
            });
          },
        });
        return;
      }

      gsap.to(parts, {
        yPercent: 0,
        duration: dur(1.1),
        ease: "expo.out",
        stagger: reduce ? 0 : mode === "chars" ? 0.03 : 0.075,
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
    });

    $$("[data-slide]").forEach((el) => {
      const dir = el.dataset.slide === "right" ? 1 : -1;
      gsap.set(el, { xPercent: reduce ? 0 : 14 * dir, opacity: 0 });
      gsap.to(el, {
        xPercent: 0,
        opacity: 1,
        duration: dur(1.1),
        ease: "expo.out",
        scrollTrigger: { trigger: el, start: "top 92%", once: true },
      });
    });

    if (reduce) return;

    // Paragraph that "inks in" word by word as it crosses the viewport.
    $$("[data-fade-words]").forEach((el) => {
      gsap.to($$(".sp-i", el), {
        opacity: 1,
        ease: "none",
        stagger: 0.5,
        scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 55%", scrub: true },
      });
    });

    // Work rows arrive as a staggered batch.
    const rows = $$("[data-work-list] > li");
    if (rows.length) {
      gsap.set(rows, { y: 46, opacity: 0 });
      ScrollTrigger.batch(rows, {
        start: "top 94%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            y: 0,
            opacity: 1,
            duration: 1.1,
            ease: "expo.out",
            stagger: 0.09,
            overwrite: true,
          }),
      });
    }
  };

  /* ------------------------------------------------------------------ */
  /* 4b. Parallax — scrubbed, transform-only                             */
  /* ------------------------------------------------------------------ */

  const initParallax = () => {
    if (!hasST || reduce) return;

    // Image drifting inside its mask.
    $$("[data-parallax-mask]").forEach((mask) => {
      const img = $("[data-parallax-img]", mask);
      if (!img) return;
      const amount = parseFloat(mask.dataset.parallaxMask) || 8;
      gsap.fromTo(
        img,
        { yPercent: -amount },
        {
          yPercent: amount,
          ease: "none",
          scrollTrigger: { trigger: mask, start: "top bottom", end: "bottom top", scrub: true },
        },
      );
    });

    // Small decorations float at their own speed. The value is ±% of the
    // element's own height; yPercent keeps clear of the reveal tween's `y`.
    $$("[data-parallax]").forEach((el) => {
      const amount = parseFloat(el.dataset.parallax) || 30;
      gsap.fromTo(
        el,
        { yPercent: amount },
        {
          yPercent: -amount,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.8 },
        },
      );
    });

    // Oversized type sliding sideways.
    $$("[data-drift]").forEach((el) => {
      gsap.fromTo(
        el,
        { xPercent: 5 },
        {
          xPercent: -5,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.6 },
        },
      );
    });

    // Contact content eases back as the footer covers it.
    const footer = $(".site-footer");
    const contactKids = $$("#contact > *");
    if (footer && contactKids.length) {
      gsap.to(contactKids, {
        yPercent: -6,
        opacity: 0.5,
        ease: "none",
        scrollTrigger: { trigger: footer, start: "top bottom", end: "bottom bottom", scrub: true },
      });
    }
  };

  /* ------------------------------------------------------------------ */
  /* 4c. Stats counters                                                  */
  /* ------------------------------------------------------------------ */

  // The HTML already holds the final numbers ("3+", "12+", "7"), so the worst
  // case — no JS, no GSAP, reduced motion — is a correct static value, never
  // a stuck 0. An IntersectionObserver starts the count: it fires on real
  // visibility, so it cannot be thrown off by pinned/sticky layout maths.
  const initCounters = () => {
    const els = $$("[data-count]");
    if (!els.length || !hasGsap || reduce || !("IntersectionObserver" in window)) return;

    const tweens = new Map();

    els.forEach((el, i) => {
      const target = Number(el.dataset.count) || 0;
      const suffix = el.dataset.countSuffix || "";
      const state = { value: 0 };
      const render = () => (el.textContent = Math.round(state.value) + suffix);

      render(); // show 0 only once we know the tween exists to move it

      tweens.set(
        el,
        gsap.to(state, {
          value: target,
          duration: 1.8,
          delay: i * 0.12,
          ease: "power3.out",
          paused: true,
          onUpdate: render,
          onComplete: () => (el.textContent = target + suffix),
        }),
      );
    });

    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          tweens.get(entry.target)?.play();
          io.unobserve(entry.target);
        }),
      { threshold: 0.35 },
    );

    els.forEach((el) => io.observe(el));
  };

  /* ------------------------------------------------------------------ */
  /* 4d. Marquees — looped, velocity-reactive                            */
  /* ------------------------------------------------------------------ */

  const initMarquees = () => {
    if (!hasGsap) return;
    const loops = [];

    $$("[data-marquee]").forEach((wrap) => {
      const track = $("[data-marquee-track]", wrap);
      const seed = track && $(".marquee__item", track);
      if (!seed) return;

      let guard = 0;
      while (track.scrollWidth < wrap.offsetWidth + seed.offsetWidth && guard++ < 24) {
        track.appendChild(seed.cloneNode(true));
      }
      Array.from(track.children).forEach((node) => track.appendChild(node.cloneNode(true)));

      const speed = parseFloat(wrap.dataset.speed) || 0.5;
      const distance = track.scrollWidth / 2;
      const reverse = wrap.dataset.direction === "-1";

      const loop = gsap.fromTo(
        track,
        { xPercent: reverse ? -50 : 0 },
        {
          xPercent: reverse ? 0 : -50,
          ease: "none",
          repeat: -1,
          duration: Math.max(6, distance / (120 * speed)),
        },
      );
      loops.push(loop);

      // Only run while on screen.
      if (hasST) {
        ScrollTrigger.create({
          trigger: wrap,
          start: "top bottom",
          end: "bottom top",
          onToggle: (self) => (self.isActive ? loop.play() : loop.pause()),
        });
      }
    });

    if (!loops.length || !hasST || reduce) return;

    // Scroll speed and direction lean on the loops.
    ScrollTrigger.create({
      onUpdate: (self) => {
        const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 2400, 2.6);
        const scale = (self.direction || 1) * boost;
        loops.forEach((loop) => gsap.to(loop, { timeScale: scale, duration: 0.5, overwrite: true }));
      },
    });
  };

  /* ------------------------------------------------------------------ */
  /* 4e. Certificates — pinned horizontal scroll + lightbox              */
  /* ------------------------------------------------------------------ */

  const initCertificates = () => {
    const cert = $("[data-cert]");
    if (!cert) return;

    const stage = $("[data-cert-stage]", cert);
    const viewport = $("[data-cert-viewport]", cert);
    const track = $("[data-cert-track]", cert);
    const rail = $("[data-cert-rail]", cert);
    const countEl = $("[data-cert-count]", cert);
    const cards = $$("[data-cert-card]", cert);

    // Without ScrollTrigger (or with reduced motion) it becomes a native swipe row.
    if (!hasST || reduce || !stage || !track || !viewport) {
      cert.classList.add("cert-fallback");
      return;
    }

    const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);

    gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: stage,
        start: "top top",
        end: () => "+=" + (distance() + innerHeight * 0.35),
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (rail) gsap.set(rail, { scaleX: self.progress });
          if (countEl && cards.length) {
            const index = Math.min(cards.length, Math.max(1, Math.ceil(self.progress * cards.length)));
            countEl.textContent = `${pad2(index)} / ${pad2(cards.length)}`;
          }
        },
      },
    });
  };

  const initLightbox = () => {
    const box = $("[data-lightbox]");
    const cards = $$("[data-cert-card]").filter((c) => c.dataset.full);
    if (!cards.length) return;

    const supported = box && typeof box.showModal === "function";
    const img = supported ? $("[data-lightbox-img]", box) : null;
    const title = supported ? $("[data-lightbox-title]", box) : null;
    const meta = supported ? $("[data-lightbox-meta]", box) : null;
    const count = supported ? $("[data-lightbox-count]", box) : null;
    let current = 0;

    // Certificate images load only when opened, so they cost nothing up front.
    const show = (i) => {
      current = (i + cards.length) % cards.length;
      const card = cards[current];
      img.src = card.dataset.full;
      img.alt = card.dataset.alt || card.dataset.title || "Certificate";
      title.textContent = card.dataset.title || "";
      meta.textContent = card.dataset.meta || "";
      if (count) count.textContent = pad2(current + 1) + " / " + pad2(cards.length);

      img.style.animation = "none";
      void img.offsetWidth;
      img.style.animation = "";
    };

    cards.forEach((card, i) => {
      $("[data-cert-open]", card)?.addEventListener("click", () => {
        if (!supported) {
          open(card.dataset.full, "_blank", "noopener");
          return;
        }
        show(i);
        if (lenis) lenis.stop();
        box.showModal();
      });
    });

    if (!supported) return;

    $("[data-lightbox-close]", box)?.addEventListener("click", () => box.close());
    $("[data-lightbox-prev]", box)?.addEventListener("click", () => show(current - 1));
    $("[data-lightbox-next]", box)?.addEventListener("click", () => show(current + 1));

    box.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") show(current - 1);
      if (e.key === "ArrowRight") show(current + 1);
    });

    box.addEventListener("click", (e) => {
      if (e.target === box || e.target.classList.contains("lightbox__stage")) box.close();
    });

    box.addEventListener("close", () => {
      if (lenis) lenis.start();
      img.removeAttribute("src");
    });
  };

  /* ------------------------------------------------------------------ */
  /* 4f. Selected work — cursor-following preview card (gsap.quickTo)    */
  /* ------------------------------------------------------------------ */

  const initWorkPreview = () => {
    const list = $("[data-work-list]");
    const preview = $("[data-work-preview]");
    if (!list || !preview || !canHover || reduce || !hasGsap) return;

    const slides = $$("[data-work-slide]", preview);
    // quickTo reuses one tween per property: no garbage on every mousemove.
    const toX = gsap.quickTo(preview, "x", { duration: 0.55, ease: "power3" });
    const toY = gsap.quickTo(preview, "y", { duration: 0.55, ease: "power3" });
    const toTilt = gsap.quickTo(preview, "rotation", { duration: 0.7, ease: "power3" });
    const settle = gsap.delayedCall(0.12, () => toTilt(0)).pause();
    let current = -1;
    let pointer = null;

    gsap.set(preview, { scale: 0.82 });

    const follow = (x, y, snap) => {
      const tx = x - preview.offsetWidth / 2;
      const ty = y - preview.offsetHeight / 2;
      if (snap) {
        toX(tx, tx);
        toY(ty, ty);
      } else {
        toX(tx);
        toY(ty);
      }
    };

    const hide = () => {
      if (current === -1) return;
      current = -1;
      preview.classList.remove("is-on");
      gsap.to(preview, { scale: 0.82, duration: 0.45, ease: "power2.out" });
    };

    const show = (row, snap) => {
      const index = Number(row.dataset.work);
      if (index === current) return;
      const slide = slides[index];
      if (!slide) return hide();

      const wasHidden = current === -1;
      current = index;
      if (pointer) follow(pointer.x, pointer.y, snap || wasHidden);
      slides.forEach((s) => s.classList.toggle("is-on", s === slide));
      preview.classList.add("is-on");
      gsap.to(preview, { scale: 1, duration: 0.7, ease: "expo.out" });
    };

    addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType !== "mouse") return;
        const dx = pointer ? e.clientX - pointer.x : 0;
        pointer = { x: e.clientX, y: e.clientY };
        if (current === -1) return;
        follow(pointer.x, pointer.y, false);
        // The card leans into the direction of travel, then settles upright.
        toTilt(gsap.utils.clamp(-12, 12, dx * 0.45));
        settle.restart(true);
      },
      { passive: true },
    );

    $$("[data-work]", list).forEach((row) => {
      row.addEventListener("pointerenter", (e) => {
        if (e.pointerType !== "mouse") return;
        pointer = { x: e.clientX, y: e.clientY };
        show(row, false);
      });
    });

    list.addEventListener("pointerleave", hide);

    // Rows move under a still cursor while scrolling: re-check what is hovered.
    addEventListener(
      "scroll",
      () => {
        if (!pointer) return;
        const el = document.elementFromPoint(pointer.x, pointer.y);
        const row = el && el.closest("[data-work]");
        if (row && list.contains(row)) show(row, true);
        else hide();
      },
      { passive: true },
    );
  };

  /* ------------------------------------------------------------------ */
  /* 4g. Dock — liquid-glass nav that adapts to what is underneath       */
  /* ------------------------------------------------------------------ */

  // Position, tone and active state are plain classes + CSS transitions, so
  // the dock keeps working even if GSAP fails to load.
  const initDock = () => {
    const dock = $("[data-dock]");
    if (!dock) return { reveal() {} };

    const links = $$("[data-dock-link]", dock);
    const pill = $("[data-dock-pill]", dock);
    const sections = links.map((link) => document.querySelector(link.getAttribute("href")));
    const contact = $("#contact");
    let active = -2;
    let queued = false;

    const placePill = () => {
      const link = links[active];
      if (!pill) return;
      if (!link) return pill.classList.remove("is-on");
      pill.style.setProperty("--x", link.offsetLeft + "px");
      pill.style.setProperty("--w", link.offsetWidth + "px");
      pill.classList.add("is-on");
    };

    const setActive = (index) => {
      if (index === active) return;
      active = index;
      links.forEach((link, i) => {
        link.classList.toggle("is-active", i === index);
        if (i === index) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
      placePill();
    };

    // Reads the theme of whatever is painted behind the dock's resting spot.
    const readTone = () => {
      const gap = parseFloat(getComputedStyle(dock).bottom) || 18;
      const y = innerHeight - gap - dock.offsetHeight / 2;
      const stack = document.elementsFromPoint(innerWidth / 2, y);
      for (const el of stack) {
        if (dock.contains(el)) continue;
        const themed = el.closest("[data-theme]");
        if (themed) return themed.dataset.theme;
      }
      return null;
    };

    const update = () => {
      queued = false;

      const tone = readTone();
      if (tone) dock.dataset.tone = tone;

      let index = -1;
      sections.forEach((section, i) => {
        if (section && section.getBoundingClientRect().top <= innerHeight * 0.5) index = i;
      });
      setActive(index);

      // Step aside once the contact section has arrived.
      const away = !!contact && contact.getBoundingClientRect().top <= innerHeight * 0.45;
      dock.classList.toggle("is-away", away);
    };

    const queue = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    };

    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue);
    document.fonts?.ready.then(() => {
      placePill();
      queue();
    });

    // Sheen follows the pointer across the glass.
    if (canHover && !reduce) {
      dock.addEventListener("pointermove", (e) => {
        const r = dock.getBoundingClientRect();
        dock.style.setProperty("--gx", `${e.clientX - r.left}px`);
        dock.style.setProperty("--gy", `${e.clientY - r.top}px`);
      });
      dock.addEventListener("pointerleave", () => {
        dock.style.removeProperty("--gx");
        dock.style.removeProperty("--gy");
      });
    }

    return {
      reveal() {
        dock.classList.add("is-ready");
        update();
      },
    };
  };

  /* ------------------------------------------------------------------ */
  /* 4h. Contact signature, magnetic button, clock, scrawl               */
  /* ------------------------------------------------------------------ */

  const initSignature = () => {
    const svg = $("[data-sign-draw]");
    if (!svg || !hasGsap || reduce) return;

    const strokes = $$("path", svg);
    const fill = $("[data-sign-fill]", svg);
    const total = strokes.reduce((t, p) => t + (+p.dataset.len || 1), 0);
    const DRAW = 2.6;

    gsap.set(strokes, { strokeDasharray: "1 1", strokeDashoffset: 1, visibility: "hidden" });
    gsap.set(fill, { opacity: 0 });

    const tl = gsap.timeline({ paused: true });
    strokes.forEach((p) => {
      const d = Math.max(0.035, ((+p.dataset.len || 1) / total) * DRAW);
      tl.set(p, { visibility: "visible" }).to(p, { strokeDashoffset: 0, duration: d, ease: "none" });
    });
    tl.to(fill, { opacity: 1, duration: 0.5, ease: "power1.out" }, "-=0.15");

    if (hasST) {
      ScrollTrigger.create({
        trigger: "#contact",
        start: "top 55%",
        onEnter: () => tl.play(),
        onLeaveBack: () => tl.pause(0),
      });
    } else {
      tl.play();
    }
  };

  const initMagnetic = () => {
    if (!canHover || reduce) return;

    $$("[data-magnetic]").forEach((el) => {
      const pull = 0.34;

      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${(e.clientX - (r.left + r.width / 2)) * pull}px`);
        el.style.setProperty("--my", `${(e.clientY - (r.top + r.height / 2)) * pull}px`);
      });

      const reset = () => {
        el.style.setProperty("--mx", "0px");
        el.style.setProperty("--my", "0px");
      };

      el.addEventListener("pointerleave", reset);
      el.addEventListener("blur", reset);
    });
  };

  const initClock = () => {
    const clocks = $$("[data-clock]");
    if (!clocks.length) return;

    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const tick = () => {
      const now = fmt.format(new Date());
      clocks.forEach((el) => (el.textContent = now));
    };
    tick();
    setInterval(tick, 15000);
  };

  const initScrawls = () => {
    const scrawls = $$("[data-scrawl]");
    if (!scrawls.length) return;

    if (reduce || !("IntersectionObserver" in window)) {
      scrawls.forEach((s) => s.classList.add("is-drawn"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-drawn");
          io.unobserve(e.target);
        }),
      { threshold: 0.6 },
    );
    scrawls.forEach((s) => io.observe(s));
  };

  /* ------------------------------------------------------------------ */
  /* 5. Boot                                                             */
  /* ------------------------------------------------------------------ */

  const boot = () => {
    // Always start at the top: the intro is choreographed for scroll 0, and a
    // restored mid-page position would fire scroll reveals behind the loader.
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    scrollTo(0, 0);

    initSmoothScroll();
    initAnchors();

    const dock = initDock();
    prepHero();
    initPreloader(() => heroIntro(dock));

    initHeroScroll();
    initHeroTilt();
    initReveals();
    initParallax();
    initCounters();
    initMarquees();
    initCertificates();
    initLightbox();
    initWorkPreview();
    initSignature();
    initMagnetic();
    initClock();
    initScrawls();

    if (!hasST) return;

    // Late layout changes (web fonts, resize) move trigger positions.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    let resizeTimer = null;
    addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 220);
    });
  };

  boot();
})();
