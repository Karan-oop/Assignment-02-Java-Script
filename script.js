/* Async Weather Tracker — "script.js" */

// ── CONFIG ──────────────────────────────────────
const API_KEY    = "bd5e378503939ddaee76f12ad7a97608";
const BASE_URL   = "https://api.openweathermap.org/data/2.5/weather";
const GEO_URL    = "https://api.openweathermap.org/geo/1.0/direct";
const LS_KEY     = "wt_history_v2";
const MAX_HIST   = 8;
const DEBOUNCE_MS = 380;

// ── DOM ─────────────────────────────────────────
const cityInput       = document.getElementById("cityInput");
const searchBtn       = document.getElementById("searchBtn");
const inputClearBtn   = document.getElementById("inputClearBtn");
const inlineMsg       = document.getElementById("inlineMsg");
const historyWrap     = document.getElementById("historyWrap");
const noHistory       = document.getElementById("noHistory");
const clearHistBtn    = document.getElementById("clearHistBtn");
const emptyState      = document.getElementById("emptyState");
const weatherErr      = document.getElementById("weatherErr");
const weatherRows     = document.getElementById("weatherRows");
const consoleBody     = document.getElementById("consoleBody");
const clearConsoleBtn = document.getElementById("clearConsoleBtn");
const autocompleteDrop= document.getElementById("autocompleteDrop");

// ── STATE ────────────────────────────────────────
let selectedGeo   = null;   // { lat, lon, displayName, area, type }
let acActiveIndex = -1;     // keyboard nav index in dropdown
let debounceTimer = null;

// ── CONSOLE LOGGER ──────────────────────────────
function cLog(type, msg) {
  const line  = document.createElement("div");
  line.className = "c-line";

  const badge = document.createElement("span");
  badge.className = `c-badge ${type}`;
  badge.textContent = type.toUpperCase();

  const text  = document.createElement("span");
  text.className  = "c-text";
  text.innerHTML  = msg;

  line.appendChild(badge);
  line.appendChild(text);
  consoleBody.appendChild(line);
  requestAnimationFrame(() => { consoleBody.scrollTop = consoleBody.scrollHeight; });
}

// ── LOADING ─────────────────────────────────────
function setLoading(on) {
  searchBtn.disabled = on;
  cityInput.disabled = on;
  searchBtn.classList.toggle("loading", on);
}

// ── MESSAGES ────────────────────────────────────
function showMsg(type, text) {
  inlineMsg.textContent = text;
  inlineMsg.className   = `inline-msg show ${type}`;
}

function hideMsg() {
  inlineMsg.className   = "inline-msg";
  inlineMsg.textContent = "";
}

// ── WEATHER PANEL STATES ─────────────────────────
function showEmpty() {
  emptyState.style.display = "flex";
  weatherErr.classList.remove("show");
  weatherErr.textContent   = "";
  weatherRows.classList.remove("show");
}

function showError(msg) {
  emptyState.style.display = "none";
  weatherErr.textContent   = msg;
  weatherErr.classList.add("show");
  weatherRows.classList.remove("show");
}

function showWeatherData() {
  emptyState.style.display = "none";
  weatherErr.classList.remove("show");
  weatherRows.classList.add("show");
}

// ── RENDER WEATHER ───────────────────────────────
function renderWeather(data, geoMeta) {
  const { name, sys, main, weather, wind, visibility } = data;

  // Location name — prefer geocode display name (more specific for localities)
  const locName = geoMeta?.displayName || name;
  document.getElementById("wCity").textContent     = `${locName}, ${sys.country}`;

  // Area / state info
  const area = geoMeta?.area || sys.country;
  document.getElementById("wArea").textContent     = area;

  // Location type badge (city / town / village / locality)
  const badge = document.getElementById("locBadge");
  if (geoMeta?.type) {
    badge.textContent = geoMeta.type;
    badge.classList.add("show");
  } else {
    badge.classList.remove("show");
  }

  document.getElementById("wTemp").textContent     = `${Math.round(main.temp)} °C`;
  document.getElementById("wWeather").textContent  = capitalise(weather[0].description);
  document.getElementById("wHumidity").textContent = `${main.humidity}%`;
  document.getElementById("wWind").textContent     = `${wind.speed} m/s`;
  document.getElementById("wFeels").textContent    = `${Math.round(main.feels_like)} °C`;
  document.getElementById("wVis").textContent      = visibility
    ? `${(visibility / 1000).toFixed(1)} km` : "N/A";

  showWeatherData();
}

