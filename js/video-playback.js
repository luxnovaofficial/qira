(() => {
  const VIDEO_SELECTOR = ".code-card__video";
  const OBSERVER_ROOT_MARGIN = "160px 0px";
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let observer = null;
  let prefersReducedMotion = reducedMotionQuery.matches;

  function getVideos() {
    return Array.from(document.querySelectorAll(VIDEO_SELECTOR));
  }

  function toggleWrapperState(video, state, enabled) {
    video.parentElement?.classList.toggle(state, enabled);
  }

  function getVideoSource(video) {
    return video.dataset.videoSrc?.trim() || video.getAttribute("src") || "";
  }

  function loadVideo(video) {
    const source = getVideoSource(video);

    if (!source || video.dataset.videoLoaded === "true") {
      return;
    }

    video.dataset.videoLoaded = "true";
    toggleWrapperState(video, "video-loading", true);
    video.src = source;
    video.load();
  }

  function playVideo(video) {
    if (prefersReducedMotion) {
      return;
    }

    loadVideo(video);

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }

  function pauseVideo(video, { reset = false } = {}) {
    video.pause();
    video.dataset.playing = "false";
    toggleWrapperState(video, "video-active", false);

    if (reset) {
      try {
        video.currentTime = 0;
      } catch {
        // Ignore media reset failures for unloaded posters.
      }
    }
  }

  function handleVideoReady(video) {
    toggleWrapperState(video, "video-loading", false);
    toggleWrapperState(video, "video-ready", true);
    video.classList.add("video-ready");

    if (video.dataset.inView === "true" && !prefersReducedMotion) {
      playVideo(video);
    }
  }

  function syncVideoPlayback(video) {
    if (video.dataset.inView !== "true") {
      pauseVideo(video);
      return;
    }

    if (prefersReducedMotion) {
      pauseVideo(video, { reset: true });
      return;
    }

    playVideo(video);
  }

  function setupVideo(video) {
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.preload = "none";

    video.addEventListener("loadeddata", () => {
      handleVideoReady(video);
    });

    video.addEventListener("canplay", () => {
      handleVideoReady(video);
    });

    video.addEventListener("playing", () => {
      video.dataset.playing = "true";
      toggleWrapperState(video, "video-loading", false);
      toggleWrapperState(video, "video-active", true);
    });

    video.addEventListener("pause", () => {
      video.dataset.playing = "false";
      toggleWrapperState(video, "video-active", false);
    });

    video.addEventListener("waiting", () => {
      if (!prefersReducedMotion) {
        toggleWrapperState(video, "video-loading", true);
      }
    });

    video.addEventListener("mouseenter", () => {
      if (!prefersReducedMotion) {
        toggleWrapperState(video, "video-active", true);
        playVideo(video);
      }
    });

    video.addEventListener("mouseleave", () => {
      if (video.paused) {
        toggleWrapperState(video, "video-active", false);
      }
    });

    video.addEventListener("focus", () => {
      if (!prefersReducedMotion) {
        toggleWrapperState(video, "video-active", true);
      }
    });

    video.addEventListener("blur", () => {
      if (video.paused) {
        toggleWrapperState(video, "video-active", false);
      }
    });
  }

  function initObserver(videos) {
    if (typeof IntersectionObserver !== "function") {
      videos.forEach((video) => {
        video.dataset.inView = "true";
        syncVideoPlayback(video);
      });
      return;
    }

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          video.dataset.inView = entry.isIntersecting ? "true" : "false";
          syncVideoPlayback(video);
        });
      },
      {
        threshold: 0.25,
        rootMargin: OBSERVER_ROOT_MARGIN,
      }
    );

    videos.forEach((video) => {
      observer.observe(video);
    });
  }

  function applyMotionPreference(matches) {
    prefersReducedMotion = matches;

    getVideos().forEach((video) => {
      toggleWrapperState(video, "video-reduced", matches);

      if (matches) {
        pauseVideo(video, { reset: true });
      } else {
        syncVideoPlayback(video);
      }
    });
  }

  function init() {
    const videos = getVideos();

    if (!videos.length) {
      return;
    }

    videos.forEach(setupVideo);
    initObserver(videos);
    applyMotionPreference(prefersReducedMotion);
  }

  if (typeof reducedMotionQuery.addEventListener === "function") {
    reducedMotionQuery.addEventListener("change", (event) => {
      applyMotionPreference(event.matches);
    });
  } else if (typeof reducedMotionQuery.addListener === "function") {
    reducedMotionQuery.addListener((event) => {
      applyMotionPreference(event.matches);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.QIRAVideo = {
    pauseAll() {
      getVideos().forEach((video) => {
        pauseVideo(video);
      });
    },
    playVisible() {
      if (prefersReducedMotion) {
        return;
      }

      getVideos().forEach((video) => {
        if (video.dataset.inView === "true") {
          syncVideoPlayback(video);
        }
      });
    },
    getVideoCount() {
      return getVideos().length;
    },
  };
})();
