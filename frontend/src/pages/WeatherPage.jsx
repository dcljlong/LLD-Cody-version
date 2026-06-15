import React, { useEffect, useState } from "react";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "https://lld-cody-version.onrender.com";

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

function formatLocation(value, weather) {
  if (weather?.is_mock) {
    return "Auckland, NZ";
  }

  if (value && typeof value === "object") {
    if (value.name) {
      return String(value.name);
    }

    if (value.lat !== undefined && value.lon !== undefined) {
      return `Lat ${Math.round(Number(value.lat) * 10000) / 10000}, Lon ${Math.round(Number(value.lon) * 10000) / 10000}`;
    }

    return "Current site";
  }

  return value ? String(value) : "Auckland, NZ";
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

function findRainOutlook(forecast) {
  const rainyDay = forecast.find((day) => {
    const description = String(day.description || "").toLowerCase();
    return description.includes("rain") || description.includes("shower");
  });

  if (!rainyDay) {
    return "No rain in fallback forecast";
  }

  return `${formatDateLabel(rainyDay.date)} - ${rainyDay.description}`;
}

export default function WeatherPage() {
  const [weather, setWeather] = useState(null);
  const [weatherStatus, setWeatherStatus] = useState("loading");
  const [weatherError, setWeatherError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      setWeatherStatus("loading");
      setWeatherError("");

      try {
        const response = await axios.get(API_BASE_URL + "/api/weather");
        if (cancelled) return;

        setWeather(response.data || {});
        setWeatherStatus("ready");
      } catch (error) {
        if (cancelled) return;

        setWeather(null);
        setWeatherStatus("error");
        setWeatherError(error?.response?.data?.detail || error?.message || "Weather could not be loaded.");
      }
    }

    loadWeather();

    return () => {
      cancelled = true;
    };
  }, []);

  const currentWeather = weather?.current || weather?.today || {};
  const forecast = Array.isArray(weather?.forecast) ? weather.forecast : [];
  const rawLocation = pickWeatherValue(currentWeather, ["location", "name", "city", "site", "project_location"]) || pickWeatherValue(weather, ["location", "name", "city"]);
  const location = formatLocation(rawLocation, weather);
  const condition = pickWeatherValue(currentWeather, ["condition", "description", "summary", "weather"]) || "Condition not supplied";
  const temperature = pickWeatherValue(currentWeather, ["temperature", "temp", "temp_c", "temperature_c"]);
  const feelsLike = pickWeatherValue(currentWeather, ["feels_like", "feelsLike", "feels_like_c"]);
  const humidity = pickWeatherValue(currentWeather, ["humidity", "humidity_percent"]);
  const rain = pickWeatherValue(currentWeather, ["rain", "rain_mm", "precipitation", "precipitation_mm"]);
  const wind = pickWeatherValue(currentWeather, ["wind", "wind_speed", "wind_kph", "wind_speed_kph"]);
  const updatedAt = pickWeatherValue(currentWeather, ["updated_at", "updatedAt", "time", "timestamp"]) || pickWeatherValue(weather, ["updated_at", "updatedAt", "time", "timestamp"]);
  const rainOutlook = rain === null ? findRainOutlook(forecast) : formatWeatherValue(rain, " mm");
  const windLabel = formatWeatherValue(wind, " km/h", "Not supplied by fallback weather");

  return (
    <div className="space-y-5" data-testid="weather-page" data-commercial-readiness="weather-v4-display-polish">
      <section className="ops-card rounded-xl border border-primary/20 bg-card p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
          Site conditions
        </p>
        <h2 className="mt-1 font-heading text-2xl font-black uppercase tracking-[0.06em] sm:text-4xl sm:tracking-[0.08em]">
          Weather
        </h2>
        <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-muted-foreground">
          Commercial V1 weather checkpoint for rain, wind, temperature, delays, access constraints, exterior works, deliveries, and diary evidence.
        </p>
      </section>

      {weatherStatus === "loading" ? (
        <section className="rounded-xl border border-border bg-background/80 p-4" data-testid="weather-live-loading">
          <div className="text-sm font-semibold">Loading live weather...</div>
          <p className="mt-1 text-sm text-muted-foreground">Checking the live LLD weather API.</p>
        </section>
      ) : null}

      {weatherStatus === "error" ? (
        <section className="rounded-xl border border-destructive/30 bg-destructive/10 p-4" data-testid="weather-live-error">
          <div className="text-sm font-bold text-destructive">Weather data unavailable</div>
          <p className="mt-1 text-sm text-muted-foreground">{weatherError}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Keep recording rain, wind, temperature, and site-condition impacts in the diary until the weather service responds.
          </p>
        </section>
      ) : null}

      {weatherStatus === "ready" ? (
        <>
          <section className="grid gap-3 md:grid-cols-4" data-testid="weather-live-summary">
            <div className="rounded-xl border border-border bg-background/80 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Location</div>
              <p className="mt-2 text-lg font-black">{location}</p>
              <p className="mt-1 text-sm text-muted-foreground">{String(condition)}</p>
            </div>

            <div className="rounded-xl border border-border bg-background/80 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Temperature</div>
              <p className="mt-2 text-lg font-black">{formatWeatherValue(temperature, "°C")}</p>
              <p className="mt-1 text-sm text-muted-foreground">Feels like {formatWeatherValue(feelsLike, "°C")}</p>
            </div>

            <div className="rounded-xl border border-border bg-background/80 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Rain outlook</div>
              <p className="mt-2 text-lg font-black">{rainOutlook}</p>
              <p className="mt-1 text-sm text-muted-foreground">Record weather delay against diary notes and roadblocks.</p>
            </div>

            <div className="rounded-xl border border-border bg-background/80 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Wind / Humidity</div>
              <p className="mt-2 text-lg font-black">{windLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">Humidity {formatWeatherValue(humidity, "%")}</p>
            </div>
          </section>

          {forecast.length > 0 ? (
            <section className="rounded-xl border border-border bg-background/80 p-4" data-testid="weather-live-forecast">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">7-day forecast</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {forecast.map((day, index) => (
                  <div key={`${day.date || "forecast"}-${index}`} className="rounded-lg border border-border bg-card/70 p-3">
                    <div className="text-sm font-bold">{formatDateLabel(day.date)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{String(day.description || "Forecast")}</div>
                    <div className="mt-2 text-sm font-semibold">
                      {formatWeatherValue(day.temp_min, "°C")} / {formatWeatherValue(day.temp_max, "°C")}
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

      {weather?.is_mock ? (
        <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground" data-testid="weather-mock-data-note">
          Weather is using Auckland fallback data because the live OpenWeather key is not configured yet.
        </p>
      ) : null}
    </div>
  );
}