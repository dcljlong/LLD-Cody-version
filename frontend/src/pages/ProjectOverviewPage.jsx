import React from "react";

export default function ProjectOverviewPage() {
  return (
    <div className="space-y-5" data-testid="project-overview-page" data-commercial-readiness="project-overview-v1">
      <section className="ops-card rounded-xl border border-primary/20 bg-card p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
          Project control
        </p>
        <h2 className="mt-1 font-heading text-2xl font-black uppercase tracking-[0.06em] sm:text-4xl sm:tracking-[0.08em]">
          Project Overview
        </h2>
        <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-muted-foreground">
          Commercial V1 project snapshot for job context, live diary activity, open roadblocks, action items, programme awareness, and site-control follow-up.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-background/80 p-4">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Job context</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Use Projects for full job setup. This overview keeps the field team anchored to the active job before opening Diary, Roadblocks, or Action Items.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background/80 p-4">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Site risk</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Review roadblocks, due dates, related roadblocks, and programme impact before daily close-out.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background/80 p-4">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Daily proof</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Check staff diary rows, action items, weather constraints, and live site notes against the active project record.
          </p>
        </div>
      </section>
    </div>
  );
}