/* =============================================
   ASYNC WEATHER TRACKER — script.js
   Covers: async/await · .then()/.catch()
           try/catch/finally · Local Storage
           Event Loop Execution Tracing
   ============================================= */

// ── CONFIG ──────────────────────────────────────
const API_KEY  = "bd5e378503939ddaee76f12ad7a97608";
const BASE_URL = "https://api.openweathermap.org/data/2.5/weather";
const LS_KEY   = "wt_history_v1";
const MAX_HIST = 8;

// ── DOM ─────────────────────────────────────────
const cityInput      = document.getElementById("cityInput");
const searchBtn      = document.getElementById("searchBtn");
const btnSpinner     = document.getElementById("btnSpinner");
const inlineMsg      = document.getElementById("inlineMsg");
const historyWrap    = document.getElementById("historyWrap");
const noHistory      = document.getElementById("noHistory");
const clearHistBtn   = document.getElementById("clearHistBtn");
const emptyState     = document.getElementById("emptyState");
const weatherErr     = document.getElementById("weatherErr");
const weatherRows    = document.getElementById("weatherRows");
const consoleBody    = document.getElementById("consoleBody");
const clearConsoleBtn= document.getElementById("clearConsoleBtn");

// ── CONSOLE LOGGER ──────────────────────────────
// Mirrors browser console but displayed on screen for event loop demo
function cLog(type, msg) {
  const line = document.createElement("div");
  line.className = "c-line";

  const badge = document.createElement("span");
  badge.className = `c-badge ${type}`;
  badge.textContent = type.toUpperCase();

  const text = document.createElement("span");
  text.className = "c-text";
  text.innerHTML  = msg;

  line.appendChild(badge);
  line.appendChild(text);
  consoleBody.appendChild(line);

  // auto-scroll
  requestAnimationFrame(() => {
    consoleBody.scrollTop = consoleBody.scrollHeight;
  });
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
  inlineMsg.className = "inline-msg";
  inlineMsg.textContent = "";
}

// ── WEATHER PANEL STATES ─────────────────────────
function showEmpty() {
  emptyState.style.display = "flex";
  weatherErr.classList.remove("show");
  weatherErr.textContent = "";
  weatherRows.classList.remove("show");
}

function showError(msg) {
  emptyState.style.display = "none";
  weatherErr.textContent = msg;
  weatherErr.classList.add("show");
  weatherRows.classList.remove("show");
}

function showWeatherData() {
  emptyState.style.display = "none";
  weatherErr.classList.remove("show");
  weatherRows.classList.add("show");
}

// ── RENDER WEATHER ───────────────────────────────
function renderWeather(data) {
  const { name, sys, main, weather, wind, visibility } = data;

  document.getElementById("wCity").textContent     = `${name}, ${sys.country}`;
  document.getElementById("wTemp").textContent     = `${Math.round(main.temp)} °C`;
  document.getElementById("wWeather").textContent  = capitalise(weather[0].description);
  document.getElementById("wHumidity").textContent = `${main.humidity}%`;
  document.getElementById("wWind").textContent     = `${main.speed ?? wind.speed} m/s`;
  document.getElementById("wFeels").textContent    = `${Math.round(main.feels_like)} °C`;
  document.getElementById("wVis").textContent      = visibility
    ? `${(visibility / 1000).toFixed(1)} km`
    : "N/A";

  showWeatherData();
}

function capitalise(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// ── LOCAL STORAGE ────────────────────────────────
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || [];
  } catch {
    return [];
  }
}

function pushHistory(city) {
  let hist = getHistory();
  const name = capitalise(city.trim());
  hist = hist.filter(c => c.toLowerCase() !== name.toLowerCase());
  hist.unshift(name);
  if (hist.length > MAX_HIST) hist = hist.slice(0, MAX_HIST);
  localStorage.setItem(LS_KEY, JSON.stringify(hist));
  cLog("info", `LocalStorage — <span class="hl">"${name}"</span> saved to history.`);
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

  hist.forEach((city, i) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = city;
    chip.style.animationDelay = `${i * 0.05}s`;

    chip.addEventListener("click", () => {
      cLog("sync", `History chip clicked → <span class="hl">"${city}"</span>`);
      cityInput.value = city;
      doFetch(city);
    });

    historyWrap.appendChild(chip);
  });
}

