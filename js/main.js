const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const scrollLinkedUi = {
  processCurrent: null,
  processScene: null,
  processSteps: [],
  progressBar: null,
};
let scrollLinkedUiFrame = 0;

function getHeaderOffset() {
  const header = document.querySelector("#site-header");
  if (!header) return 24;
  return Math.round(header.getBoundingClientRect().height) + 24;
}

function syncHeaderOffset() {
  document.documentElement.style.setProperty("--header-offset", `${getHeaderOffset()}px`);
}

function getScrollLinkedUiElements() {
  if (!scrollLinkedUi.progressBar || !scrollLinkedUi.progressBar.isConnected) {
    scrollLinkedUi.progressBar = document.querySelector(".scroll-progress-bar");
  }

  if (!scrollLinkedUi.processScene || !scrollLinkedUi.processScene.isConnected) {
    scrollLinkedUi.processScene = document.querySelector("[data-process-progress]");
    scrollLinkedUi.processCurrent = scrollLinkedUi.processScene?.querySelector("[data-process-current]") || null;
    scrollLinkedUi.processSteps = scrollLinkedUi.processScene
      ? Array.from(scrollLinkedUi.processScene.querySelectorAll("[data-process-step]"))
      : [];
  }

  return scrollLinkedUi;
}

function updateScrollProgress() {
  const { progressBar } = getScrollLinkedUiElements();
  if (!progressBar) return;

  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollHeight <= 0) {
    progressBar.style.width = "0%";
    return;
  }

  const progress = Math.min(window.scrollY / scrollHeight, 1);
  progressBar.style.width = `${(progress * 100).toFixed(2)}%`;
}

function updateProcessProgress() {
  const { processCurrent, processScene, processSteps } = getScrollLinkedUiElements();
  if (!processScene || !processSteps.length) return;

  const rect = processScene.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const rawProgress = (viewportHeight - rect.top) / (viewportHeight + rect.height);
  const progress = clamp(rawProgress, 0, 1);
  const currentStep = Math.min(processSteps.length, Math.floor(progress * processSteps.length) + 1);

  processScene.style.setProperty("--process-progress", progress.toFixed(4));

  if (processCurrent) {
    processCurrent.textContent = String(currentStep).padStart(2, "0");
  }

  processSteps.forEach((step, index) => {
    const stepStart = index / processSteps.length;
    const stepEnd = (index + 1) / processSteps.length;
    const stepProgress = clamp((progress - stepStart) / (stepEnd - stepStart), 0, 1);

    step.style.setProperty("--process-step-progress", stepProgress.toFixed(4));
    step.classList.toggle("process-step-current", index === currentStep - 1);
  });
}

function scheduleScrollLinkedUiSync() {
  if (scrollLinkedUiFrame) return;

  scrollLinkedUiFrame = window.requestAnimationFrame(() => {
    scrollLinkedUiFrame = 0;
    updateScrollProgress();
    updateProcessProgress();
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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

  if (typeof window.initPathChoreography === "function") {
    window.initPathChoreography();
  }

  scheduleScrollLinkedUiSync();
}

window.addEventListener("scroll", scheduleScrollLinkedUiSync, { passive: true });
window.addEventListener("resize", () => {
  syncHeaderOffset();
  scheduleScrollLinkedUiSync();
}, { passive: true });

initAnimations();
