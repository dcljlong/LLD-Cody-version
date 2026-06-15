import React from "react";

export default function WeatherPage() {
  return (
    <div className="space-y-5" data-testid="weather-page" data-commercial-readiness="weather-v1">
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