// Global initialization event listener running on app startup
window.addEventListener("DOMContentLoaded", async (event) => {
  console.log("App loaded. Pre-fetching database universes...");
  try {
    await preFetchUserUniverseData();
  } catch (error) {
    console.error("Failed to load universe data:", error);
  } finally {
    const loader = document.getElementById("app-splash-preloader");
    if (loader) {
      loader.style.display = "none";
    }
  }

  initMatchSwipeHandlers();
  initCurrentRoundSwipeHandlers();
});

document.addEventListener('click', (e) => {
  if (window.suppressNextCardClick) {
    e.stopImmediatePropagation();
    e.preventDefault();
    window.suppressNextCardClick = false;
  }
}, true);
