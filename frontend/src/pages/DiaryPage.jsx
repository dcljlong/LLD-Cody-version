import React, { useState, useEffect, useCallback, useRef } from 'react';
import { diaryApi, projectsApi, walkaroundApi, gatesApi } from '../lib/api';
import { toast } from 'sonner';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Target,
  ListTodo,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Plus,
  Send,
  Camera,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gates, setGates] = useState([]);
  const fileInputRef = useRef(null);
  const noteInputRef = useRef(null);

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [entryData, setEntryData] = useState({
    note: '',
    priority: 'medium',
    owner: 'Me',
    due_date: tomorrow,
    gate_id: '',
    photos: [],
    create_action_item: true
  });

  const fetchProjects = useCallback(async () => {
    try {
      const res = await projectsApi.getAll();
      const items = Array.isArray(res.data) ? res.data : (res.data?.value || []);
      setProjects(items);
      if (items.length > 0) {
        const savedProject = localStorage.getItem('lld_last_project_id');
        if (savedProject && items.some(p => p.id === savedProject)) {
          setSelectedProject(savedProject);
        } else {
          setSelectedProject(items[0].id);
        }
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
    }
  }, [selectedProject, selectedDate]);

  const fetchGates = useCallback(async () => {
    if (!selectedProject) return;
    try {
      const res = await gatesApi.getAll({ project_id: selectedProject });
      const items = Array.isArray(res.data) ? res.data : (res.data?.value || []);
      setGates(items.filter(g => g.status !== 'COMPLETED'));
    } catch (error) {
      console.error('Failed to fetch gates:', error);
      setGates([]);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (selectedProject) {
      fetchDiary();
      fetchGates();
    }
  }, [selectedProject, selectedDate, fetchDiary, fetchGates]);

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

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Photo must be under 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setEntryData(prev => ({
          ...prev,
          photos: [...prev.photos, reader.result]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index) => {
    setEntryData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const handleQuickEntry = async (e) => {
    e.preventDefault();
    
    if (!entryData.note.trim()) {
      toast.error('Please enter a note');
      noteInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await walkaroundApi.create({
        ...entryData,
        project_id: selectedProject
      });
      
      localStorage.setItem('lld_last_project_id', selectedProject);
      toast.success('Entry captured');
      
      // Reset form
      setEntryData({
        note: '',
        priority: 'medium',
        owner: 'Me',
        due_date: tomorrow,
        gate_id: '',
        photos: [],
        create_action_item: true
      });
      
      // Refresh diary
      fetchDiary();
      setShowQuickEntry(false);
    } catch (error) {
      toast.error('Failed to save entry');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const priorityOptions = [
    { value: 'critical', label: 'Critical', color: 'bg-red-600' },
    { value: 'high', label: 'High', color: 'bg-orange-600' },
    { value: 'medium', label: 'Medium', color: 'bg-amber-600' },
    { value: 'low', label: 'Low', color: 'bg-blue-600' },
  ];

  const ownerOptions = ['Me', 'Site', 'MC', 'Subbies', 'Client'];

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

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Select value={selectedProject} onValueChange={(val) => {
            setSelectedProject(val);
            localStorage.setItem('lld_last_project_id', val);
          }}>
            <SelectTrigger className="w-full sm:w-[220px]" data-testid="diary-project-select">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.job_number ? `${p.job_number} - ` : ''}{p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedDate === today && (
            <Button onClick={() => setShowQuickEntry(!showQuickEntry)} data-testid="quick-entry-btn">
              <Plus className="w-4 h-4 mr-2" />
              Quick Entry
            </Button>
          )}
        </div>
      </div>

      {/* Quick Entry Form */}
      {showQuickEntry && selectedDate === today && (
        <Card className="ops-card border-primary/50">
          <CardHeader className="ops-card-header py-3 bg-primary/10">
            <CardTitle className="font-heading text-sm uppercase tracking-wide flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Quick Diary Entry
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <form onSubmit={handleQuickEntry} className="space-y-4">
              <Textarea
                ref={noteInputRef}
                placeholder="What happened today? Type here..."
                value={entryData.note}
                onChange={(e) => setEntryData(prev => ({ ...prev, note: e.target.value }))}
                className="min-h-[80px] text-base"
                data-testid="quick-entry-note"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Priority */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Priority</Label>
                  <div className="flex flex-wrap gap-1">
                    {priorityOptions.map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setEntryData(prev => ({ ...prev, priority: p.value }))}
                        className={`px-2 py-1.5 text-xs font-medium rounded border transition-all ${
                          entryData.priority === p.value
                            ? `${p.color} text-white border-transparent`
                            : 'border-border bg-secondary/40 hover:border-primary'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Owner */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Owner</Label>
                  <div className="flex flex-wrap gap-1">
                    {ownerOptions.map(o => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setEntryData(prev => ({ ...prev, owner: o }))}
                        className={`px-2 py-1.5 text-xs font-medium rounded border transition-all ${
                          entryData.owner === o
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-secondary/40 hover:border-primary'
                        }`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Due Date */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Due Date</Label>
                  <Input
                    type="date"
                    value={entryData.due_date}
                    onChange={(e) => setEntryData(prev => ({ ...prev, due_date: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Gate Link */}
                {gates.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Link to Gate</Label>
                    <Select
                      value={entryData.gate_id}
                      onValueChange={(val) => setEntryData(prev => ({ ...prev, gate_id: val }))}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {gates.map(g => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.order ? `${g.order}. ` : ''}{g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Photo & Submit Row */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-10 px-3 border border-dashed border-border rounded-md flex items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    <span className="text-sm">Photo</span>
                  </button>
                  
                  {entryData.photos.map((photo, i) => (
                    <div key={i} className="relative group">
                      <img src={photo} alt={`Upload ${i + 1}`} className="w-10 h-10 object-cover rounded" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  <label className="flex items-center gap-2 text-sm text-muted-foreground ml-4">
                    <input
                      type="checkbox"
                      checked={entryData.create_action_item}
                      onChange={(e) => setEntryData(prev => ({ ...prev, create_action_item: e.target.checked }))}
                      className="w-4 h-4 rounded"
                    />
                    Create action item
                  </label>
                </div>

                <Button type="submit" disabled={submitting || !entryData.note.trim()}>
                  {submitting ? 'Saving...' : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Save Entry
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Date Navigation */}
      <Card className="ops-card">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} data-testid="prev-day">
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <div className="text-center">
              <p className="font-heading text-xl font-semibold uppercase">{formatDate(selectedDate)}</p>
              {selectedDate === today && (
                <span className="text-xs text-primary uppercase">Today</span>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => changeDate(1)}
              disabled={selectedDate >= today}
              data-testid="next-day"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {diary && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Card className="ops-card">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-2xl font-heading font-bold">{diary.summary?.entries_count || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Entries</p>
              </CardContent>
            </Card>

            <Card className="ops-card">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-2xl font-heading font-bold">{diary.summary?.items_opened || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Opened</p>
              </CardContent>
            </Card>

            <Card className="ops-card">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-2xl font-heading font-bold text-emerald-500">{diary.summary?.items_closed || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Closed</p>
              </CardContent>
            </Card>

            <Card className="ops-card">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-2xl font-heading font-bold text-red-500">{diary.summary?.blocked_gates || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Blocked</p>
              </CardContent>
            </Card>

            <Card className="ops-card">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-2xl font-heading font-bold text-amber-500">{diary.summary?.at_risk_gates || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase">At Risk</p>
              </CardContent>
            </Card>

            <Card className="ops-card">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-2xl font-heading font-bold text-red-400">{diary.summary?.overdue_items || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Overdue</p>
              </CardContent>
            </Card>
          </div>

          {/* Content Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Site Notes */}
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
                      <div key={entry.id} className="p-3 bg-secondary/30 rounded-md space-y-1">
                        <p className="text-sm">{entry.note}</p>

                        {entry.linked_task && (
                          <p className="text-xs text-primary">
                            Task: {entry.linked_task.name}
                          </p>
                        )}

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {new Date(entry.created_at).toLocaleTimeString('en-NZ', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {entry.owner && <span>• {entry.owner}</span>}
                          {entry.priority && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              entry.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                              entry.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}>
                              {entry.priority}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No entries recorded</p>
                )}
              </CardContent>
            </Card>

            {/* Items Opened */}
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
                      <div key={item.id} className="p-2 bg-secondary/30 rounded-md border-l-4 border-l-amber-500">
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

            {/* Items Closed */}
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
                      <div key={item.id} className="p-2 bg-secondary/30 rounded-md border-l-4 border-l-emerald-500">
                        <p className="text-sm font-medium">{item.title}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No items closed</p>
                )}
              </CardContent>
            </Card>

            {/* Blocked Gates */}
            <Card className="ops-card">
              <CardHeader className="ops-card-header py-3">
                <CardTitle className="font-heading text-sm uppercase tracking-wide flex items-center gap-2 text-red-500">
                  <AlertTriangle className="w-4 h-4" />
                  Blocked / Delayed ({diary.blocked_gates?.length || 0})
                </CardTitle>
              </CardHeader>

              <CardContent className="py-3 max-h-80 overflow-y-auto">
                {diary.blocked_gates?.length > 0 ? (
                  <div className="space-y-2">
                    {diary.blocked_gates.map((gate) => (
                      <div key={gate.id} className="p-2 bg-red-950/30 rounded-md border-l-4 border-l-red-500">
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

            {/* Overdue Items */}
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
                      <div key={item.id} className="p-2 bg-red-950/20 rounded-md border-l-4 border-l-red-400">
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
