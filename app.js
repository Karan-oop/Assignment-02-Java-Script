// ============================================================
//  ASYNC WEATHER TRACKER — app.js
//  Demonstrates: async/await, .then()/.catch(), try...catch,
//  Event Loop logging, Local Storage, DOM manipulation
// ============================================================

// ── API CONFIG ──────────────────────────────────────────────
// Using Open-Meteo (free, no API key required) + wttr.in as fallback
// We use geocoding via Open-Meteo to convert city → coordinates
const GEO_API   = (city) => `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
const WEATHER_API = (lat, lon) => `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure,visibility&wind_speed_unit=kmh`;

// ── DOM REFS ─────────────────────────────────────────────────
const cityInput       = document.getElementById('cityInput');
const searchBtn       = document.getElementById('searchBtn');
const btnText         = document.getElementById('btnText');
const btnSpinner      = document.getElementById('btnSpinner');
const messageEl       = document.getElementById('message');
const weatherCard     = document.getElementById('weatherCard');
const historyList     = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const consoleBody     = document.getElementById('consoleBody');
const clearConsoleBtn = document.getElementById('clearConsoleBtn');

// ── LOCAL STORAGE KEY ────────────────────────────────────────
const LS_KEY = 'weatherTracker_history';

// ── STARTUP ──────────────────────────────────────────────────
// [SYNC] This runs immediately (synchronous — call stack)
consoleLog('sync', '[SYNC]', 'Script loaded → synchronous code begins executing');
consoleLog('info', '[INIT]', 'DOM elements referenced. Attaching event listeners...');
loadHistory();
consoleLog('sync', '[SYNC]', 'loadHistory() called → search history rendered from LocalStorage');
consoleLog('info', '[INIT]', 'App ready. Event listeners attached — waiting for user input.');

// ── EVENT LISTENERS ──────────────────────────────────────────
searchBtn.addEventListener('click', handleSearch);

cityInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSearch();
});

clearHistoryBtn.addEventListener('click', () => {
  localStorage.removeItem(LS_KEY);
  renderHistory([]);
  consoleLog('warn', '[STORAGE]', 'LocalStorage cleared. Search history deleted.');
});

clearConsoleBtn.addEventListener('click', () => {
  consoleBody.innerHTML = '';
  consoleLog('info', '[CONSOLE]', 'Console cleared by user.');
});

// ── MAIN HANDLER ─────────────────────────────────────────────
async function handleSearch() {
  const city = cityInput.value.trim();

  // [SYNC] Validate input immediately
  consoleLog('sync', '[SYNC]', `handleSearch() called. City input: "${city}"`);

  if (!city) {
    showMessage('⚠️ Please enter a city name.', 'error');
    consoleLog('warn', '[VALIDATE]', 'Empty input — search aborted.');
    return;
  }

  // Reset UI
  showMessage('', '');
  setLoading(true);

  // [SYNC] Log before async operations
  consoleLog('sync', '[SYNC]', '-- Synchronous execution continues --');
  consoleLog('info', '[CALL STACK]', 'fetchWeather() pushed onto call stack');
  consoleLog('info', '[ASYNC]', 'fetch() called → Promise created → control handed to Web API');
  consoleLog('sync', '[SYNC]', 'Call stack free → event loop can process other tasks now');

  await fetchWeather(city);

  // [ASYNC RESUMED] After await resolves
  consoleLog('sync', '[SYNC]', 'handleSearch() resumed after await fetchWeather() resolved');
  setLoading(false);
}

// ── FETCH WEATHER (async/await + try...catch) ────────────────
async function fetchWeather(city) {
  try {
    consoleLog('info', '[FETCH]', `Step 1: Geocoding city → "${city}"`);

    // STEP 1: Geocode city → lat/lon (async/await style)
    const geoResponse = await fetch(GEO_API(city));
    consoleLog('success', '[PROMISE]', 'Geocoding fetch() Promise resolved ✓');

    // Demonstrate .then()/.catch() chaining on the JSON parse
    const geoData = await geoResponse.json()
      .then(data => {
        consoleLog('success', '[.then()]', 'geoResponse.json() Promise resolved via .then()');
        return data;
      })
      .catch(err => {
        consoleLog('error', '[.catch()]', `JSON parse failed: ${err.message}`);
        throw new Error('Failed to parse geocoding response.');
      });

    if (!geoData.results || geoData.results.length === 0) {
      throw new Error(`City "${city}" not found. Please check the spelling.`);
    }

    const { name, country, latitude, longitude } = geoData.results[0];
    consoleLog('info', '[GEO]', `Resolved: ${name}, ${country} → (${latitude}, ${longitude})`);

    // STEP 2: Fetch weather (async/await style)
    consoleLog('info', '[FETCH]', `Step 2: Fetching weather for (${latitude}, ${longitude})`);
    const weatherResponse = await fetch(WEATHER_API(latitude, longitude));

    if (!weatherResponse.ok) {
      throw new Error(`Weather API error: HTTP ${weatherResponse.status}`);
    }
    consoleLog('success', '[PROMISE]', 'Weather fetch() Promise resolved ✓');

    const weatherData = await weatherResponse.json();
    consoleLog('success', '[ASYNC]', 'All Promises resolved. Data ready for rendering.');

    // Render results
    renderWeather({ name, country }, weatherData.current);
    saveToHistory(name);
    consoleLog('success', '[RENDER]', `Weather for "${name}" displayed successfully.`);

  } catch (error) {
    // try...catch handles both network errors and thrown errors
    consoleLog('error', '[try...catch]', `Error caught: ${error.message}`);

    const isNetwork = error.message.toLowerCase().includes('failed to fetch') ||
                      error.message.toLowerCase().includes('networkerror');

    if (isNetwork) {
      showMessage('🌐 Network error. Please check your internet connection.', 'error');
      consoleLog('error', '[NETWORK]', 'Network request failed — likely offline.');
    } else {
      showMessage(`❌ ${error.message}`, 'error');
    }
  }
}

// ── RENDER WEATHER ───────────────────────────────────────────
function renderWeather(location, current) {
  const {
    temperature_2m: temp,
    apparent_temperature: feelsLike,
    relative_humidity_2m: humidity,
    wind_speed_10m: wind,
    surface_pressure: pressure,
    visibility,
    weather_code: code,
  } = current;

  const { emoji, label } = getWeatherInfo(code);

  document.getElementById('countryBadge').textContent    = location.country;
  document.getElementById('cityName').textContent         = location.name;
  document.getElementById('tempBig').textContent          = `${Math.round(temp)}°C`;
  document.getElementById('feelsLike').textContent        = `Feels like ${Math.round(feelsLike)}°C`;
  document.getElementById('weatherEmoji').textContent     = emoji;
  document.getElementById('weatherCondition').textContent = label;
  document.getElementById('humidity').textContent         = `${humidity}%`;
  document.getElementById('windSpeed').textContent        = `${Math.round(wind)}`;
  document.getElementById('visibility').textContent       = `${(visibility / 1000).toFixed(1)}`;
  document.getElementById('pressure').textContent         = `${Math.round(pressure)}`;
  document.getElementById('lastUpdated').textContent      = `Last updated: ${new Date().toLocaleTimeString()}`;

  weatherCard.classList.add('show');
}

// ── WEATHER CODE → EMOJI + LABEL ────────────────────────────
// WMO Weather interpretation codes
function getWeatherInfo(code) {
  if (code === 0)              return { emoji: '☀️',  label: 'Clear Sky' };
  if (code === 1)              return { emoji: '🌤️', label: 'Mainly Clear' };
  if (code === 2)              return { emoji: '⛅',  label: 'Partly Cloudy' };
  if (code === 3)              return { emoji: '☁️',  label: 'Overcast' };
  if ([45,48].includes(code)) return { emoji: '🌫️', label: 'Foggy' };
  if ([51,53,55].includes(code)) return { emoji: '🌦️', label: 'Drizzle' };
  if ([61,63,65].includes(code)) return { emoji: '🌧️', label: 'Rain' };
  if ([71,73,75,77].includes(code)) return { emoji: '❄️', label: 'Snow' };
  if ([80,81,82].includes(code)) return { emoji: '🌦️', label: 'Rain Showers' };
  if ([85,86].includes(code)) return { emoji: '🌨️', label: 'Snow Showers' };
  if ([95,96,99].includes(code)) return { emoji: '⛈️', label: 'Thunderstorm' };
  return { emoji: '🌡️', label: 'Unknown' };
}

// ── LOCAL STORAGE ────────────────────────────────────────────
function saveToHistory(city) {
  const history = getHistory();
  const filtered = history.filter(c => c.toLowerCase() !== city.toLowerCase());
  const updated  = [city, ...filtered].slice(0, 8); // max 8 entries
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
  renderHistory(updated);
  consoleLog('info', '[STORAGE]', `"${city}" saved to LocalStorage. History: [${updated.join(', ')}]`);
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || [];
  } catch {
    return [];
  }
}

function loadHistory() {
  const history = getHistory();
  renderHistory(history);
}

function renderHistory(history) {
  if (!history.length) {
    historyList.innerHTML = '<span class="no-history">No searches yet.</span>';
    return;
  }

  historyList.innerHTML = history
    .map(city => `
      <button class="history-chip" onclick="searchFromHistory('${city}')">
        <span class="chip-dot"></span>
        ${city}
      </button>
    `)
    .join('');
}

function searchFromHistory(city) {
  cityInput.value = city;
  consoleLog('info', '[HISTORY]', `Re-fetching weather from history chip: "${city}"`);
  handleSearch();
}

// ── UI HELPERS ───────────────────────────────────────────────
function setLoading(loading) {
  searchBtn.disabled = loading;
  btnText.style.display    = loading ? 'none'         : 'inline';
  btnSpinner.style.display = loading ? 'inline-block' : 'none';
}

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className   = 'message';
  if (type) messageEl.classList.add(type);
}

// ── CUSTOM CONSOLE LOG ───────────────────────────────────────
function consoleLog(type, tag, msg) {
  const now       = new Date();
  const timeStr   = `${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}:${String(now.getMilliseconds()).padStart(3,'0')}`;
  const line      = document.createElement('div');
  line.className  = `log-line log-${type}`;
  line.innerHTML  = `
    <span class="log-time">${timeStr}</span>
    <span class="log-type">${tag}</span>
    <span class="log-msg">${msg}</span>
  `;
  consoleBody.appendChild(line);
  consoleBody.scrollTop = consoleBody.scrollHeight;

  // Also log to real browser console for DevTools inspection
  const nativeMap = { info: 'log', success: 'log', error: 'error', warn: 'warn', sync: 'log' };
  console[nativeMap[type] || 'log'](`${tag} ${msg}`);
}
