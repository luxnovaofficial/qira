(() => {
  const DRAW_THRESHOLD = 0.1;
  const PROGRESS_DELAY_WINDOW = 2000;
  const RETRACT_THRESHOLD = 0.05;

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let initialized = false;
  let observers = [];
  const activeProgressGroups = new Set();
  let progressRafId = 0;

  function initPathChoreography() {
    if (initialized) return;
    initialized = true;

    const pathGroups = Array.from(document.querySelectorAll("[data-path-group]"));

    if (!pathGroups.length) return;

    pathGroups.forEach((group) => {
      group.querySelectorAll("[data-draw-path]").forEach(preparePath);
    });

    if (reducedMotionQuery.matches || typeof IntersectionObserver !== "function") {
      revealAllPaths(pathGroups);
      return;
    }

    const observer = new IntersectionObserver(handleIntersections, {
      threshold: buildThresholds(),
      rootMargin: buildRootMargin(),
    });

    pathGroups.forEach((group) => {
      observer.observe(group);
    });

    observers = [observer];

    bindReducedMotion(pathGroups);
  }

  function handleIntersections(entries) {
    entries.forEach((entry) => {
      const group = entry.target;

      if (group.hasAttribute("data-path-progress")) {
        if (entry.isIntersecting) {
          startProgressTracking(group);
        } else {
          stopProgressTracking(group);
        }

        return;
      }

      if (entry.intersectionRatio >= DRAW_THRESHOLD) {
        setGroupState(group, true);
        return;
      }

      if (entry.intersectionRatio <= RETRACT_THRESHOLD) {
        setGroupState(group, false);
      }
    });
  }

  function setGroupState(group, isActive) {
    group.classList.toggle("path-active", isActive);
  }

  function preparePath(path) {
    let length = 0;

    try {
      length = typeof path.getTotalLength === "function" ? path.getTotalLength() : 0;
    } catch {
      length = 0;
    }

    if (!Number.isFinite(length) || length <= 0) {
      path.style.strokeDasharray = "none";
      path.style.strokeDashoffset = "0";
      return;
    }

    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    path.dataset.pathLength = `${length}`;
  }

  function startProgressTracking(group) {
    activeProgressGroups.add(group);
    updateGroupProgress(group);

    if (!progressRafId) {
      progressRafId = window.requestAnimationFrame(updateAllProgress);
    }
  }

  function stopProgressTracking(group) {
    activeProgressGroups.delete(group);
    group.classList.remove("path-active");

    group.querySelectorAll("[data-draw-path]").forEach((path) => {
      const length = Number.parseFloat(path.dataset.pathLength || "0");

      if (!length) return;

      path.style.transition = "none";
      path.style.strokeDashoffset = `${length}`;
      path.style.opacity = "0";

      window.requestAnimationFrame(() => {
        path.style.removeProperty("transition");
      });
    });

    if (!activeProgressGroups.size && progressRafId) {
      window.cancelAnimationFrame(progressRafId);
      progressRafId = 0;
    }
  }

  function updateAllProgress() {
    if (!activeProgressGroups.size) {
      progressRafId = 0;
      return;
    }

    activeProgressGroups.forEach((group) => {
      updateGroupProgress(group);
    });

    progressRafId = window.requestAnimationFrame(updateAllProgress);
  }

  function updateGroupProgress(group) {
    const rect = group.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const rawProgress = (viewportHeight - rect.top) / (viewportHeight + rect.height);
    const progress = clamp(rawProgress, 0, 1);

    group.querySelectorAll("[data-draw-path]").forEach((path) => {
      const length = Number.parseFloat(path.dataset.pathLength || "0");
      const delay = Number.parseInt(path.dataset.drawDelay || "0", 10);

      if (!length) return;

      path.style.strokeDashoffset = `${length * (1 - delayedProgress(progress, delay))}`;
      path.style.opacity = `${Math.min(1, delayedProgress(progress, delay) * 3)}`;
    });

    group.classList.toggle("path-active", progress > 0.05);
  }

  function revealAllPaths(groups) {
    groups.forEach((group) => {
      group.classList.add("path-active", "path-drawn");

      group.querySelectorAll("[data-draw-path]").forEach((path) => {
        path.style.strokeDashoffset = "0";
      });
    });
  }

  function bindReducedMotion(pathGroups) {
    const handleMotionChange = (event) => {
      if (!event.matches) return;

      disconnectObservers();
      cancelProgressTracking();
      revealAllPaths(pathGroups);
    };

    if (typeof reducedMotionQuery.addEventListener === "function") {
      reducedMotionQuery.addEventListener("change", handleMotionChange);
    } else if (typeof reducedMotionQuery.addListener === "function") {
      reducedMotionQuery.addListener(handleMotionChange);
    }
  }

  function disconnectObservers() {
    observers.forEach((observer) => observer.disconnect());
    observers = [];
  }

  function cancelProgressTracking() {
    if (progressRafId) {
      window.cancelAnimationFrame(progressRafId);
      progressRafId = 0;
    }

    activeProgressGroups.clear();
  }

  function buildRootMargin() {
    const header = document.querySelector("#site-header");
    const headerOffset = header ? Math.round(header.getBoundingClientRect().height || 0) : 0;

    return `-${headerOffset}px 0px -8% 0px`;
  }

  function buildThresholds() {
    return [0, RETRACT_THRESHOLD, DRAW_THRESHOLD, 1];
  }

  function delayedProgress(progress, delay) {
    const delayOffset = clamp(delay / PROGRESS_DELAY_WINDOW, 0, 0.9);

    if (delayOffset >= 1) return 0;

    return clamp((progress - delayOffset) / (1 - delayOffset), 0, 1);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  window.initPathChoreography = initPathChoreography;
})();