function capitalise(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// ── AUTOCOMPLETE DROPDOWN ────────────────────────

function closeDropdown() {
  autocompleteDrop.classList.remove("open");
  autocompleteDrop.innerHTML = "";
  acActiveIndex = -1;
}

function renderDropdown(results, query) {
  autocompleteDrop.innerHTML = "";
  acActiveIndex = -1;

  if (!results || results.length === 0) {
    autocompleteDrop.innerHTML = `<div class="ac-empty">No places found for "<strong>${query}</strong>"</div>`;
    autocompleteDrop.classList.add("open");
    return;
  }

  results.forEach((place, i) => {
    const item = document.createElement("div");
    item.className = "ac-item";
    item.dataset.index = i;

    // Highlight matched part in name
    const qLower = query.toLowerCase();
    const nameLower = place.name.toLowerCase();
    let highlightedName = place.name;
    const matchIdx = nameLower.indexOf(qLower);
    if (matchIdx !== -1) {
      highlightedName =
        place.name.slice(0, matchIdx) +
        `<em>${place.name.slice(matchIdx, matchIdx + query.length)}</em>` +
        place.name.slice(matchIdx + query.length);
    }

    // Build area label
    const parts = [place.state, place.country].filter(Boolean);
    const subLabel = parts.join(", ");

    // Coords
    const lat = place.lat.toFixed(2);
    const lon = place.lon.toFixed(2);

    item.innerHTML = `
      <span class="ac-pin">${getTypeEmoji(place)}</span>
      <div class="ac-info">
        <div class="ac-name">${highlightedName}</div>
        <div class="ac-sub">${subLabel}</div>
      </div>
      <div class="ac-coords">${lat}, ${lon}</div>
    `;

    item.addEventListener("mousedown", (e) => {
      e.preventDefault(); // prevent input blur before click
      selectPlace(place);
    });

    autocompleteDrop.appendChild(item);
  });

  autocompleteDrop.classList.add("open");
}

function getTypeEmoji(place) {
  // OpenWeatherMap geocode doesn't always return type; infer from name/state
  if (!place.state && !place.local_names) return "🌍";
  return "📍";
}

function setActiveDropdownItem(index) {
  const items = autocompleteDrop.querySelectorAll(".ac-item");
  items.forEach(el => el.classList.remove("active"));
  if (index >= 0 && index < items.length) {
    items[index].classList.add("active");
    acActiveIndex = index;
  }
}

// ── GEOCODING API ────────────────────────────────
// Uses OWM Geocoding to search by locality/town/city name
async function geocodeQuery(query) {
  const url = `${GEO_URL}?q=${encodeURIComponent(query)}&limit=6&appid=${API_KEY}`;
  cLog("async", `[GEOCODE API] Searching locations for <span class="hl">"${query}"</span>...`);

  const results = await fetch(url)
    .then(res => res.json())
    .catch(err => {
      cLog("error", `[GEOCODE] Network error: ${err.message}`);
      return [];
    });

  return results;
}

// Called when user picks a suggestion or types and searches
function selectPlace(place) {
  const displayName = place.name;
  const area = [place.state, place.country].filter(Boolean).join(", ");

  selectedGeo = {
    lat: place.lat,
    lon: place.lon,
    displayName,
    area,
    type: inferLocationType(place),
  };

  cityInput.value = `${displayName}${place.state ? ", " + place.state : ""}, ${place.country}`;
  closeDropdown();
  toggleClearBtn();

  cLog("sync", `[GEO SELECTED] <span class="hl">${displayName}</span> — lat: ${place.lat.toFixed(4)}, lon: ${place.lon.toFixed(4)}`);
  doFetch();
}

function inferLocationType(place) {
  // Basic heuristic — OWM geocode doesn't return explicit type
  if (!place.state) return "Country";
  if (place.name === place.state) return "State";
  return "Locality";
}

// ── CORE: FETCH WEATHER BY COORDINATES ───────────
// Using lat/lon from geocode for precise locality-level results
async function doFetch(fallbackQuery) {
  const query = fallbackQuery || cityInput.value.trim();

  if (!query) {
    showMsg("err", "⚠ Please enter a city, town or locality.");
    cLog("error", "Validation failed — empty input.");
    return;
  }

  // [SYNC] — synchronous execution on call stack
  cLog("sync", `[CALL STACK] doFetch() entered — query: <span class="hl">"${query}"</span>`);
  cLog("sync", "[CALL STACK] Setting loading state synchronously.");

  setLoading(true);
  hideMsg();
  closeDropdown();

  // Event loop demonstration
  Promise.resolve().then(() => {
    cLog("micro", "[MICROTASK QUEUE] Promise.resolve().then() — microtask ran before macrotask.");
  });
  setTimeout(() => {
    cLog("macro", "[TASK QUEUE] setTimeout(0) — macrotask ran after all microtasks resolved.");
  }, 0);

  cLog("sync", "[CALL STACK] Synchronous code continues after fetch dispatch.");

  // ── Step 1: Resolve coordinates (geocode if not already selected) ──
  let geoMeta = selectedGeo;

  if (!geoMeta) {
    try {
      cLog("async", `[WEB API] Geocode fetch dispatched for <span class="hl">"${query}"</span>...`);
      const geoResults = await geocodeQuery(query);

      if (!geoResults || geoResults.length === 0) {
        throw new Error("GEO_NOT_FOUND");
      }

      const best = geoResults[0];
      geoMeta = {
        lat: best.lat,
        lon: best.lon,
        displayName: best.name,
        area: [best.state, best.country].filter(Boolean).join(", "),
        type: inferLocationType(best),
      };

      cLog("success", `[GEOCODE] Resolved → <span class="hl">${geoMeta.displayName}</span> (${geoMeta.lat.toFixed(4)}, ${geoMeta.lon.toFixed(4)})`);

    } catch (geoErr) {
      setLoading(false);
      if (geoErr.message === "GEO_NOT_FOUND") {
        showMsg("err", `🔍 "${query}" not found. Try a more specific name.`);
        showError("Location not found.");
      } else {
        showMsg("err", "🌐 Network error — check your connection.");
        showError("Network error.");
      }
      cLog("error", `[GEOCODE ERROR] ${geoErr.message}`);
      cLog("info", "[FINALLY] Loading reset after geocode failure.");
      return;
    }
  }

  // ── Step 2: Fetch weather by lat/lon ─────────────
  const weatherUrl = `${BASE_URL}?lat=${geoMeta.lat}&lon=${geoMeta.lon}&appid=${API_KEY}&units=metric`;
  cLog("async", `[WEB API] Weather fetch dispatched → lat: <span class="hl">${geoMeta.lat.toFixed(4)}</span>, lon: <span class="hl">${geoMeta.lon.toFixed(4)}</span>`);

  try {
    const response = await fetch(weatherUrl)
      .then(res => {
        cLog("micro", `[MICROTASK] .then() on weather fetch → HTTP <span class="hl">${res.status}</span>`);
        return res;
      })
      .catch(netErr => {
        cLog("error", `[MICROTASK] .catch() → Network error: ${netErr.message}`);
        throw new Error("NETWORK");
      });

    cLog("async", "[CALL STACK] await resumed — weather response received.");

    const data = await response.json();

    if (!response.ok) {
      const msg = data?.message || "API error.";
      cLog("error", `[API ERROR] Status <span class="hl">${response.status}</span> — ${msg}`);
      throw new Error(`API:${response.status}:${msg}`);
    }

    // ── Success ───────────────────────────────────
    cLog("success", `[SUCCESS] Weather data received for <span class="hl">${geoMeta.displayName}</span> — rendering UI.`);
    cLog("sync", "[CALL STACK] Synchronous DOM update begins.");

    renderWeather(data, geoMeta);

    // Save the display label to history
    const histLabel = `${geoMeta.displayName}, ${data.sys.country}`;
    pushHistory(histLabel, geoMeta);

    // Reset selected geo so next manual type doesn't reuse stale coords
    selectedGeo = null;

    cLog("sync", "[CALL STACK] doFetch() complete — frame popped from stack.");

  } catch (err) {
    cLog("error", `[CATCH] ${err.message}`);

    if (err.message === "NETWORK" || err.message?.includes("fetch")) {
      showMsg("err", "🌐 Network error — check your internet connection.");
      showError("Network error.");
    } else if (err.message?.startsWith("API:404")) {
      showMsg("err", `🔍 Weather data not available for this location.`);
      showError("No weather data.");
    } else if (err.message?.startsWith("API:401")) {
      showMsg("err", "🔑 API key invalid.");
      showError("API key error.");
    } else {
      showMsg("err", `❌ ${err.message}`);
      showError("Something went wrong.");
    }

  } finally {
    setLoading(false);
    selectedGeo = null;
    cLog("info", "[FINALLY] Loading reset — always runs regardless of outcome.");
  }
}

// ── LIVE AUTOCOMPLETE HANDLER ─────────────────────
async function handleAutoComplete(query) {
  if (query.length < 2) {
    closeDropdown();
    return;
  }

  // Show loading in dropdown
  autocompleteDrop.innerHTML = `<div class="ac-loading">🔍 Searching...</div>`;
  autocompleteDrop.classList.add("open");

  try {
    const results = await geocodeQuery(query);
    renderDropdown(results, query);
  } catch {
    closeDropdown();
  }
}

// ── LOCAL STORAGE ────────────────────────────────
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || [];
  } catch { return []; }
}

