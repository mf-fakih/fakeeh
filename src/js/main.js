/* ===========================================================================
   Portofolio Fakeeh — interaksi & animasi scroll
   ---------------------------------------------------------------------------
   Library (dimuat dari CDN di index.html):
     - GSAP 3.12.5 + ScrollTrigger  -> semua animasi yang mengikuti scroll
     - Lenis 1.1.18                 -> smooth scroll

   Aturan yang dipegang semua modul di bawah:
     1. Kalau elemennya tidak ada di halaman, modulnya diam saja.
     2. Kalau GSAP/Lenis gagal dimuat, halaman tetap bisa dibaca & di-scroll.
     3. prefers-reduced-motion: reduce -> semua gerakan dekoratif dimatikan.
=========================================================================== */
(() => {
  "use strict";

  const html = document.documentElement;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGsap = typeof window.gsap !== "undefined";
  const hasST = hasGsap && typeof window.ScrollTrigger !== "undefined";

  if (hasST) gsap.registerPlugin(ScrollTrigger);

  /* ------------------------------------------------------------------------
     SMOOTH SCROLL
     Lenis yang menggerakkan window, lalu ScrollTrigger diberi tahu tiap frame.
  ------------------------------------------------------------------------ */
  let lenis = null;

  if (!reduce && typeof window.Lenis !== "undefined") {
    lenis = new Lenis({
      lerp: 0.085,
      wheelMultiplier: 1,
      touchMultiplier: 1.7,
      smoothWheel: true,
    });

    if (hasGsap) {
      lenis.on("scroll", () => hasST && ScrollTrigger.update());
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const loop = (time) => {
        lenis.raf(time);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  }

  /* Posisi asli elemen di dokumen. #hero dan #contact itu position:sticky:
     begitu "nempel", rect-nya selalu 0 dari atas layar, jadi scroll ke sana
     tidak bergerak sama sekali. Untuk elemen sticky, posisinya diukur
     sesaat sebagai static (sinkron, tidak sempat ter-render). */
  const docTop = (el) => {
    const sticky = getComputedStyle(el).position === "sticky";
    if (sticky) el.style.position = "static";
    const y = el.getBoundingClientRect().top + scrollY;
    if (sticky) el.style.position = "";
    return Math.max(0, y);
  };

  /* semua anchor internal lewat sini, biar ikut smooth scroll-nya Lenis */
  const goTo = (el) => {
    if (!el) return;
    const y = docTop(el);
    if (lenis) lenis.scrollTo(y, { duration: 1.25 });
    else scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  };

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

  /* ------------------------------------------------------------------------
     PEMECAH TEKS
     Tiap kata/huruf dibungkus .sp-w (mask) > .sp-i (yang digerakkan).
     Hanya untuk elemen berisi teks biasa — isinya ditulis ulang total.
  ------------------------------------------------------------------------ */
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
      const { outer, inner } = wrapPart(ch === " " ? " " : ch);
      el.appendChild(outer);
      return inner;
    });
  };

  /* ------------------------------------------------------------------------
     HERO — judul dipecah per huruf, dipakai intro & efek scroll
  ------------------------------------------------------------------------ */
  const heroTitle = $("[data-hero-title]");
  const heroChars = heroTitle ? splitChars(heroTitle) : [];
  const heroWraps = heroChars.map((c) => c.parentElement);
  const heroReveals = $$("#hero [data-anim]");

  if (hasGsap && heroTitle) {
    /* Centering judul tetap dari class -translate-*-1/2. Di Tailwind v4 class
       itu memakai properti CSS `translate`, terpisah dari `transform` yang
       ditulis GSAP — jadi keduanya bertumpuk dengan benar. JANGAN tambahkan
       xPercent/yPercent -50 di sini: hasilnya geser dua kali. */
    gsap.set(heroChars, { yPercent: 105, rotate: 4, force3D: true });
    gsap.set(heroReveals, { opacity: 0, y: 22 });
    gsap.set($$('#hero [data-anim="pop"]'), { opacity: 0, y: 0, scale: 0.7 });
  }

  const heroIntro = () => {
    if (!hasGsap) return;
    const tl = gsap.timeline({
      onComplete: () => {
        /* mask sudah terbuka penuh -> lepas, supaya huruf bisa melebar ke
           samping saat di-scroll tanpa kepotong */
        gsap.set(heroWraps, { clipPath: "none" });
      },
    });

    /* power3.out + durasi panjang: gerakannya mengalir sampai akhir, tidak
       "lompat" di awal seperti expo. Rotate kecil biar terasa organik. */
    tl.to(heroChars, {
      yPercent: 0,
      rotate: 0,
      duration: reduce ? 0.01 : 1.6,
      ease: "power4.out",
      stagger: reduce ? 0 : 0.07,
    })
      /* mask dibuka pelan: sisi atas naik, sisi bawah turun, mulai selagi
         huruf masih meluncur masuk, jadi tidak ada patahan di akhir */
      .to(
        heroWraps,
        {
          clipPath: "inset(-45% -25% -45% -25%)",
          duration: reduce ? 0.01 : 1.4,
          ease: "power2.inOut",
          stagger: reduce ? 0 : 0.07,
        },
        reduce ? 0 : 0.9,
      )
      .to(
        $$('#hero [data-anim="up"]'),
        {
          opacity: 1,
          y: 0,
          duration: reduce ? 0.01 : 0.9,
          ease: "expo.out",
          stagger: 0.09,
        },
        0.3,
      )
      .to(
        $$('#hero [data-anim="pop"]'),
        {
          opacity: 1,
          scale: 1,
          duration: reduce ? 0.01 : 0.9,
          ease: reduce ? "none" : "back.out(1.7)",
        },
        0.5,
      );
  };

  /* ------------------------------------------------------------------------
     PRELOADER — angka 0→100, lalu panelnya diangkat ke atas
  ------------------------------------------------------------------------ */
  const loader = $("[data-loader]");

  const runLoader = () => {
    if (!loader) return heroIntro();

    if (!hasGsap) {
      loader.remove();
      return;
    }

    const fill = $("[data-loader-fill]", loader);
    const countEl = $("[data-loader-count]", loader);
    const mark = $("[data-loader-mark]", loader);
    const counter = { value: 0 };
    const span = reduce ? 0.2 : 1.2;

    if (lenis) lenis.stop();
    gsap.set(mark, { "--ink": "-15%" });

    gsap
      .timeline({
        onComplete: () => {
          loader.classList.add("is-done");
          loader.style.display = "none";
          if (lenis) lenis.start();
        },
      })
      .to(mark, { "--ink": "110%", duration: reduce ? 0.01 : 1.35, ease: "power2.inOut" }, 0)
      .to(fill, { scaleX: 1, duration: span, ease: "power2.inOut" }, 0.1)
      .to(
        counter,
        {
          value: 100,
          duration: span,
          ease: "power2.inOut",
          onUpdate: () => {
            countEl.textContent = String(Math.round(counter.value));
          },
        },
        0.1,
      )
      /* refresh (berat: ukur ulang semua trigger) dijalankan selagi preloader
         masih menutupi layar — kalau setelahnya, intro hero jadi tersendat */
      .call(() => hasST && ScrollTrigger.refresh())
      .to(mark, { opacity: 0, y: -24, duration: reduce ? 0.01 : 0.5, ease: "power2.in" }, "+=0.15")
      .to(
        loader,
        { yPercent: -100, duration: reduce ? 0.01 : 1, ease: "expo.inOut" },
        "-=0.28",
      )
      .call(heroIntro, null, "-=0.6");
  };

  /* mulai selalu dari atas, biar preloader + intro-nya utuh */
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  scrollTo(0, 0);
  runLoader();

  /* ======================================================================
     Semua di bawah ini butuh ScrollTrigger. Tanpa itu halaman tetap utuh,
     cuma tanpa animasi.
  ====================================================================== */
  if (!hasST) {
    $("[data-cert]")?.classList.add("cert-fallback");
  }

  /* ------------------------------------------------------------------------
     TOPBAR — pil nav baru muncul setelah halaman di-scroll melewati
     SHOW_AFTER px. Lenis menggerakkan window, jadi event scroll biasa cukup.
  ------------------------------------------------------------------------ */
  const topbar = $("[data-topbar]");
  if (topbar) {
    const SHOW_AFTER = 80;
    const sync = () => topbar.classList.toggle("is-visible", scrollY > SHOW_AFTER);
    addEventListener("scroll", sync, { passive: true });
    sync();
  }

  /* ------------------------------------------------------------------------
     HERO — efek saat ditinggalkan: judul mundur, huruf melebar, foto maju.

     Trigger-nya <main>, BUKAN #hero. #hero itu position:sticky, jadi begitu
     nempel di atas rect-nya berhenti bergerak dan ScrollTrigger salah ukur.
     <main> punya -mt-100px, artinya atasnya ada di scroll (innerHeight-100).
     Jadi:  start = atas <main> di (innerHeight-100)px dari atas layar -> scroll 0
            end   = atas <main> di atas layar                           -> hero tertutup
  ------------------------------------------------------------------------ */
  if (hasST && !reduce && heroTitle) {
    const spread = heroChars.length > 1 ? (heroChars.length - 1) / 2 : 0;

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
      .to(heroTitle, { y: -70, scale: 0.9, opacity: 0.45, ease: "none" }, 0)
      .to(
        heroChars,
        { xPercent: (i) => (i - spread) * 9, ease: "none" },
        0,
      )
      .to("[data-hero-portrait]", { yPercent: 8, scale: 1.07, ease: "none" }, 0)
      .to("[data-hero-card]", { scale: 0.95, ease: "none" }, 0);
  }

  /* foto hero miring sedikit mengikuti kursor */
  const tilt = $("[data-hero-tilt]");
  if (tilt && canHover && !reduce && hasGsap) {
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
  }

  /* ------------------------------------------------------------------------
     REVEAL UMUM — data-anim, data-split, data-slide
  ------------------------------------------------------------------------ */
  const presets = {
    up: { y: 34, opacity: 0 },
    fade: { opacity: 0 },
    pop: { scale: 0.74, opacity: 0 },
  };

  if (hasST) {
    $$("[data-anim]")
      .filter((el) => !el.closest("#hero"))
      .forEach((el) => {
        const from = presets[el.dataset.anim] || presets.up;
        gsap.set(el, from);
        gsap.to(el, {
          y: 0,
          scale: 1,
          opacity: 1,
          duration: reduce ? 0.01 : 1,
          ease: "expo.out",
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
        });
      });

    $$("[data-split]").forEach((el) => {
      if (el.hasAttribute("data-hero-title")) return; // sudah dipakai intro hero

      const mode = el.dataset.split;
      const parts = mode === "chars" ? splitChars(el) : splitWords(el);

      /* paragraf fade-words dipecah di sini, tapi animasinya di modul bawah */
      if (el.hasAttribute("data-fade-words")) return;

      gsap.set(parts, { yPercent: 115 });
      gsap.to(parts, {
        yPercent: 0,
        duration: reduce ? 0.01 : 1.1,
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
        duration: reduce ? 0.01 : 1.1,
        ease: "expo.out",
        scrollTrigger: { trigger: el, start: "top 92%", once: true },
      });
    });

    /* paragraf about: tiap kata menyala satu per satu mengikuti scroll */
    if (!reduce) {
      $$("[data-fade-words]").forEach((el) => {
        gsap.to($$(".sp-i", el), {
          opacity: 1,
          ease: "none",
          stagger: 0.5,
          scrollTrigger: {
            trigger: el,
            start: "top 80%",
            end: "bottom 55%",
            scrub: true,
          },
        });
      });
    }
  }

  /* ------------------------------------------------------------------------
     PARALLAX — data-parallax (elemen) & foto di dalam mask-nya
  ------------------------------------------------------------------------ */
  if (hasST && !reduce) {
    /* Gambar digeser di DALAM bingkainya. Besaran geseran (dalam %) boleh
       diatur per-elemen lewat nilai data-parallax-mask; defaultnya 8.
       Angkanya harus <= overscan .media-mask di CSS, kalau lebih nanti
       tepi bingkainya bolong. */
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
          scrollTrigger: {
            trigger: mask,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        },
      );
    });
  }

  /* ------------------------------------------------------------------------
     PENGHITUNG ANGKA
  ------------------------------------------------------------------------ */
  if (hasST) {
    $$("[data-count]").forEach((el) => {
      const target = Number(el.dataset.count) || 0;
      const suffix = el.dataset.countSuffix || "";
      const obj = { value: 0 };
      el.textContent = "0" + suffix;

      gsap.to(obj, {
        value: target,
        duration: reduce ? 0.01 : 1.6,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
        onUpdate: () => {
          el.textContent = Math.round(obj.value) + suffix;
        },
      });
    });
  }

  /* ------------------------------------------------------------------------
     MARQUEE — jalan terus; arah & kecepatannya ikut arah scroll
  ------------------------------------------------------------------------ */
  const marquees = [];

  if (hasGsap) {
    $$("[data-marquee]").forEach((wrap) => {
      const track = $("[data-marquee-track]", wrap);
      const seed = track && $(".marquee__item", track);
      if (!seed) return;

      /* isi track sampai panjangnya >= 1 layar + 1 blok, lalu seluruh
         isinya digandakan. Karena separuh depan = separuh belakang, animasi
         xPercent -50 yang diulang terus tidak kelihatan sambungannya. */
      let guard = 0;
      while (track.scrollWidth < wrap.offsetWidth + seed.offsetWidth && guard++ < 24) {
        track.appendChild(seed.cloneNode(true));
      }
      Array.from(track.children).forEach((node) => {
        track.appendChild(node.cloneNode(true));
      });

      const speed = parseFloat(wrap.dataset.speed) || 0.5;
      const distance = track.scrollWidth / 2;

      /* data-direction="-1" -> jalan ke kanan (dipakai pita kedua yang
         menyilang, supaya dua pitanya berlawanan arah) */
      const reverse = wrap.dataset.direction === "-1";
      const tl = gsap.fromTo(
        track,
        { xPercent: reverse ? -50 : 0 },
        {
          xPercent: reverse ? 0 : -50,
          ease: "none",
          repeat: -1,
          duration: Math.max(6, distance / (120 * speed)),
        },
      );

      marquees.push(tl);

      /* dijeda kalau sedang tidak kelihatan — hemat kerja di main thread */
      if (hasST) {
        ScrollTrigger.create({
          trigger: wrap,
          start: "top bottom",
          end: "bottom top",
          onToggle: (self) => (self.isActive ? tl.play() : tl.pause()),
        });
      }
    });
  }

  if (marquees.length && hasST && !reduce) {
    ScrollTrigger.create({
      onUpdate: (self) => {
        const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 2400, 2.6);
        const scale = (self.direction || 1) * boost;
        marquees.forEach((tl) =>
          gsap.to(tl, { timeScale: scale, duration: 0.5, overwrite: true }),
        );
      },
    });
  }

  /* ------------------------------------------------------------------------
     ACHIEVEMENTS — panggung di-pin, kartunya digeser ke samping.
     Inilah bagian "scroll ke bawah tapi jalannya ke kanan".
  ------------------------------------------------------------------------ */
  const cert = $("[data-cert]");

  if (cert && hasST) {
    const stage = $("[data-cert-stage]", cert);
    const viewport = $("[data-cert-viewport]", cert);
    const track = $("[data-cert-track]", cert);
    const rail = $("[data-cert-rail]", cert);
    const countEl = $("[data-cert-count]", cert);
    const cards = $$("[data-cert-card]", cert);

    if (reduce || !stage || !track || !viewport) {
      cert.classList.add("cert-fallback");
    } else {
      const pad = (n) => String(n).padStart(2, "0");
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
              const index = Math.min(
                cards.length,
                Math.max(1, Math.ceil(self.progress * cards.length)),
              );
              countEl.textContent = `${pad(index)} / ${pad(cards.length)}`;
            }
          },
        },
      });

      /* kartunya naik-turun berlawanan supaya barisannya terasa berlapis */
      cards.forEach((card, i) => {
        const dir = i % 2 ? 1 : -1;
        gsap.fromTo(
          card,
          { y: 14 * dir },
          {
            y: -14 * dir,
            ease: "none",
            scrollTrigger: {
              trigger: stage,
              start: "top top",
              end: () => "+=" + distance(),
              scrub: true,
            },
          },
        );
      });
    }
  }

  /* ------------------------------------------------------------------------
     LIGHTBOX SERTIFIKAT
     <dialog> yang menangani Esc, backdrop, dan pengembalian fokus sendiri.
     Kalau browser-nya tidak mendukung showModal(), gambarnya dibuka di tab baru.
  ------------------------------------------------------------------------ */
  (() => {
    const box = $("[data-lightbox]");
    const cards = $$("[data-cert-card]").filter((c) => c.dataset.full);
    if (!cards.length) return;

    const supported = box && typeof box.showModal === "function";
    const img = supported ? $("[data-lightbox-img]", box) : null;
    const title = supported ? $("[data-lightbox-title]", box) : null;
    const meta = supported ? $("[data-lightbox-meta]", box) : null;
    const count = supported ? $("[data-lightbox-count]", box) : null;
    const pad = (n) => String(n).padStart(2, "0");
    let current = 0;

    const show = (i) => {
      current = (i + cards.length) % cards.length;
      const card = cards[current];
      img.src = card.dataset.full;
      img.alt = card.dataset.alt || card.dataset.title || "Certificate";
      title.textContent = card.dataset.title || "";
      meta.textContent = card.dataset.meta || "";
      if (count) count.textContent = pad(current + 1) + " / " + pad(cards.length);
      /* putar ulang animasi masuk gambar saat pindah sertifikat */
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

    /* klik di area kosong (bukan gambar / tombol) juga menutup */
    box.addEventListener("click", (e) => {
      if (e.target === box || e.target.classList.contains("lightbox__stage")) box.close();
    });

    box.addEventListener("close", () => {
      if (lenis) lenis.start();
      img.removeAttribute("src");
    });
  })();

  /* ------------------------------------------------------------------------
     WORKS — preview project yang mengikuti kursor
  ------------------------------------------------------------------------ */
  const workList = $("[data-work-list]");
  const preview = $("[data-work-preview]");

  if (workList && preview && canHover && !reduce && hasGsap) {
    const slides = $$("[data-work-slide]", preview);
    const toX = gsap.quickTo(preview, "x", { duration: 0.55, ease: "power3" });
    const toY = gsap.quickTo(preview, "y", { duration: 0.55, ease: "power3" });
    let current = -1;
    let pointer = null; // posisi kursor terakhir (clientX/Y)

    gsap.set(preview, { scale: 0.82 });

    /* BUG LAMA: posisi preview cuma di-update saat pointermove. Kalau baris
       didatangi tanpa gerak mouse (mis. sambil scroll) atau saat pertama kali,
       preview muncul di posisi lamanya — awalnya (0,0), alias pojok kiri atas.
       Sekarang: saat muncul, preview LANGSUNG ditaruh di kursor (tanpa
       meluncur), dan ikut dicek ulang tiap scroll. */
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
      /* project tanpa gambar preview -> jangan munculkan kotak kosong */
      if (!slide) return hide();
      const wasHidden = current === -1;
      current = index;
      if (pointer) follow(pointer.x, pointer.y, snap || wasHidden);
      slides.forEach((s) => s.classList.toggle("is-on", s === slide));
      preview.classList.add("is-on");
      gsap.to(preview, {
        scale: 1,
        rotate: gsap.utils.random(-6, 6),
        duration: 0.7,
        ease: "expo.out",
      });
    };

    addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType !== "mouse") return;
        pointer = { x: e.clientX, y: e.clientY };
        if (current !== -1) follow(pointer.x, pointer.y, false);
      },
      { passive: true },
    );

    $$("[data-work]", workList).forEach((row) => {
      row.addEventListener("pointerenter", (e) => {
        if (e.pointerType !== "mouse") return;
        pointer = { x: e.clientX, y: e.clientY };
        show(row, false);
      });
    });

    workList.addEventListener("pointerleave", hide);

    /* saat di-scroll kursornya diam tapi barisnya bergerak: cek elemen di
       bawah kursor, lalu ganti / sembunyikan preview sesuai itu */
    addEventListener(
      "scroll",
      () => {
        if (!pointer) return;
        const el = document.elementFromPoint(pointer.x, pointer.y);
        const row = el && el.closest("[data-work]");
        if (row && workList.contains(row)) show(row, true);
        else hide();
      },
      { passive: true },
    );
  }

  /* ------------------------------------------------------------------------
     CONTACT & FOOTER — footer naik seperti tirai, contact-nya tenggelam
  ------------------------------------------------------------------------ */
  if (hasST && !reduce) {
    const footer = $(".site-footer");
    const contactKids = $$("#contact > *");

    if (footer && contactKids.length) {
      gsap.to(contactKids, {
        yPercent: -6,
        opacity: 0.5,
        ease: "none",
        /* footer-nya tidak setinggi layar, jadi selesainya di dasar halaman */
        scrollTrigger: {
          trigger: footer,
          start: "top bottom",
          end: "bottom bottom",
          scrub: true,
        },
      });
    }

  }

  /* ------------------------------------------------------------------------
     SIGNATURE — tanda tangan di section contact "menulis sendiri".
     Tiap <path> adalah jalur-tengah satu goresan (hasil tracing logo), di
     dalam mask logo asli. Goresannya digambar berurutan pakai
     stroke-dashoffset (pathLength=1, jadi 1 = tersembunyi, 0 = penuh) dengan
     durasi sebanding panjangnya, lalu logo penuh di-fade untuk menutup
     sambungan kecil yang tidak terjangkau goresan.
     Mulai saat section masuk layar; di-reset kalau di-scroll balik ke atas,
     jadi bisa ditonton ulang.
  ------------------------------------------------------------------------ */
  (() => {
    const svg = $("[data-sign-draw]");
    if (!svg || !hasGsap || reduce) return;

    const strokes = $$("path", svg);
    const fill = $("[data-sign-fill]", svg);
    const total = strokes.reduce((t, p) => t + (+p.dataset.len || 1), 0);
    const DRAW = 2.6; // detik untuk seluruh tanda tangan

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
  })();

  /* ------------------------------------------------------------------------
     TOMBOL MAGNET — ikut tertarik ke arah kursor
  ------------------------------------------------------------------------ */
  if (canHover && !reduce) {
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
  }

  /* ------------------------------------------------------------------------
     MENU OVERLAY
     Panelnya tersingkap lewat clip-path lingkaran yang membesar dari posisi
     tombol menu, jadi pusat lingkarannya dihitung ulang tiap kali dibuka
     (dan saat layar berubah ukuran).

     Aksesibilitas: panel diberi `inert` selagi tertutup supaya isinya tidak
     bisa di-tab; Esc menutup; fokus dibawa ke item pertama saat dibuka dan
     dikembalikan ke tombol saat ditutup.
  ------------------------------------------------------------------------ */
  (() => {
    const panel = $("[data-menu]");
    const toggle = $("[data-menu-toggle]");
    if (!panel || !toggle) return;

    const label = $("[data-menu-label]", toggle);
    const links = $$("[data-menu-link]", panel);
    let open = false;

    /* pusat lingkaran = titik tengah tombol, dalam persen layar */
    const placeOrigin = () => {
      const r = toggle.getBoundingClientRect();
      panel.style.setProperty("--menu-x", `${((r.left + r.width / 2) / innerWidth) * 100}%`);
      panel.style.setProperty("--menu-y", `${((r.top + r.height / 2) / innerHeight) * 100}%`);
    };

    const setOpen = (next) => {
      if (next === open) return;
      open = next;

      if (open) placeOrigin();
      panel.classList.toggle("is-open", open);
      html.classList.toggle("is-menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      if (label) label.textContent = open ? "Close menu" : "Open menu";

      if (open) {
        panel.removeAttribute("inert");
        if (lenis) lenis.stop();
        links[0]?.focus({ preventScroll: true });
      } else {
        /* fokus dikembalikan dulu, baru di-inert — kalau terbalik, fokusnya
           lompat ke <body> dan posisi scroll bisa ikut meloncat */
        if (panel.contains(document.activeElement)) toggle.focus({ preventScroll: true });
        panel.setAttribute("inert", "");
        if (lenis) lenis.start();
      }
    };

    toggle.addEventListener("click", () => setOpen(!open));

    /* selama menu terbuka, scroll apa pun (roda mouse, swipe) dibuang —
       baik di panel menu maupun halaman di belakangnya */
    const blockScroll = (e) => {
      if (open) e.preventDefault();
    };
    addEventListener("wheel", blockScroll, { passive: false });
    addEventListener("touchmove", blockScroll, { passive: false });

    addEventListener("keydown", (e) => {
      if (e.key === "Escape" && open) setOpen(false);
    });

    /* Link di dalam menu: TUTUP DULU, BARU SCROLL.
       Selama menu terbuka Lenis di-stop(), dan Lenis membuang perintah
       scrollTo() yang datang saat sedang stop — itu sebabnya dulu klik link
       cuma menutup menu tanpa pindah section. setOpen(false) menyalakan Lenis
       lagi, baru setelah itu goTo() dipanggil. */
    links.forEach((link) => {
      link.addEventListener("click", (e) => {
        const target = document.querySelector(link.getAttribute("href") || "");
        if (!target) return;
        e.preventDefault();
        setOpen(false);
        goTo(target);
        history.replaceState(null, "", link.getAttribute("href"));
      });
    });

    /* tandai link section yang sedang dilihat (aria-current) */
    if (hasST) {
      links.forEach((link) => {
        const section = document.querySelector(link.getAttribute("href") || "");
        if (!section) return;
        ScrollTrigger.create({
          trigger: section,
          start: "top 50%",
          end: "bottom 50%",
          onToggle: (self) => {
            if (!self.isActive) return;
            links.forEach((l) => l.setAttribute("aria-current", String(l === link)));
          },
        });
      });
    }

    addEventListener("resize", () => open && placeOrigin());
    placeOrigin();

  })();

  /* ------------------------------------------------------------------------
     JAM LOKAL
  ------------------------------------------------------------------------ */
  const clocks = $$("[data-clock]");

  if (clocks.length) {
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
  }

  /* ------------------------------------------------------------------------
     PENYESUAIAN ULANG — font selesai dimuat / layar berubah ukuran
  ------------------------------------------------------------------------ */
  if (hasST) {
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    let resizeTimer = null;
    addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 220);
    });
  }
})();
