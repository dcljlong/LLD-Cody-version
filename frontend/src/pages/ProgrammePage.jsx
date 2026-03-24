import React, { useEffect, useMemo, useState } from 'react';
import { projectsApi, programmesApi } from '../lib/api';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Save
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const OWNER_OPTIONS = ['UNASSIGNED', 'OURS', 'MC', 'SUBBIES', 'COUNCIL', 'WATCH'];

function normaliseItems(res) {
  return res?.data?.value || res?.data || [];
}

function formatDateCell(value) {
  if (!value) return '';
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
}

export default function ProgrammePage() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [programmes, setProgrammes] = useState([]);
  const [selectedProgrammeId, setSelectedProgrammeId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [file, setFile] = useState(null);
  const [expandedTasks, setExpandedTasks] = useState({});

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingProgrammes, setLoadingProgrammes] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState('');

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoadingProjects(true);
        const res = await projectsApi.getAll();
        const items = normaliseItems(res);
        setProjects(items);
        if (items.length > 0) {
          setSelectedProjectId(items[0].id);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load projects');
      } finally {
        setLoadingProjects(false);
      }
    };

    loadProjects();
  }, []);

  useEffect(() => {
    const loadProgrammes = async () => {
      if (!selectedProjectId) {
        setProgrammes([]);
        setSelectedProgrammeId('');
        setTasks([]);
        setDrafts({});
        return;
      }

      try {
        setLoadingProgrammes(true);
        const res = await programmesApi.getAll(selectedProjectId);
        const items = normaliseItems(res);
        setProgrammes(items);

        if (items.length > 0) {
          setSelectedProgrammeId(items[0].id);
        } else {
          setSelectedProgrammeId('');
          setTasks([]);
          setDrafts({});
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load programmes');
        setProgrammes([]);
      } finally {
        setLoadingProgrammes(false);
      }
    };

    loadProgrammes();
  }, [selectedProjectId]);

  useEffect(() => {
    const loadTasks = async () => {
      if (!selectedProgrammeId) {
        setTasks([]);
        setDrafts({});
        return;
      }

      try {
        setLoadingTasks(true);
        const res = await programmesApi.getTasks(selectedProgrammeId);
        const items = normaliseItems(res);
        setTasks(items);

        const nextDrafts = {};
        items.forEach((task) => {
          nextDrafts[task.id] = {
            owner_tag: task.owner_tag || 'UNASSIGNED',
            is_tracked: !!task.is_tracked,
            programme_start_date: formatDateCell(task.programme_start_date),
            end_date: formatDateCell(task.end_date),
            duration_days:
              task.duration_days === null || task.duration_days === undefined
                ? ''
                : String(task.duration_days)
          };
        });
        setDrafts(nextDrafts);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load programme tasks');
        setTasks([]);
      } finally {
        setLoadingTasks(false);
      }
    };

    loadTasks();
  }, [selectedProgrammeId]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const selectedProgramme = useMemo(
    () => programmes.find((p) => p.id === selectedProgrammeId) || null,
    [programmes, selectedProgrammeId]
  );

  const taskSummary = useMemo(() => {
    const trackedCount = tasks.filter((task) => !!task.is_tracked).length;
    const ownedCount = tasks.filter((task) => (task.owner_tag || 'UNASSIGNED') !== 'UNASSIGNED').length;
    
    // Calculate late/at risk
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lateCount = tasks.filter(task => {
      if (!task.end_date || task.is_tracked) return false;
      const endDate = new Date(task.end_date);
      return endDate < today;
    }).length;
    
    return {
      total: tasks.length,
      tracked: trackedCount,
      tagged: ownedCount,
      late: lateCount
    };
  }, [tasks]);

  const toBase64 = (fileObj) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(fileObj);
    });

  const handleUpload = async () => {
    if (!selectedProjectId) {
      toast.error('Select a project first');
      return;
    }

    if (!file) {
      toast.error('Choose a PDF first');
      return;
    }

    try {
      setUploading(true);

      const pdfBase64 = await toBase64(file);

      const payload = {
        project_id: selectedProjectId,
        pdf_base64: pdfBase64,
        filename: file.name
      };

      const res = await programmesApi.upload(payload);
      const uploadedProgramme = res.data?.programme;
      const uploadedTasks = res.data?.tasks || [];

      toast.success(res.data?.message || 'Programme uploaded');
      setTasks(uploadedTasks);

      const refreshed = await programmesApi.getAll(selectedProjectId);
      const refreshedItems = normaliseItems(refreshed);
      setProgrammes(refreshedItems);

      if (uploadedProgramme?.id) {
        setSelectedProgrammeId(uploadedProgramme.id);
      } else if (refreshedItems.length > 0) {
        setSelectedProgrammeId(refreshedItems[0].id);
      }

      setFile(null);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.detail || 'Programme upload failed');
    } finally {
      setUploading(false);
    }
  };

  const updateDraft = (taskId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || {}),
        [field]: value
      }
    }));
  };

  const isRowDirty = (task) => {
    const draft = drafts[task.id];
    if (!draft) return false;

    return (
      (draft.owner_tag || 'UNASSIGNED') !== (task.owner_tag || 'UNASSIGNED') ||
      !!draft.is_tracked !== !!task.is_tracked ||
      (draft.programme_start_date || '') !== formatDateCell(task.programme_start_date) ||
      (draft.end_date || '') !== formatDateCell(task.end_date) ||
      String(draft.duration_days || '') !==
        String(
          task.duration_days === null || task.duration_days === undefined
            ? ''
            : task.duration_days
        )
    );
  };

  const handleSaveRow = async (task) => {
    const draft = drafts[task.id];
    if (!draft) return;

    try {
      setSavingTaskId(task.id);

      await programmesApi.updateTaskTag(task.id, {
        owner_tag: draft.owner_tag || 'UNASSIGNED',
        is_tracked: !!draft.is_tracked
      });

      await programmesApi.updateTaskDates(task.id, {
        programme_start_date: draft.programme_start_date || null,
        end_date: draft.end_date || null,
        duration_days:
          draft.duration_days === '' || draft.duration_days === null || draft.duration_days === undefined
            ? null
            : Number(draft.duration_days)
      });

      setTasks((prev) =>
        prev.map((row) =>
          row.id === task.id
            ? {
                ...row,
                owner_tag: draft.owner_tag || 'UNASSIGNED',
                is_tracked: !!draft.is_tracked,
                programme_start_date: draft.programme_start_date || null,
                end_date: draft.end_date || null,
                duration_days:
                  draft.duration_days === '' || draft.duration_days === null || draft.duration_days === undefined
                    ? null
                    : Number(draft.duration_days)
              }
            : row
        )
      );

      toast.success(`Saved: ${task.task_name}`);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.detail || 'Failed to save');
    } finally {
      setSavingTaskId('');
    }
  };

  const toggleTaskExpand = (taskId) => {
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const getTaskStatus = (task) => {
    if (task.is_tracked) return { label: 'Tracked', color: 'text-emerald-400' };
    if (!task.end_date) return { label: 'No Date', color: 'text-muted-foreground' };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(task.end_date);
    
    if (endDate < today) return { label: 'Late', color: 'text-red-400' };
    
    const daysUntil = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 7) return { label: `${daysUntil}d left`, color: 'text-amber-400' };
    
    return { label: 'On Track', color: 'text-emerald-400' };
  };

  if (loadingProjects) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="programme-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold tracking-tight uppercase">Programme</h2>
          <p className="text-sm text-muted-foreground">View and track programme tasks</p>
        </div>

        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-[200px]" data-testid="project-select">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.job_number ? `${p.job_number} - ` : ''}{p.name || 'Untitled'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="ops-card">
          <CardContent className="py-3 px-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Total Tasks</p>
            <p className="text-2xl font-bold mt-1">{taskSummary.total}</p>
          </CardContent>
        </Card>
        <Card className="ops-card">
          <CardContent className="py-3 px-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Assigned</p>
            <p className="text-2xl font-bold mt-1">{taskSummary.tagged}</p>
          </CardContent>
        </Card>
        <Card className="ops-card border-emerald-500/40">
          <CardContent className="py-3 px-4">
            <p className="text-xs uppercase tracking-[0.12em] text-emerald-400">Tracked</p>
            <p className="text-2xl font-bold mt-1 text-emerald-400">{taskSummary.tracked}</p>
          </CardContent>
        </Card>
        <Card className="ops-card border-red-500/40">
          <CardContent className="py-3 px-4">
            <p className="text-xs uppercase tracking-[0.12em] text-red-400">Late</p>
            <p className="text-2xl font-bold mt-1 text-red-400">{taskSummary.late}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Column - Upload and Programmes List */}
        <div className="space-y-4">
          {/* Upload Card */}
          <Card className="ops-card">
            <CardHeader className="ops-card-header py-3">
              <CardTitle className="font-heading text-sm uppercase tracking-wide flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Programme
              </CardTitle>
            </CardHeader>
            <CardContent className="py-4 space-y-3">
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />

              {file && (
                <p className="text-xs text-muted-foreground">
                  Selected: <span className="text-foreground font-medium">{file.name}</span>
                </p>
              )}

              <Button
                onClick={handleUpload}
                disabled={uploading || !selectedProjectId || !file}
                className="w-full"
              >
                {uploading ? 'Uploading...' : 'Upload & Parse'}
              </Button>
            </CardContent>
          </Card>

          {/* Programmes List */}
          <Card className="ops-card">
            <CardHeader className="ops-card-header py-3">
              <CardTitle className="font-heading text-sm uppercase tracking-wide flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Programmes ({programmes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="py-3">
              {loadingProgrammes ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : programmes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No programmes uploaded</p>
              ) : (
                <div className="space-y-2">
                  {programmes.map((prog) => (
                    <button
                      key={prog.id}
                      onClick={() => setSelectedProgrammeId(prog.id)}
                      className={`w-full text-left p-3 rounded-md border transition-colors ${
                        prog.id === selectedProgrammeId
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-secondary/30 hover:border-primary/50'
                      }`}
                    >
                      <p className="font-medium text-sm truncate">{prog.filename}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {prog.task_count ?? 0} tasks
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Tasks */}
        <div className="lg:col-span-3">
          <Card className="ops-card">
            <CardHeader className="ops-card-header py-3">
              <CardTitle className="font-heading text-sm uppercase tracking-wide">
                {selectedProgramme ? selectedProgramme.filename : 'Select a programme'}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-3">
              {loadingTasks ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading tasks...</p>
              ) : tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No tasks loaded</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => {
                    const draft = drafts[task.id] || {
                      owner_tag: task.owner_tag || 'UNASSIGNED',
                      is_tracked: !!task.is_tracked,
                      programme_start_date: formatDateCell(task.programme_start_date),
                      end_date: formatDateCell(task.end_date),
                      duration_days: task.duration_days === null ? '' : String(task.duration_days)
                    };
                    const dirty = isRowDirty(task);
                    const saving = savingTaskId === task.id;
                    const expanded = expandedTasks[task.id];
                    const status = getTaskStatus(task);

                    return (
                      <div
                        key={task.id}
                        className={`border rounded-lg overflow-hidden ${
                          dirty ? 'border-amber-500/50 bg-amber-950/10' : 'border-border'
                        }`}
                      >
                        {/* Task Header - Always visible */}
                        <div
                          className="flex items-center gap-3 p-3 cursor-pointer hover:bg-secondary/30"
                          onClick={() => toggleTaskExpand(task.id)}
                        >
                          <button className="p-1">
                            {expanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{task.task_name}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {task.end_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDateCell(task.end_date)}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {draft.owner_tag}
                              </span>
                            </div>
                          </div>

                          <span className={`text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>

                          {dirty && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveRow(task);
                              }}
                              disabled={saving}
                              className="h-7"
                            >
                              {saving ? '...' : <Save className="w-3 h-3" />}
                            </Button>
                          )}
                        </div>

                        {/* Expanded Edit Fields */}
                        {expanded && (
                          <div className="border-t border-border p-3 bg-secondary/20 space-y-3">
                            {/* Dependencies */}
                            {Array.isArray(task.dependencies) && task.dependencies.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Dependencies</p>
                                <p className="text-sm">{task.dependencies.join(', ')}</p>
                              </div>
                            )}

                            {/* Dates Row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">Start</label>
                                <Input
                                  type="date"
                                  value={draft.programme_start_date || ''}
                                  disabled={saving}
                                  onChange={(e) => updateDraft(task.id, 'programme_start_date', e.target.value)}
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">End</label>
                                <Input
                                  type="date"
                                  value={draft.end_date || ''}
                                  disabled={saving}
                                  onChange={(e) => updateDraft(task.id, 'end_date', e.target.value)}
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">Days</label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={draft.duration_days}
                                  disabled={saving}
                                  onChange={(e) => updateDraft(task.id, 'duration_days', e.target.value)}
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">Owner</label>
                                <Select
                                  value={draft.owner_tag || 'UNASSIGNED'}
                                  onValueChange={(val) => updateDraft(task.id, 'owner_tag', val)}
                                  disabled={saving}
                                >
                                  <SelectTrigger className="h-9 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {OWNER_OPTIONS.map((opt) => (
                                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Tracked Toggle & Save */}
                            <div className="flex items-center justify-between pt-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!draft.is_tracked}
                                  disabled={saving}
                                  onChange={(e) => updateDraft(task.id, 'is_tracked', e.target.checked)}
                                  className="w-4 h-4 rounded border-border"
                                />
                                <span className="text-sm">
                                  {draft.is_tracked ? (
                                    <span className="text-emerald-400 flex items-center gap-1">
                                      <CheckCircle2 className="w-4 h-4" /> Tracked
                                    </span>
                                  ) : (
                                    'Mark as Tracked'
                                  )}
                                </span>
                              </label>

                              <Button
                                onClick={() => handleSaveRow(task)}
                                disabled={!dirty || saving}
                                size="sm"
                              >
                                {saving ? 'Saving...' : dirty ? 'Save Changes' : 'Saved'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