function pushHistory(label, geoMeta) {
  let hist = getHistory();
  hist = hist.filter(h => h.label.toLowerCase() !== label.toLowerCase());
  hist.unshift({ label, geoMeta });
  if (hist.length > MAX_HIST) hist = hist.slice(0, MAX_HIST);
  localStorage.setItem(LS_KEY, JSON.stringify(hist));
  cLog("info", `LocalStorage — <span class="hl">"${label}"</span> saved.`);
  renderHistory();
}

function clearHistory() {
  localStorage.removeItem(LS_KEY);
  cLog("info", "LocalStorage — history cleared.");
  renderHistory();
}

function renderHistory() {
  const hist = getHistory();
  historyWrap.innerHTML = "";

  if (hist.length === 0) {
    historyWrap.appendChild(noHistory);
    return;
  }

  hist.forEach((entry, i) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = entry.label;
    chip.style.animationDelay = `${i * 0.05}s`;

    chip.addEventListener("click", () => {
      cLog("sync", `[EVENT] History chip clicked → <span class="hl">"${entry.label}"</span>`);
      cityInput.value = entry.label;
      toggleClearBtn();

      if (entry.geoMeta) {
        // Use saved coords directly — no extra geocode API call needed
        selectedGeo = entry.geoMeta;
        cLog("info", `[LOCAL STORAGE] Using saved coords for <span class="hl">${entry.label}</span>`);
      }
      doFetch(entry.label);
    });

    historyWrap.appendChild(chip);
  });
}

