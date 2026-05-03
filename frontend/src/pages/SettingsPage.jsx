import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { LayoutDashboard, SlidersHorizontal, RotateCcw, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

const STORAGE_KEY = 'lld_dashboard_layout_v1';

const DASHBOARD_WIDGETS = [
  {
    key: 'stats',
    label: 'Summary tiles',
    helper: 'Active projects, open items, critical items, and roadblocks / concerns.'
  },
  {
    key: 'blockedDelayed',
    label: 'Blocked / delayed roadblocks',
    helper: 'Roadblocks or concerns that need immediate site attention.'
  },
  {
    key: 'concernsAtRisk',
    label: 'Concerns / at risk',
    helper: 'Items inside the risk window or trending toward delay.'
  },
  {
    key: 'overdue',
    label: 'Overdue action items',
    helper: 'Action items already past their due date.'
  },
  {
    key: 'dueToday',
    label: 'Due today',
    helper: 'Action items due today.'
  },
  {
    key: 'dueThisWeek',
    label: 'Due this week',
    helper: 'Action items due within the current week.'
  },
  {
    key: 'recentlyCompleted',
    label: 'Recently completed',
    helper: 'Recently closed actions for quick site review.'
  },
  {
    key: 'quickActions',
    label: 'Quick actions',
    helper: 'Quick Capture and View Projects buttons.'
  }
];

const PRESETS = {
  focused: {
    label: 'Focused',
    description: 'Only the core items needed for day-to-day site use.',
    widgets: {
      stats: true,
      blockedDelayed: true,
      concernsAtRisk: true,
      overdue: true,
      dueToday: true,
      dueThisWeek: false,
      recentlyCompleted: false,
      quickActions: true
    }
  },
  standard: {
    label: 'Standard',
    description: 'Balanced dashboard for normal project/site use.',
    widgets: {
      stats: true,
      blockedDelayed: true,
      concernsAtRisk: true,
      overdue: true,
      dueToday: true,
      dueThisWeek: true,
      recentlyCompleted: false,
      quickActions: true
    }
  },
  full: {
    label: 'Full Control Room',
    description: 'Everything visible for managers and full operational review.',
    widgets: {
      stats: true,
      blockedDelayed: true,
      concernsAtRisk: true,
      overdue: true,
      dueToday: true,
      dueThisWeek: true,
      recentlyCompleted: true,
      quickActions: true
    }
  }
};

const DEFAULT_LAYOUT = {
  preset: 'standard',
  widgets: PRESETS.standard.widgets
};

function readLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;

    const parsed = JSON.parse(raw);
    return {
      preset: parsed.preset || 'standard',
      widgets: {
        ...DEFAULT_LAYOUT.widgets,
        ...(parsed.widgets || {})
      }
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export default function SettingsPage() {
  const [layout, setLayout] = useState(readLayout);

  const selectedPreset = useMemo(() => {
    if (layout.preset === 'custom') return 'Custom';
    return PRESETS[layout.preset]?.label || 'Standard';
  }, [layout.preset]);

  const applyPreset = (presetKey) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;

    const next = {
      preset: presetKey,
      widgets: { ...preset.widgets }
    };

    setLayout(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    toast.success(`${preset.label} dashboard layout applied`);
  };

  const toggleWidget = (widgetKey) => {
    setLayout(prev => ({
      preset: 'custom',
      widgets: {
        ...prev.widgets,
        [widgetKey]: !prev.widgets[widgetKey]
      }
    }));
  };

  const saveLayout = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    window.dispatchEvent(new Event('lld-dashboard-layout-updated'));
    toast.success('Dashboard layout saved');
  };

  const resetLayout = () => {
    const next = DEFAULT_LAYOUT;
    setLayout(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('lld-dashboard-layout-updated'));
    toast.success('Dashboard layout reset to Standard');
  };

  return (
    <div className="space-y-4" data-testid="settings-page">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Settings
        </p>
        <h2 className="font-heading text-2xl font-bold tracking-tight uppercase">
          Dashboard Layout
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how much detail appears on your Long Line Diary dashboard. This first version saves your personal layout on this device.
        </p>
      </div>

      <Card className="ops-card border-primary/40">
        <CardHeader className="ops-card-header py-3">
          <CardTitle className="font-heading text-lg uppercase tracking-[0.12em] flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            Layout Presets
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className={`rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary ${
                  layout.preset === key
                    ? 'border-primary bg-primary/15 shadow-[0_18px_50px_rgba(245,190,80,0.12)]'
                    : 'border-border bg-card'
                }`}
              >
                <p className="font-heading text-lg font-bold uppercase tracking-[0.1em]">
                  {preset.label}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {preset.description}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-border bg-background/50 p-3 text-sm text-muted-foreground">
            Current layout: <span className="font-semibold text-primary">{selectedPreset}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="ops-card">
        <CardHeader className="ops-card-header py-3">
          <CardTitle className="font-heading text-lg uppercase tracking-[0.12em] flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            Dashboard Panels
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {DASHBOARD_WIDGETS.map(widget => (
              <label
                key={widget.key}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${
                  layout.widgets[widget.key]
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-border bg-card/70 opacity-75'
                }`}
              >
                <input
                  type="checkbox"
                  checked={!!layout.widgets[widget.key]}
                  onChange={() => toggleWidget(widget.key)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="block font-heading text-sm font-bold uppercase tracking-[0.12em]">
                    {widget.label}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {widget.helper}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button className="btn-primary" onClick={saveLayout}>
              <Save className="mr-2 h-4 w-4" />
              Save Layout
            </Button>
            <Button variant="secondary" onClick={resetLayout}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Standard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}