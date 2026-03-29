const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function getHeaderOffset() {
  const header = document.querySelector("#site-header");
  if (!header) return 24;
  return Math.round(header.getBoundingClientRect().height) + 24;
}

function syncHeaderOffset() {
  document.documentElement.style.setProperty("--header-offset", `${getHeaderOffset()}px`);
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    window.scrollTo({
      top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - getHeaderOffset()),
      behavior: prefersReducedMotion.matches ? "auto" : "smooth",
    });
  });
});

function initHeroCopyReveal() {
  const revealItems = document.querySelectorAll("[data-hero-reveal]");

  if (!revealItems.length || prefersReducedMotion.matches) return;

  revealItems.forEach((item, index) => {
    if (item.dataset.heroRevealReady === "true") return;

    item.dataset.heroRevealReady = "true";
    item.style.setProperty("--hero-delay", `${index * 150}ms`);
    item.style.willChange = item.dataset.heroReveal === "fade" ? "opacity" : "opacity, transform";
    item.addEventListener(
      "animationend",
      () => {
        item.style.removeProperty("will-change");
      },
      { once: true }
    );
    item.classList.add(item.dataset.heroReveal === "fade" ? "hero-reveal-fade" : "hero-reveal-up");
  });
}

function initAnimations() {
  syncHeaderOffset();
  initHeroCopyReveal();

  if (typeof window.initScrollAnimations === "function") {
    window.initScrollAnimations();
  }

  if (typeof window.initHeroAnimation === "function") {
    window.initHeroAnimation();
  }
}

window.addEventListener("resize", syncHeaderOffset, { passive: true });

initAnimations();
