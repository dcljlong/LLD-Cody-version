import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "https://lld-cody-version.onrender.com";
const WEATHER_LOCATION_STORAGE_KEY = "lld_weather_site_location_v1";

function pickWeatherValue(source, keys) {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
  }
  return null;
}

function formatWeatherValue(value, suffix, emptyLabel = "Not supplied") {
  if (value === undefined || value === null || value === "") {
    return emptyLabel;
  }

  if (typeof value === "number") {
    return `${Math.round(value * 10) / 10}${suffix || ""}`;
  }

  return `${value}${suffix || ""}`;
}

function formatDateLabel(value) {
  if (!value) return "Forecast";

  try {
    return new Date(value).toLocaleDateString("en-NZ", {
      weekday: "short",
      day: "numeric",
      month: "short"
    });
  } catch {
    return String(value);
  }
}

function loadSavedLocation() {
  try {
    const raw = window.localStorage.getItem(WEATHER_LOCATION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat === "number" && typeof parsed?.lon === "number") {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function saveLocation(location) {
  try {
    window.localStorage.setItem(WEATHER_LOCATION_STORAGE_KEY, JSON.stringify(location));
  } catch {
    // Ignore storage failure; weather can still load for this session.
  }
}
async function reverseGeocodeSiteLocation(lat, lon) {
  try {
    const response = await axios.get("https://api.bigdatacloud.net/data/reverse-geocode-client", {
      params: {
        latitude: lat,
        longitude: lon,
        localityLanguage: "en"
      }
    });

    const data = response.data || {};
    const locality = data.locality || data.city || data.localityName || "";
    const subdivision = data.principalSubdivision || "";
    const country = data.countryName || "";

    const parts = [];
    [locality, subdivision].forEach((part) => {
      if (part && !parts.includes(part)) {
        parts.push(part);
      }
    });

    if (parts.length > 0) {
      return parts.join(", ");
    }

    return country || "";
  } catch {
    return "";
  }
}

function formatCoordinate(value) {
  if (typeof value !== "number") return "";
  return Math.round(value * 10000) / 10000;
}

function getRainOutlook(forecast, rain) {
  if (rain !== null && rain !== undefined && rain !== "") {
    return formatWeatherValue(rain, " mm");
  }

  const rainyDay = forecast.find((day) => {
    const description = String(day.description || "").toLowerCase();
    return description.includes("rain") || description.includes("shower");
  });

  if (!rainyDay) {
    return "No rain shown";
  }

  return `${formatDateLabel(rainyDay.date)} - ${rainyDay.description}`;
}

export default function WeatherPage() {
  const [weather, setWeather] = useState(null);
  const [weatherStatus, setWeatherStatus] = useState("idle");
  const [weatherError, setWeatherError] = useState("");
  const [siteLocation, setSiteLocation] = useState(() => loadSavedLocation());
  const [locationStatus, setLocationStatus] = useState("");

  async function loadWeatherForLocation(location) {
    if (!location?.lat || !location?.lon) {
      setWeather(null);
      setWeatherStatus("idle");
      return;
    }

    setWeatherStatus("loading");
    setWeatherError("");

    try {
      const response = await axios.get(API_BASE_URL + "/api/weather", {
        params: {
          lat: location.lat,
          lon: location.lon
        }
      });

      setWeather(response.data || {});
      setWeatherStatus("ready");
    } catch (error) {
      setWeather(null);
      setWeatherStatus("error");
      setWeatherError(error?.response?.data?.detail || error?.message || "Weather could not be loaded.");
    }
  }

  useEffect(() => {
    if (siteLocation) {
      loadWeatherForLocation(siteLocation);
    }
  }, []);

  function useDeviceLocation() {
    setLocationStatus("");

    if (!navigator.geolocation) {
      setLocationStatus("Location is not available on this device/browser.");
      return;
    }

    setWeatherStatus("loading");
    setWeatherError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const baseLocation = {
          lat: position.coords.latitude,
          lon: position.coords.longitude
        };

        const areaLabel = await reverseGeocodeSiteLocation(baseLocation.lat, baseLocation.lon);

        const nextLocation = {
          ...baseLocation,
          label: areaLabel || "Site weather location"
        };

        setSiteLocation(nextLocation);
        saveLocation(nextLocation);
        setLocationStatus(areaLabel ? `Using ${areaLabel} as the site weather area.` : "Using this device's site coordinates.");
        loadWeatherForLocation(nextLocation);
      },
      (error) => {
        setWeatherStatus(siteLocation ? "ready" : "idle");
        setLocationStatus(error?.message || "Could not access location. Allow location permission and try again.");
      },
      {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 1000 * 60 * 30
      }
    );
  }

  function clearLocation() {
    try {
      window.localStorage.removeItem(WEATHER_LOCATION_STORAGE_KEY);
    } catch {
      // Ignore storage failure.
    }

    setSiteLocation(null);
    setWeather(null);
    setWeatherStatus("idle");
    setLocationStatus("Weather location cleared.");
  }

  const currentWeather = weather?.current || weather?.today || {};
  const forecast = Array.isArray(weather?.forecast) ? weather.forecast : [];
  const condition = pickWeatherValue(currentWeather, ["condition", "description", "summary", "weather"]) || "Condition not supplied";
  const temperature = pickWeatherValue(currentWeather, ["temperature", "temp", "temp_c", "temperature_c"]);
  const feelsLike = pickWeatherValue(currentWeather, ["feels_like", "feelsLike", "feels_like_c"]);
  const humidity = pickWeatherValue(currentWeather, ["humidity", "humidity_percent"]);
  const rain = pickWeatherValue(currentWeather, ["rain", "rain_mm", "precipitation", "precipitation_mm"]);
  const wind = pickWeatherValue(currentWeather, ["wind", "wind_speed", "wind_kph", "wind_speed_kph"]);
  const updatedAt = pickWeatherValue(currentWeather, ["updated_at", "updatedAt", "time", "timestamp"]) || pickWeatherValue(weather, ["updated_at", "updatedAt", "time", "timestamp"]);

  const rainOutlook = useMemo(() => getRainOutlook(forecast, rain), [forecast, rain]);
  const weatherAreaName = typeof weather?.location?.name === "string" && weather.location.name.trim()
    ? weather.location.name.trim()
    : "";
  const locationCoordinates = siteLocation
    ? `${formatCoordinate(siteLocation.lat)}, ${formatCoordinate(siteLocation.lon)}`
    : "";
  const locationLabel = siteLocation
    ? siteLocation.label || weatherAreaName || "Site weather location"
    : "No site weather location set";
  const locationMeta = siteLocation
    ? `Coordinates ${locationCoordinates}`
    : "Tap Use my location on site.";

  return (
    <div className="space-y-4" data-testid="weather-page" data-commercial-readiness="weather-v7-frontend-area-name">
      <section className="overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-sm">
        <div className="border-b border-border/70 px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
            Site conditions
          </p>
          <h2 className="mt-1 font-heading text-3xl font-black uppercase tracking-[0.08em]">
            Weather
          </h2>
          <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
            Set the site location from this phone, then use the weather snapshot as diary evidence for rain, wind, temperature, access constraints, exterior works, deliveries, and delay notes.
          </p>
        </div>

        <div className="grid gap-3 px-4 py-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-border bg-background/70 p-4" data-testid="weather-site-location-control">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Site weather location
            </div>
            <p className="mt-2 text-lg font-black">{locationLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground" data-testid="weather-location-meta">{locationMeta}</p>
            {locationStatus ? (
              <p className="mt-1 text-xs text-muted-foreground">{locationStatus}</p>
            ) : null}

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={useDeviceLocation}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm"
                data-testid="weather-use-device-location"
              >
                Use my location
              </button>
              {siteLocation ? (
                <button
                  type="button"
                  onClick={clearLocation}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-bold text-foreground"
                  data-testid="weather-clear-site-location"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background/70 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Status
            </div>
            <p className="mt-2 text-lg font-black">
              {weatherStatus === "ready" ? "Weather loaded" : weatherStatus === "loading" ? "Loading..." : "Set location"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {weather?.is_mock
                ? "Fallback data is being used until the live OpenWeather key is configured."
                : "Live weather will use the selected site coordinates."}
            </p>
          </div>
        </div>
      </section>

      {weatherStatus === "idle" ? (
        <section className="rounded-xl border border-border bg-background/80 p-4" data-testid="weather-set-location-empty-state">
          <div className="text-sm font-bold">Set this job/site weather location first.</div>
          <p className="mt-1 text-sm text-muted-foreground">
            This avoids using Auckland or any other default location. Tap Use my location on site, then the forecast will load for that coordinate.
          </p>
        </section>
      ) : null}

      {weatherStatus === "loading" ? (
        <section className="rounded-xl border border-border bg-background/80 p-4" data-testid="weather-live-loading">
          <div className="text-sm font-semibold">Loading site weather...</div>
          <p className="mt-1 text-sm text-muted-foreground">Checking the LLD weather API for the selected site coordinates.</p>
        </section>
      ) : null}

      {weatherStatus === "error" ? (
        <section className="rounded-xl border border-destructive/30 bg-destructive/10 p-4" data-testid="weather-live-error">
          <div className="text-sm font-bold text-destructive">Weather data unavailable</div>
          <p className="mt-1 text-sm text-muted-foreground">{weatherError}</p>
        </section>
      ) : null}

      {weatherStatus === "ready" ? (
        <>
          <section className="rounded-2xl border border-border bg-background/80 p-4" data-testid="weather-live-summary">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Now on site</div>
                <p className="mt-2 text-4xl font-black">{formatWeatherValue(temperature, "\u00b0C")}</p>
                <p className="mt-1 text-base font-semibold text-muted-foreground">{String(condition)}</p>
              </div>
              <div className="rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
                Feels like <span className="font-bold text-foreground">{formatWeatherValue(feelsLike, "\u00b0C")}</span>
                <br />
                Humidity <span className="font-bold text-foreground">{formatWeatherValue(humidity, "%")}</span>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card/70 p-3">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Rain outlook</div>
                <p className="mt-1 text-lg font-black">{rainOutlook}</p>
              </div>
              <div className="rounded-xl border border-border bg-card/70 p-3">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Wind</div>
                <p className="mt-1 text-lg font-black">{formatWeatherValue(wind, " km/h", "Not supplied")}</p>
              </div>
            </div>
          </section>

          {forecast.length > 0 ? (
            <section className="rounded-2xl border border-border bg-background/80 p-4" data-testid="weather-live-forecast">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">7-day forecast</div>
                <div className="text-xs text-muted-foreground">Site weather</div>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {forecast.map((day, index) => (
                  <div key={`${day.date || "forecast"}-${index}`} className="min-w-[150px] rounded-xl border border-border bg-card/70 p-3">
                    <div className="text-sm font-bold">{formatDateLabel(day.date)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{String(day.description || "Forecast")}</div>
                    <div className="mt-3 text-sm font-semibold">
                      {formatWeatherValue(day.temp_min, "\u00b0C")} / {formatWeatherValue(day.temp_max, "\u00b0C")}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {weatherStatus === "ready" && updatedAt ? (
        <p className="text-xs text-muted-foreground" data-testid="weather-live-updated-at">
          Last weather update: {String(updatedAt)}
        </p>
      ) : null}
    </div>
  );
}