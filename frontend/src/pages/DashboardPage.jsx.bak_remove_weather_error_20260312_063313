import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi, weatherApi } from '../lib/api';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Target,
  Thermometer,
  Droplets,
  CloudRain,
  Sun,
  Cloud,
  CloudSun,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

const getWeatherIcon = (icon) => {
  if (icon?.includes('01')) return <Sun className="w-6 h-6 text-amber-400" />;
  if (icon?.includes('02') || icon?.includes('03')) return <CloudSun className="w-6 h-6 text-gray-400" />;
  if (icon?.includes('04')) return <Cloud className="w-6 h-6 text-gray-500" />;
  if (icon?.includes('09') || icon?.includes('10')) return <CloudRain className="w-6 h-6 text-blue-400" />;
  return <Sun className="w-6 h-6 text-amber-400" />;
};

const StatusBadge = ({ status }) => {
  const styles = {
    BLOCKED: 'status-blocked',
    DELAYED: 'status-delayed',
    AT_RISK: 'status-at-risk',
    ON_TRACK: 'status-on-track',
    COMPLETED: 'status-completed'
  };
  return (
    <span className={`status-badge ${styles[status] || styles.ON_TRACK}`} data-testid={`status-${status?.toLowerCase()}`}>
      {status?.replace('_', ' ')}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  const styles = {
    critical: 'bg-red-950/50 text-red-500 border-red-900',
    high: 'bg-orange-950/50 text-orange-500 border-orange-900',
    medium: 'bg-amber-950/50 text-amber-500 border-amber-900',
    low: 'bg-blue-950/50 text-blue-400 border-blue-900',
    deferred: 'bg-zinc-800 text-zinc-400 border-zinc-700'
  };
  return (
    <span className={`status-badge ${styles[priority] || styles.medium}`}>
      {priority}
    </span>
  );
};

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dashRes, weatherRes] = await Promise.all([
        dashboardApi.getSummary(),
        weatherApi.get(-36.8485, 174.7633) // Auckland default
      ]);
      setData(dashRes.data);
      setWeather(weatherRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const ItemCard = ({ item, type }) => (
    <div className={`action-card ops-card p-3 mb-2 border-l-4 ${
      item.priority === 'critical' ? 'border-l-red-500' :
      item.priority === 'high' ? 'border-l-orange-500' :
      item.priority === 'medium' ? 'border-l-amber-500' :
      'border-l-blue-400'
    }`} data-testid={`item-${item.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{item.title || item.name}</p>
          <p className="text-xs text-muted-foreground">{item.project_name}</p>
        </div>
        {type === 'gate' ? (
          <StatusBadge status={item.status} />
        ) : (
          <PriorityBadge priority={item.priority} />
        )}
      </div>
      {item.due_date && (
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Due: {new Date(item.due_date).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' })}
        </p>
      )}
      {item.required_by_date && (
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <Target className="w-3 h-3" />
          Required: {new Date(item.required_by_date).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' })}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Summary Stats */}
      <div className="dashboard-grid">
        <Card className="ops-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="dashboard-stat-label">Active Projects</p>
                <p className="dashboard-stat-value">{data?.projects_count || 0}</p>
              </div>
              <Target className="w-8 h-8 text-primary" strokeWidth={1.5} />
            </div>
          </CardContent>
        </Card>

        <Card className="ops-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="dashboard-stat-label">Open Items</p>
                <p className="dashboard-stat-value">{data?.summary?.open_items || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500" strokeWidth={1.5} />
            </div>
          </CardContent>
        </Card>

        <Card className="ops-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="dashboard-stat-label">Critical</p>
                <p className="dashboard-stat-value text-red-500">{data?.summary?.critical_items || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" strokeWidth={1.5} />
            </div>
          </CardContent>
        </Card>

        <Card className="ops-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="dashboard-stat-label">Gates at Risk</p>
                <p className="dashboard-stat-value text-amber-500">
                  {(data?.summary?.gates_blocked || 0) + (data?.summary?.gates_delayed || 0) + (data?.summary?.gates_at_risk || 0)}
                </p>
              </div>
              <Target className="w-8 h-8 text-amber-500" strokeWidth={1.5} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weather Widget */}
      {weather && (
        <Card className="ops-card" data-testid="weather-widget">
          <CardHeader className="ops-card-header py-3">
            <CardTitle className="font-heading text-sm uppercase tracking-wide flex items-center gap-2">
              <Thermometer className="w-4 h-4" />
              7-Day Weather {weather.is_mock && <Badge variant="secondary" className="text-xs">Mock</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3">
            <div className="flex items-center gap-6 mb-4">
              {getWeatherIcon(weather.current?.icon)}
              <div>
                <p className="text-3xl font-heading font-bold">{Math.round(weather.current?.temp)}°C</p>
                <p className="text-sm text-muted-foreground capitalize">{weather.current?.description}</p>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Thermometer className="w-4 h-4" />
                  Feels {Math.round(weather.current?.feels_like)}°
                </span>
                <span className="flex items-center gap-1">
                  <Droplets className="w-4 h-4" />
                  {weather.current?.humidity}%
                </span>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {weather.forecast?.slice(0, 7).map((day, i) => (
                <div key={i} className="weather-day flex-shrink-0 text-center min-w-[60px]">
                  <p className="text-xs text-muted-foreground">
                    {new Date(day.date).toLocaleDateString('en-NZ', { weekday: 'short' })}
                  </p>
                  {getWeatherIcon(day.icon)}
                  <p className="text-xs font-medium">{Math.round(day.temp_max)}°</p>
                  <p className="text-xs text-muted-foreground">{Math.round(day.temp_min)}°</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Blocked / Delayed */}
        <Card className="ops-card" data-testid="blocked-delayed-section">
          <CardHeader className="ops-card-header py-3">
            <CardTitle className="font-heading text-sm uppercase tracking-wide text-red-500 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Blocked / Delayed ({(data?.blocked_delayed?.length || 0)})
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 max-h-80 overflow-y-auto">
            {data?.blocked_delayed?.length > 0 ? (
              data.blocked_delayed.map(item => (
                <ItemCard key={item.id} item={item} type="gate" />
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No blocked items</p>
            )}
          </CardContent>
        </Card>

        {/* At Risk */}
        <Card className="ops-card" data-testid="at-risk-section">
          <CardHeader className="ops-card-header py-3">
            <CardTitle className="font-heading text-sm uppercase tracking-wide text-amber-500 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              At Risk ({(data?.at_risk?.length || 0)})
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 max-h-80 overflow-y-auto">
            {data?.at_risk?.length > 0 ? (
              data.at_risk.map(item => (
                <ItemCard key={item.id} item={item} type="gate" />
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No items at risk</p>
            )}
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card className="ops-card" data-testid="overdue-section">
          <CardHeader className="ops-card-header py-3">
            <CardTitle className="font-heading text-sm uppercase tracking-wide text-red-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Overdue ({(data?.overdue?.length || 0)})
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 max-h-80 overflow-y-auto">
            {data?.overdue?.length > 0 ? (
              data.overdue.map(item => (
                <ItemCard key={item.id} item={item} type="action" />
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No overdue items</p>
            )}
          </CardContent>
        </Card>

        {/* Due Today */}
        <Card className="ops-card" data-testid="due-today-section">
          <CardHeader className="ops-card-header py-3">
            <CardTitle className="font-heading text-sm uppercase tracking-wide flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Due Today ({(data?.due_today?.length || 0)})
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 max-h-80 overflow-y-auto">
            {data?.due_today?.length > 0 ? (
              data.due_today.map(item => (
                <ItemCard key={item.id} item={item} type="action" />
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nothing due today</p>
            )}
          </CardContent>
        </Card>

        {/* Due This Week */}
        <Card className="ops-card" data-testid="due-week-section">
          <CardHeader className="ops-card-header py-3">
            <CardTitle className="font-heading text-sm uppercase tracking-wide flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Due This Week ({(data?.due_this_week?.length || 0)})
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 max-h-80 overflow-y-auto">
            {data?.due_this_week?.length > 0 ? (
              data.due_this_week.map(item => (
                <ItemCard key={item.id} item={item} type="action" />
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nothing due this week</p>
            )}
          </CardContent>
        </Card>

        {/* Recently Completed */}
        <Card className="ops-card" data-testid="completed-section">
          <CardHeader className="ops-card-header py-3">
            <CardTitle className="font-heading text-sm uppercase tracking-wide text-emerald-500 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Recently Completed ({(data?.recently_completed?.length || 0)})
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 max-h-80 overflow-y-auto">
            {data?.recently_completed?.length > 0 ? (
              data.recently_completed.map(item => (
                <ItemCard key={item.id} item={item} type="action" />
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No recent completions</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <Link to="/walkaround">
          <Button className="btn-primary" data-testid="quick-walkaround">
            Quick Capture <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
        <Link to="/projects">
          <Button variant="secondary" data-testid="view-projects">
            View Projects
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default DashboardPage;
