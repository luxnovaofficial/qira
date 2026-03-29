(() => {
  const REVEAL_THRESHOLD = 0.18;
  const STRAND_THRESHOLD = 0.32;
  const SHIMMER_THRESHOLD = 0.5;
  const STAGGER_DELAY = 60;
  const REVEAL_DURATION = 680;
  const HEADING_REVEAL_DURATION = 900;
  const STRAND_SETTLE_DELAY = 2000;
  const SECTION_REVEAL_DURATIONS = {
    codes: 720,
    physician: 800,
    process: 660,
    difference: 740
  };

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let initialized = false;
  let observers = [];

  function easedStagger(index, total) {
    if (total <= 1) return 0;

    const t = index / (total - 1);
    const eased = Math.pow(t, 1.6);

    return Math.round(eased * (total - 1) * STAGGER_DELAY);
  }

  function initScrollAnimations() {
    if (initialized) return;
    initialized = true;

    const revealElements = Array.from(document.querySelectorAll("[data-reveal]"));
    const strandDividers = Array.from(document.querySelectorAll(".strand-divider"));
    const shimmerElements = Array.from(document.querySelectorAll(".compound-shimmer"));

    if (!revealElements.length && !strandDividers.length && !shimmerElements.length) return;

    if (typeof IntersectionObserver !== "function" || reducedMotionQuery.matches) {
      revealImmediately(revealElements);
      settleStrands(strandDividers);
      return;
    }

    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          revealElement(entry.target);
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: REVEAL_THRESHOLD,
        rootMargin: buildRootMargin()
      }
    );

    revealElements.forEach((element) => {
      revealObserver.observe(element);
    });

    const strandObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          activateStrand(entry.target);
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: STRAND_THRESHOLD,
        rootMargin: buildRootMargin()
      }
    );

    strandDividers.forEach((divider) => {
      strandObserver.observe(divider);
    });

    const shimmerObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          activateShimmer(entry.target);
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: SHIMMER_THRESHOLD,
        rootMargin: "0px 0px -10% 0px"
      }
    );

    shimmerElements.forEach((element) => {
      shimmerObserver.observe(element);
    });

    observers = [revealObserver, strandObserver, shimmerObserver];

    if (typeof reducedMotionQuery.addEventListener === "function") {
      reducedMotionQuery.addEventListener("change", (event) => {
        if (!event.matches) return;
        disconnectObservers();
        revealImmediately(revealElements);
        settleStrands(strandDividers);
      });
    } else if (typeof reducedMotionQuery.addListener === "function") {
      reducedMotionQuery.addListener((event) => {
        if (!event.matches) return;
        disconnectObservers();
        revealImmediately(revealElements);
        settleStrands(strandDividers);
      });
    }
  }

  function buildRootMargin() {
    const header = document.querySelector("#site-header");
    const headerOffset = header ? Math.round(header.getBoundingClientRect().height || 0) : 0;
    return `-${headerOffset}px 0px -12% 0px`;
  }

  function revealElement(element) {
    if (element.classList.contains("revealed")) return;

    if (element.hasAttribute("data-reveal-group")) {
      const items = Array.from(element.querySelectorAll("[data-reveal-item]"));
      let longestReveal = REVEAL_DURATION;
      let longestDelay = 0;

      items.forEach((item, index) => {
        const delay = easedStagger(index, items.length);

        item.style.setProperty("--reveal-delay", `${delay}ms`);
        item.style.willChange = getRevealWillChange(item);
        longestReveal = Math.max(longestReveal, getRevealDuration(item, true));
        longestDelay = Math.max(longestDelay, delay);
      });

      window.setTimeout(() => {
        items.forEach(clearWillChange);
      }, longestReveal + longestDelay + 120);
    } else {
      applySectionRevealDuration(element);
      element.style.willChange = getRevealWillChange(element);

      window.setTimeout(() => {
        clearWillChange(element);
      }, getRevealDuration(element) + 120);
    }

    element.classList.add("revealed");
  }

  function activateStrand(divider) {
    if (divider.classList.contains("strand-active") || divider.classList.contains("strand-settled")) return;

    const animatedNodes = Array.from(divider.querySelectorAll(".strand-node"));
    const signal = divider.querySelector(".strand-signal");

    animatedNodes.forEach((node) => {
      node.style.willChange = "transform, opacity";
    });

    if (signal) {
      signal.style.willChange = "transform, opacity";
    }

    divider.classList.add("strand-active");

    window.setTimeout(() => {
      divider.classList.remove("strand-active");
      divider.classList.add("strand-settled");
      animatedNodes.forEach(clearWillChange);
      clearWillChange(signal);
    }, STRAND_SETTLE_DELAY);
  }

  function activateShimmer(element) {
    if (element.classList.contains("shimmer-active")) return;

    element.classList.add("shimmer-active");
  }

  function revealImmediately(elements) {
    elements.forEach((element) => {
      element.classList.add("revealed");
      clearWillChange(element);

      element.querySelectorAll("[data-reveal-item]").forEach((item) => {
        clearWillChange(item);
      });
    });
  }

  function settleStrands(dividers) {
    dividers.forEach((divider) => {
      divider.classList.remove("strand-active");
      divider.classList.add("strand-settled");

      divider.querySelectorAll(".strand-node").forEach(clearWillChange);
      clearWillChange(divider.querySelector(".strand-signal"));
    });
  }

  function clearWillChange(element) {
    if (!element) return;
    element.style.removeProperty("will-change");
  }

  function applySectionRevealDuration(element) {
    const duration = getSectionRevealDuration(element);

    if (!duration) {
      element.style.removeProperty("--section-reveal-duration");
      return;
    }

    element.style.setProperty("--section-reveal-duration", `${duration}ms`);
  }

  function getSectionRevealDuration(element) {
    if (!element) return 0;

    const section = element.closest("section[id]");
    if (!section) return 0;

    return SECTION_REVEAL_DURATIONS[section.getAttribute("id")] || 0;
  }

  function getRevealDuration(element, grouped = false) {
    if (!element) return REVEAL_DURATION;

    if (element.dataset.reveal === "heading") return HEADING_REVEAL_DURATION;
    if (element.dataset.reveal === "text") return REVEAL_DURATION;
    if (grouped) return REVEAL_DURATION;

    return getSectionRevealDuration(element) || REVEAL_DURATION;
  }

  function getRevealWillChange(element) {
    if (!element) return "auto";
    if (element.dataset.reveal === "fade") return "opacity";
    if (element.dataset.reveal === "heading") return "opacity, transform, clip-path";
    return "opacity, transform";
  }

  function disconnectObservers() {
    observers.forEach((observer) => observer.disconnect());
    observers = [];
  }

  window.initScrollAnimations = initScrollAnimations;
})();
