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

function formatWeatherValue(value, suffix) {
  if (value === undefined || value === null || value === "") {
    return "Not recorded";
  }

  if (typeof value === "number") {
    return `${Math.round(value * 10) / 10}${suffix || ""}`;
  }

  return `${value}${suffix || ""}`;
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

  const currentWeather = weather?.current || weather?.today || weather || {};
  const location = pickWeatherValue(currentWeather, ["location", "name", "city", "site", "project_location"]) || pickWeatherValue(weather, ["location", "name", "city"]) || "Current site";
  const condition = pickWeatherValue(currentWeather, ["condition", "description", "summary", "weather"]) || "Condition not recorded";
  const temperature = pickWeatherValue(currentWeather, ["temperature", "temp", "temp_c", "temperature_c"]);
  const rain = pickWeatherValue(currentWeather, ["rain", "rain_mm", "precipitation", "precipitation_mm"]);
  const wind = pickWeatherValue(currentWeather, ["wind", "wind_speed", "wind_kph", "wind_speed_kph"]);
  const updatedAt = pickWeatherValue(currentWeather, ["updated_at", "updatedAt", "time", "timestamp"]) || pickWeatherValue(weather, ["updated_at", "updatedAt", "time", "timestamp"]);

  return (
    <div className="space-y-5" data-testid="weather-page" data-commercial-readiness="weather-v2-live-api">
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
        <section className="grid gap-3 md:grid-cols-4" data-testid="weather-live-summary">
          <div className="rounded-xl border border-border bg-background/80 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Location</div>
            <p className="mt-2 text-lg font-black">{location}</p>
            <p className="mt-1 text-sm text-muted-foreground">{condition}</p>
          </div>

          <div className="rounded-xl border border-border bg-background/80 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Temperature</div>
            <p className="mt-2 text-lg font-black">{formatWeatherValue(temperature, "°C")}</p>
            <p className="mt-1 text-sm text-muted-foreground">Check curing, comfort, product limits, and site welfare.</p>
          </div>

          <div className="rounded-xl border border-border bg-background/80 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Rain</div>
            <p className="mt-2 text-lg font-black">{formatWeatherValue(rain, " mm")}</p>
            <p className="mt-1 text-sm text-muted-foreground">Record weather delay against diary notes and roadblocks.</p>
          </div>

          <div className="rounded-xl border border-border bg-background/80 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Wind</div>
            <p className="mt-2 text-lg font-black">{formatWeatherValue(wind, " km/h")}</p>
            <p className="mt-1 text-sm text-muted-foreground">Check deliveries, access equipment, and exterior work risk.</p>
          </div>
        </section>
      ) : null}

      {weatherStatus === "ready" && updatedAt ? (
        <p className="text-xs text-muted-foreground" data-testid="weather-live-updated-at">
          Last weather update: {String(updatedAt)}
        </p>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-background/80 p-4">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Rain</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Record rain impacts against diary notes, roadblocks, programme delay, and exterior work constraints.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background/80 p-4">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Wind</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Check wind exposure before deliveries, access equipment, roof work, facade work, and site lifting activities.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background/80 p-4">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Temperature</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Note temperature-sensitive works, product curing, comfort risks, and any site condition issue that belongs in the diary.
          </p>
        </div>
      </section>
    </div>
  );
}