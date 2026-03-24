import React, { useState, useEffect, useCallback } from 'react';
import { diaryApi, projectsApi } from '../lib/api';
import { toast } from 'sonner';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Target,
  ListTodo,
  AlertTriangle,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const DiaryPage = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [diary, setDiary] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await projectsApi.getAll();
      setProjects(res.data);
      if (res.data.length > 0) {
        setSelectedProject(res.data[0].id);
      }
    } catch (error) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDiary = useCallback(async () => {
    if (!selectedProject) return;

    try {
      const res = await diaryApi.get(selectedProject, selectedDate);
      setDiary(res.data);
    } catch (error) {
      console.error('Failed to load diary:', error);
      setDiary(null);
      toast.error('Failed to load diary');
    }
  }, [selectedProject, selectedDate]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (selectedProject) {
      fetchDiary();
    }
  }, [selectedProject, selectedDate, fetchDiary]);

  const changeDate = (days) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-NZ', {
      weekday: 'long',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="empty-state py-20">
        <BookOpen className="empty-state-icon" />
        <p className="empty-state-title">No Projects Yet</p>
        <p className="empty-state-description">Create a project first to view daily diary.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="diary-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold tracking-tight uppercase">Daily Diary</h2>
          <p className="text-sm text-muted-foreground">Project summary by day</p>
        </div>

        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-[200px]" data-testid="diary-project-select">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="ops-card">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} data-testid="prev-day">
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <div className="text-center">
              <p className="font-heading text-xl font-semibold uppercase">{formatDate(selectedDate)}</p>
              {selectedDate === new Date().toISOString().split('T')[0] && (
                <span className="text-xs text-primary uppercase">Today</span>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => changeDate(1)}
              disabled={selectedDate >= new Date().toISOString().split('T')[0]}
              data-testid="next-day"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {diary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="ops-card">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-2xl font-heading font-bold">{diary.summary?.entries_count || 0}</p>
                <p className="text-xs text-muted-foreground uppercase">Entries</p>
              </CardContent>
            </Card>

            <Card className="ops-card">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-2xl font-heading font-bold">{diary.summary?.items_opened || 0}</p>
                <p className="text-xs text-muted-foreground uppercase">Opened</p>
              </CardContent>
            </Card>

            <Card className="ops-card">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-2xl font-heading font-bold text-emerald-500">{diary.summary?.items_closed || 0}</p>
                <p className="text-xs text-muted-foreground uppercase">Closed</p>
              </CardContent>
            </Card>

            <Card className="ops-card">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-2xl font-heading font-bold text-red-500">{diary.summary?.blocked_gates || 0}</p>
                <p className="text-xs text-muted-foreground uppercase">Blocked</p>
              </CardContent>
            </Card>

            <Card className="ops-card">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-2xl font-heading font-bold text-amber-500">{diary.summary?.at_risk_gates || 0}</p>
                <p className="text-xs text-muted-foreground uppercase">At Risk</p>
              </CardContent>
            </Card>

            <Card className="ops-card">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-2xl font-heading font-bold text-red-400">{diary.summary?.overdue_items || 0}</p>
                <p className="text-xs text-muted-foreground uppercase">Overdue</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="ops-card">
              <CardHeader className="ops-card-header py-3">
                <CardTitle className="font-heading text-sm uppercase tracking-wide flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Site Notes ({diary.walkaround_entries?.length || 0})
                </CardTitle>
              </CardHeader>

              <CardContent className="py-3 max-h-80 overflow-y-auto">
                {diary.walkaround_entries?.length > 0 ? (
                  <div className="space-y-3">
                    {diary.walkaround_entries.map((entry) => (
                      <div key={entry.id} className="p-3 bg-secondary/30 rounded-sm space-y-1">
                        <p className="text-sm">{entry.note}</p>

                        {entry.linked_task && (
                          <p className="text-xs text-primary">
                            Task: {entry.linked_task.name}
                          </p>
                        )}

                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleTimeString('en-NZ', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                          {entry.owner && ` - ${entry.owner}`}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No entries recorded</p>
                )}
              </CardContent>
            </Card>

            <Card className="ops-card">
              <CardHeader className="ops-card-header py-3">
                <CardTitle className="font-heading text-sm uppercase tracking-wide flex items-center gap-2">
                  <ListTodo className="w-4 h-4" />
                  Items Opened ({diary.action_items_opened?.length || 0})
                </CardTitle>
              </CardHeader>

              <CardContent className="py-3 max-h-80 overflow-y-auto">
                {diary.action_items_opened?.length > 0 ? (
                  <div className="space-y-2">
                    {diary.action_items_opened.map((item) => (
                      <div key={item.id} className="p-2 bg-secondary/30 rounded-sm border-l-4 border-l-amber-500">
                        <p className="text-sm font-medium">{item.title}</p>
                        <span
                          className={`text-xs ${
                            item.priority === 'critical'
                              ? 'text-red-500'
                              : item.priority === 'high'
                                ? 'text-orange-500'
                                : 'text-muted-foreground'
                          }`}
                        >
                          {item.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No items opened</p>
                )}
              </CardContent>
            </Card>

            <Card className="ops-card">
              <CardHeader className="ops-card-header py-3">
                <CardTitle className="font-heading text-sm uppercase tracking-wide flex items-center gap-2 text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" />
                  Items Closed ({diary.action_items_closed?.length || 0})
                </CardTitle>
              </CardHeader>

              <CardContent className="py-3 max-h-80 overflow-y-auto">
                {diary.action_items_closed?.length > 0 ? (
                  <div className="space-y-2">
                    {diary.action_items_closed.map((item) => (
                      <div key={item.id} className="p-2 bg-secondary/30 rounded-sm border-l-4 border-l-emerald-500">
                        <p className="text-sm font-medium">{item.title}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No items closed</p>
                )}
              </CardContent>
            </Card>

            <Card className="ops-card">
              <CardHeader className="ops-card-header py-3">
                <CardTitle className="font-heading text-sm uppercase tracking-wide flex items-center gap-2 text-red-500">
                  <AlertTriangle className="w-4 h-4" />
                  Blocked / Delayed Gates ({diary.blocked_gates?.length || 0})
                </CardTitle>
              </CardHeader>

              <CardContent className="py-3 max-h-80 overflow-y-auto">
                {diary.blocked_gates?.length > 0 ? (
                  <div className="space-y-2">
                    {diary.blocked_gates.map((gate) => (
                      <div key={gate.id} className="p-2 bg-red-950/30 rounded-sm border-l-4 border-l-red-500">
                        <p className="text-sm font-medium">{gate.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Owner: {gate.owner_party} • Required:{' '}
                          {new Date(gate.required_by_date).toLocaleDateString('en-NZ', {
                            day: '2-digit',
                            month: 'short'
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No blocked gates</p>
                )}
              </CardContent>
            </Card>

            <Card className="ops-card lg:col-span-2">
              <CardHeader className="ops-card-header py-3">
                <CardTitle className="font-heading text-sm uppercase tracking-wide flex items-center gap-2 text-red-400">
                  <Target className="w-4 h-4" />
                  Overdue Items ({diary.overdue_items?.length || 0})
                </CardTitle>
              </CardHeader>

              <CardContent className="py-3">
                {diary.overdue_items?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {diary.overdue_items.map((item) => (
                      <div key={item.id} className="p-2 bg-red-950/20 rounded-sm border-l-4 border-l-red-400">
                        <p className="text-sm font-medium">{item.title}</p>
                        {item.due_date && (
                          <p className="text-xs text-red-400">
                            Due:{' '}
                            {new Date(item.due_date).toLocaleDateString('en-NZ', {
                              day: '2-digit',
                              month: 'short'
                            })}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No overdue items</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default DiaryPage;