// ── INPUT CLEAR BUTTON ───────────────────────────
function toggleClearBtn() {
  inputClearBtn.classList.toggle("visible", cityInput.value.length > 0);
}

// ── EVENT LISTENERS ──────────────────────────────

// Search button
searchBtn.addEventListener("click", () => {
  cLog("sync", "[EVENT] 'click' on Search button.");
  selectedGeo = null; // force fresh geocode on manual click
  doFetch(cityInput.value.trim());
});

// Input typing — debounced autocomplete
cityInput.addEventListener("input", () => {
  toggleClearBtn();
  selectedGeo = null;
  const q = cityInput.value.trim();

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    handleAutoComplete(q);
  }, DEBOUNCE_MS);
});

// Keyboard navigation in dropdown
cityInput.addEventListener("keydown", (e) => {
  const items = autocompleteDrop.querySelectorAll(".ac-item");

  if (e.key === "ArrowDown") {
    e.preventDefault();
    const next = Math.min(acActiveIndex + 1, items.length - 1);
    setActiveDropdownItem(next);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    const prev = Math.max(acActiveIndex - 1, 0);
    setActiveDropdownItem(prev);
  } else if (e.key === "Enter") {
    cLog("sync", "[EVENT] Enter key pressed.");
    if (acActiveIndex >= 0 && items[acActiveIndex]) {
      items[acActiveIndex].dispatchEvent(new MouseEvent("mousedown"));
    } else {
      selectedGeo = null;
      doFetch(cityInput.value.trim());
    }
  } else if (e.key === "Escape") {
    closeDropdown();
  }
});

// Close dropdown on outside click
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrap-outer")) closeDropdown();
});

// Clear input button
inputClearBtn.addEventListener("click", () => {
  cityInput.value = "";
  selectedGeo = null;
  toggleClearBtn();
  closeDropdown();
  cityInput.focus();
});

// Clear history
clearHistBtn.addEventListener("click", () => {
  cLog("sync", "[EVENT] Clear History clicked.");
  clearHistory();
});

// Clear console
clearConsoleBtn.addEventListener("click", () => {
  consoleBody.innerHTML = "";
  cLog("sync", "Console cleared.");
});

// Quick tip chips
document.querySelectorAll(".tip-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const q = chip.dataset.q;
    cityInput.value = q;
    selectedGeo = null;
    toggleClearBtn();
    closeDropdown();
    cLog("sync", `[TIP CHIP] Clicked → <span class="hl">"${q}"</span>`);
    doFetch(q);
  });
});

// ── INIT ─────────────────────────────────────────
console.log("[SYNC] script.js parsed — execution begins.");
cLog("sync",  "[INIT] Script loaded — DOM fully parsed.");
cLog("sync",  "[INIT] Event listeners registered (search, input, keyboard, tips).");
cLog("info",  "[INIT] Geocoding API enabled — supports cities, towns, and localities.");
cLog("async", "[EVENT LOOP] Call stack empty — idle, awaiting user input...");

renderHistory();
cLog("info", `[INIT] LocalStorage read — <span class="hl">${getHistory().length}</span> history item(s) loaded.`);
showEmpty();