// ── CORE: FETCH WEATHER ──────────────────────────
// Demonstrates: async/await, .then()/.catch(), try/catch/finally
async function doFetch(city) {
  if (!city || !city.trim()) {
    showMsg("err", "⚠ Please enter a city name.");
    cLog("error", "Validation failed — empty input.");
    return;
  }

  // [SYNC] — This runs before any async work, on the call stack
  cLog("sync", `[CALL STACK] <span class="hl">fetchWeather("${city}")</span> — function entered.`);
  cLog("sync", "[CALL STACK] Synchronous code executing… setting loading state.");

  setLoading(true);
  hideMsg();

  const url = `${BASE_URL}?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;

  // [ASYNC] — fetch() is handed off to Web API, call stack continues
  cLog("async", "[WEB API] <span class='hl-blue'>fetch()</span> dispatched → browser handles HTTP, call stack is FREE.");

  // ── Demonstrate Event Loop Ordering ──────────────
  // These run in order: sync → microtask → macrotask
  Promise.resolve().then(() => {
    cLog("micro", "[MICROTASK QUEUE] Promise.resolve().then() — microtask ran before macrotask.");
  });

  setTimeout(() => {
    cLog("macro", "[TASK QUEUE] setTimeout() — macrotask ran after all microtasks.");
  }, 0);
  // ─────────────────────────────────────────────────

  cLog("sync", "[CALL STACK] Synchronous code after fetch() dispatch — still on stack.");

  try {
    // await suspends HERE — resumes when fetch() promise resolves
    const response = await fetch(url)
      .then(res => {
        cLog("micro", `[MICROTASK] .then() on fetch → HTTP <span class="hl">${res.status}</span> received.`);
        return res;
      })
      .catch(netErr => {
        cLog("error", `[MICROTASK] .catch() on fetch → Network error: ${netErr.message}`);
        throw new Error("NETWORK");
      });

    cLog("async", "[CALL STACK] await resumed — response received from Web API.");

    // Parse JSON (also async)
    const data = await response.json();

    // API-level error check (404, 401 etc.)
    if (!response.ok) {
      const msg = data?.message || "Unknown API error.";
      cLog("error", `[API ERROR] Status <span class="hl">${response.status}</span> — ${msg}`);
      throw new Error(`API:${response.status}:${msg}`);
    }

    // ── Success ───────────────────────────────────
    cLog("success", `[SUCCESS] Data for <span class="hl">${data.name}, ${data.sys.country}</span> — rendering UI.`);
    cLog("sync", "[CALL STACK] Synchronous DOM update begins.");

    renderWeather(data);
    pushHistory(city);

    cLog("sync", "[CALL STACK] fetchWeather() complete — frame popped from stack.");

  } catch (err) {

    cLog("error", `[CATCH] Error caught → <span class="hl">${err.message}</span>`);

    if (err.message === "NETWORK" || err.message?.includes("fetch")) {
      showMsg("err", "🌐 Network error — check your internet connection.");
      showError("Network error.");
    } else if (err.message?.startsWith("API:404")) {
      showMsg("err", `🔍 "${city}" not found. Try another spelling.`);
      showError("City not found.");
    } else if (err.message?.startsWith("API:401")) {
      showMsg("err", "🔑 API key invalid.");
      showError("API key error.");
    } else {
      showMsg("err", `❌ Error: ${err.message}`);
      showError("Something went wrong.");
    }

  } finally {
    // ── Always runs — success OR error ────────────
    setLoading(false);
    cLog("info", "[FINALLY] Loading reset — runs regardless of success or error.");
  }
}

// ── EVENT LISTENERS ──────────────────────────────

searchBtn.addEventListener("click", () => {
  cLog("sync", "[EVENT] 'click' on Search button fired.");
  doFetch(cityInput.value.trim());
});

cityInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    cLog("sync", "[EVENT] 'keydown' Enter pressed.");
    doFetch(cityInput.value.trim());
  }
});

clearHistBtn.addEventListener("click", () => {
  cLog("sync", "[EVENT] 'click' on Clear History button.");
  clearHistory();
});

clearConsoleBtn.addEventListener("click", () => {
  consoleBody.innerHTML = "";
  cLog("sync", "Console cleared — ready.");
});

// ── INIT (synchronous) ───────────────────────────
console.log("[SYNC] script.js parsed — execution begins.");
cLog("sync",  "[INIT] Script loaded — DOM fully parsed.");
cLog("sync",  "[INIT] Event listeners registered.");
cLog("async", "[EVENT LOOP] Stack empty — idle, waiting for events...");

renderHistory();
cLog("info", `[INIT] LocalStorage read — <span class="hl">${getHistory().length}</span> history item(s) loaded.`);

showEmpty();

/*
  EVENT LOOP CHEAT SHEET (for assignment reference)
  ─────────────────────────────────────────────────
  Call Stack      → synchronous code, runs line by line
  Web APIs        → browser handles: fetch, setTimeout, DOM events
  Microtask Queue → Promise callbacks (.then / async-await continuations)
  Task Queue      → setTimeout, setInterval, DOM event callbacks

  Order of execution per "tick":
  1. Run all synchronous code on Call Stack until empty
  2. Drain entire Microtask Queue (Promises)
  3. Pick ONE task from Task Queue (setTimeout etc.)
  4. Repeat
*/
