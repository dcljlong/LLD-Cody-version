import React, { useState, useEffect, useCallback, useRef } from 'react';
import { diaryApi, integrationsApi, projectsApi, walkaroundApi, gatesApi } from '../lib/api';
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
  Printer,
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

const NZ_TIME_ZONE = 'Pacific/Auckland';

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getNzDateString = (offsetDays = 0) => {
  const date = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat('en-NZ', {
    timeZone: NZ_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const parseDateInput = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const DiaryPage = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [diary, setDiary] = useState(null);
  const [labourRows, setLabourRows] = useState([]);
  const [labourLoading, setLabourLoading] = useState(false);
  const [labourSaving, setLabourSaving] = useState(false);
  const [labourImporting, setLabourImporting] = useState(false);
  const [timesheetReferenceOptions, setTimesheetReferenceOptions] = useState({
    employees: [],
    project_managers: [],
    task_codes: [],
    lunch_options: ['0', '30', '60']
  });
  const [selectedDate, setSelectedDate] = useState(() => getNzDateString());
  const [loading, setLoading] = useState(true);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gates, setGates] = useState([]);
  const fileInputRef = useRef(null);
  const noteInputRef = useRef(null);

  const today = getNzDateString();
  const tomorrow = getNzDateString(1);

  const createEmptyLabourRow = () => ({
    employee_name: '',
    work_date: selectedDate,
    day: selectedDateLabel || '',
    start_time: '',
    finish_time: '',
    lunch_duration: '30',
    total_hours: 0,
    job_number: currentProject?.job_number || '',
    task_code: '',
    project_manager_id: '',
    description: '',
    other: '',
    source: 'LLD',
    source_diary_project_id: selectedProject || '',
    source_diary_date: selectedDate,
    sync_status: 'local_only'
  });

  const calculateLabourHours = (start, finish, lunchMinutes) => {
    if (!start || !finish) return 0;
    const startDate = new Date(`1970-01-01T${start}`);
    const finishDate = new Date(`1970-01-01T${finish}`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(finishDate.getTime())) return 0;
    const minutes = Math.max(0, (finishDate - startDate) / 60000);
    const lunch = parseFloat(lunchMinutes || 0) || 0;
    return Math.max(0, (minutes - lunch) / 60);
  };

  const updateLabourRow = (index, field, value) => {
    setLabourRows((current) => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const updated = { ...row, [field]: value };
      if (['start_time', 'finish_time', 'lunch_duration'].includes(field)) {
        updated.total_hours = calculateLabourHours(updated.start_time, updated.finish_time, updated.lunch_duration);
      }
      if (field === 'description') {
        updated.other = value;
      }
      return updated;
    }));
  };

  const addLabourRow = () => {
    setLabourRows((current) => [...current, createEmptyLabourRow()]);
  };

  const removeLabourRow = (index) => {
    setLabourRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  const labourTotalHours = labourRows.reduce((sum, row) => sum + (parseFloat(row.total_hours) || 0), 0);
  const getReferenceOptionText = (item, keys = []) => {
    if (item === null || item === undefined) return '';
    if (typeof item === 'string' || typeof item === 'number') return String(item);

    for (const key of keys) {
      const value = item?.[key];
      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value);
      }
    }

    return '';
  };

  const buildReferenceOptions = (items, currentValue, valueKeys = [], labelKeys = []) => {
    const seen = new Set();
    const options = (Array.isArray(items) ? items : [])
      .map((item) => {
        const value = getReferenceOptionText(item, valueKeys);
        const label = getReferenceOptionText(item, labelKeys) || value;
        return value ? { value, label } : null;
      })
      .filter((option) => {
        if (!option || seen.has(option.value)) return false;
        seen.add(option.value);
        return true;
      });

    const current = currentValue === null || currentValue === undefined ? '' : String(currentValue);
    if (current && !seen.has(current)) {
      options.unshift({ value: current, label: `${current} (saved)` });
    }

    return options;
  };

  const employeeOptionsForRow = (currentValue) => buildReferenceOptions(
    timesheetReferenceOptions.employees,
    currentValue,
    ['employee_name', 'name', 'full_name', 'display_name', 'email', 'id'],
    ['employee_name', 'name', 'full_name', 'display_name', 'email', 'id']
  );

  const taskCodeOptionsForRow = (currentValue) => buildReferenceOptions(
    timesheetReferenceOptions.task_codes,
    currentValue,
    ['task_code', 'code', 'value', 'name', 'id'],
    ['label', 'description', 'name', 'task_code', 'code', 'value', 'id']
  );

  const projectManagerOptionsForRow = (currentValue) => buildReferenceOptions(
    timesheetReferenceOptions.project_managers,
    currentValue,
    ['project_manager_id', 'id', 'employee_id', 'name', 'full_name', 'email'],
    ['name', 'full_name', 'employee_name', 'display_name', 'email', 'project_manager_id', 'id']
  );

  const lunchOptionsForRow = (currentValue) => {
    const configuredLunchOptions = Array.isArray(timesheetReferenceOptions.lunch_options) && timesheetReferenceOptions.lunch_options.length
      ? timesheetReferenceOptions.lunch_options
      : ['0', '30', '60'];

    return buildReferenceOptions(configuredLunchOptions, currentValue ?? '30');
  };

  const formatLunchLabel = (value) => {
    const minutes = String(value ?? '');
    if (minutes === '0') return 'No lunch';
    return minutes ? `${minutes}m` : 'Lunch';
  };
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

  const fetchTimesheetReferenceOptions = useCallback(async () => {
    try {
      const res = await integrationsApi.getTimesheetReferenceOptions();
      const data = res.data || {};

      setTimesheetReferenceOptions({
        employees: Array.isArray(data.employees) ? data.employees : [],
        project_managers: Array.isArray(data.project_managers) ? data.project_managers : [],
        task_codes: Array.isArray(data.task_codes) ? data.task_codes : [],
        lunch_options: Array.isArray(data.lunch_options) && data.lunch_options.length
          ? data.lunch_options
          : ['0', '30', '60']
      });
    } catch (error) {
      console.error('Failed to load Timesheet reference options:', error);
      setTimesheetReferenceOptions((current) => ({
        ...current,
        lunch_options: Array.isArray(current.lunch_options) && current.lunch_options.length
          ? current.lunch_options
          : ['0', '30', '60']
      }));
    }
  }, []);

  useEffect(() => {
    fetchTimesheetReferenceOptions();
  }, [fetchTimesheetReferenceOptions]);
  const fetchLabourRows = useCallback(async () => {
    if (!selectedProject || !selectedDate) {
      setLabourRows([]);
      return;
    }

    setLabourLoading(true);
    try {
      const res = await diaryApi.getLabour(selectedProject, selectedDate);
      const rows = Array.isArray(res.data?.rows) ? res.data.rows : [];
      setLabourRows(rows);
    } catch (error) {
      console.error('Failed to load labour rows:', error);
      setLabourRows([]);
    } finally {
      setLabourLoading(false);
    }
  }, [selectedProject, selectedDate]);

  const saveLabourRows = async () => {
    if (!selectedProject || !selectedDate) {
      toast.error('Select a project and date first');
      return;
    }

    setLabourSaving(true);
    try {
      const startedRows = labourRows
        .map((row, index) => ({ row, rowNumber: index + 1 }))
        .filter(({ row }) => [
          row.employee_name,
          row.start_time,
          row.finish_time,
          row.task_code,
          row.project_manager_id,
          row.description,
          row.other
        ].some((value) => String(value || '').trim()));

      const incompleteRow = startedRows.find(({ row }) => (
        !(row.employee_name || '').trim() ||
        !row.start_time ||
        !row.finish_time ||
        !(row.task_code || '').trim() ||
        !(row.project_manager_id || '').trim()
      ));

      if (incompleteRow) {
        toast.error(`Complete employee, start, finish, task code, and PM for staff row ${incompleteRow.rowNumber}`);
        return;
      }

      const invalidTimeRow = startedRows.find(({ row }) => {
        const start = new Date(`1970-01-01T${row.start_time}`);
        const finish = new Date(`1970-01-01T${row.finish_time}`);
        return !Number.isNaN(start.getTime()) && !Number.isNaN(finish.getTime()) && finish <= start;
      });

      if (invalidTimeRow) {
        toast.error(`Finish time must be after start time for staff row ${invalidTimeRow.rowNumber}`);
        return;
      }

      const cleanRows = startedRows
        .map(({ row }) => ({
          ...row,
          work_date: selectedDate,
          day: selectedDateLabel || '',
          job_number: row.job_number || currentProject?.job_number || '',
          source: 'LLD',
          source_diary_project_id: selectedProject,
          source_diary_date: selectedDate,
          sync_status: 'local_only',
          description: row.description || row.other || '',
          other: row.other || row.description || ''
        }));

      const res = await diaryApi.saveLabour(selectedProject, {
        date: selectedDate,
        rows: cleanRows
      });

      setLabourRows(Array.isArray(res.data?.rows) ? res.data.rows : []);
      toast.success('Labour rows saved locally in LLD');
      fetchDiary();
    fetchLabourRows();
    } catch (error) {
      console.error('Failed to save labour rows:', error);
      toast.error('Failed to save labour rows');
    } finally {
      setLabourSaving(false);
    }
  };

  const importLabourRowsToTimesheet = async () => {
    if (!selectedProject || !selectedDate) {
      toast.error('Select a project and date first');
      return;
    }

    if (!Array.isArray(labourRows) || labourRows.length === 0) {
      toast.error('Save at least one labour row before importing to Timesheet');
      return;
    }

    setLabourImporting(true);
    try {
      const res = await diaryApi.importLabourToTimesheet(selectedProject, {
        date: selectedDate
      });

      const result = res.data?.timesheet_result || {};
      const createdCount = Number(result.created_timesheet_count || 0);
      const entryCount = Number(result.created_entry_count || 0);
      const issueCount = Number(result.issue_count || 0);
      const skippedCount = Number(result.skipped_count || 0);

      if (createdCount > 0 || entryCount > 0) {
        toast.success(`Imported ${entryCount} labour row${entryCount === 1 ? '' : 's'} to Timesheet review`);
      } else if (skippedCount > 0 && issueCount === 0) {
        toast.info('No new Timesheet rows imported. Saved rows may already be imported.');
      } else if (issueCount > 0) {
        toast.warning(`Timesheet import returned ${issueCount} issue${issueCount === 1 ? '' : 's'}`);
      } else {
        toast.info('Timesheet import completed with no new rows created');
      }
    } catch (error) {
      console.error('Failed to import labour rows to Timesheet:', error);
      const detail = error?.response?.data?.detail;
      toast.error(detail || 'Failed to import labour rows to Timesheet');
    } finally {
      setLabourImporting(false);
    }
  };
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
    fetchLabourRows();
      fetchGates();
    }
  }, [selectedProject, selectedDate, fetchDiary, fetchLabourRows, fetchGates]);

  const changeDate = (days) => {
    const current = parseDateInput(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(formatDateInput(current));
  };

  const formatDate = (dateStr) => {
    return parseDateInput(dateStr).toLocaleDateString('en-NZ', {
      timeZone: NZ_TIME_ZONE,
      weekday: 'long',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const currentProject = projects.find((project) => project.id === selectedProject);
  const selectedDateLabel = formatDate(selectedDate);
  const hasDiaryContent = Boolean(
    diary && (
      (diary.summary?.entries_count || 0) > 0 ||
      (diary.summary?.items_opened || 0) > 0 ||
      (diary.summary?.items_closed || 0) > 0 ||
      (diary.summary?.blocked_gates || 0) > 0 ||
      (diary.summary?.overdue_items || 0) > 0
    )
  );

  const handlePrintReport = () => {
    if (!diary) {
      toast.error('Load a diary day before printing');
      return;
    }

    window.print();
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
    fetchLabourRows();
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
          <h2 className="font-heading text-4xl font-black uppercase tracking-[0.08em]" data-testid="daily-heading-polish-v1-marker">Daily Diary</h2>
          <p className="mt-1 text-base font-medium text-muted-foreground">
            Project summary by day{currentProject ? ` • ${currentProject.job_number ? `${currentProject.job_number} - ` : ''}${currentProject.name}` : ''}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrintReport}
            disabled={!diary}
            data-testid="daily-report-print-button"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Report
          </Button>

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
            <CardTitle className="font-heading text-base font-black uppercase tracking-[0.14em] flex items-center gap-2">
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

                {/* Roadblock / Concern Link */}
                {gates.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Link to Roadblock / Concern</Label>
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

      {/* Daily Report Readiness */}
      <Card className="ops-card" data-testid="daily-report-readiness">
        <CardContent className="py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-heading text-base font-black uppercase tracking-[0.14em]">Daily Report Ready</p>
              <p className="text-xs text-muted-foreground">
                {currentProject ? `${currentProject.job_number ? `${currentProject.job_number} - ` : ''}${currentProject.name}` : 'No project selected'} • {selectedDateLabel}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
              <span className="rounded border border-border bg-secondary/30 px-2 py-1">
                Entries: {diary?.summary?.entries_count || 0}
              </span>
              <span className="rounded border border-border bg-secondary/30 px-2 py-1">
                Opened: {diary?.summary?.items_opened || 0}
              </span>
              <span className="rounded border border-border bg-secondary/30 px-2 py-1">
                Closed: {diary?.summary?.items_closed || 0}
              </span>
              <span className="rounded border border-border bg-secondary/30 px-2 py-1">
                Blocked: {diary?.summary?.blocked_gates || 0}
              </span>
              <span className="rounded border border-border bg-secondary/30 px-2 py-1">
                Overdue: {diary?.summary?.overdue_items || 0}
              </span>
            </div>
          </div>

          {!hasDiaryContent && (
            <p className="mt-2 text-xs text-muted-foreground">
              No reportable activity for this day yet. Add a quick entry or review another date before issuing a report.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Date Navigation */}
      <Card className="ops-card">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} data-testid="prev-day">
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <div className="text-center">
              <p className="font-heading text-2xl font-black uppercase tracking-[0.08em]">{formatDate(selectedDate)}</p>
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
                <p className="text-3xl font-heading font-black">{diary.summary?.entries_count || 0}</p>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.16em]">Entries</p>
              </CardContent>
            </Card>

            <Card className="ops-card">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-3xl font-heading font-black">{diary.summary?.items_opened || 0}</p>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.16em]">Opened</p>
              </CardContent>
            </Card>

            <Card className="ops-card">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-3xl font-heading font-black text-emerald-500">{diary.summary?.items_closed || 0}</p>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.16em]">Closed</p>
              </CardContent>
            </Card>

            <Card className="ops-card">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-3xl font-heading font-black text-red-500">{diary.summary?.blocked_gates || 0}</p>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.16em]">Blocked</p>
              </CardContent>
            </Card>

            <Card className="ops-card">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-3xl font-heading font-black text-amber-500">{diary.summary?.at_risk_gates || 0}</p>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.16em]">At Risk</p>
              </CardContent>
            </Card>

            <Card className="ops-card">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-3xl font-heading font-black text-red-400">{diary.summary?.overdue_items || 0}</p>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.16em]">Overdue</p>
              </CardContent>
            </Card>
          </div>

          {/* Content Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="ops-card lg:col-span-2" data-testid="daily-labour-card">
          <CardHeader className="ops-card-header border-b border-border/70 bg-secondary/20 px-4 py-4 sm:px-6" data-testid="daily-labour-polish-v1-marker">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="font-heading text-xl font-black uppercase tracking-[0.14em]">Labour / Staff Onsite</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Timesheet-compatible daily rows. Save locally first, then manually import saved rows to Timesheet review when ready. Keep proving staff one at a time.
                </p>
              </div>
              <div className="inline-flex w-fit items-center rounded-full border border-border bg-background/70 px-3 py-1 text-sm font-semibold text-muted-foreground">
                <span data-testid="daily-labour-row-count">{labourRows.length}</span> rows •{' '}
                <span data-testid="daily-labour-total-hours">{labourTotalHours.toFixed(2)}</span> hrs
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 px-4 py-5 sm:px-6">
            {labourLoading ? (
              <p className="text-sm text-muted-foreground">Loading labour rows...</p>
            ) : labourRows.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-testid="daily-labour-empty">
                No staff rows recorded for this diary day yet.
              </div>
            ) : (
              <div className="space-y-4" data-testid="daily-labour-rows">
                {labourRows.map((row, index) => (
                  <div key={row.id || index} className="grid gap-3 rounded-2xl border border-border/70 bg-background/60 p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-6 xl:grid-cols-12">
                    <select
                      className="input min-h-11 sm:col-span-2 lg:col-span-3 xl:col-span-2"
                      value={row.employee_name || ''}
                      onChange={(e) => updateLabourRow(index, 'employee_name', e.target.value)}
                      data-testid={`daily-labour-employee-${index}`}
                    >
                      <option value="">Employee</option>
                      {employeeOptionsForRow(row.employee_name).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <input
                      className="input min-h-11 lg:col-span-2 xl:col-span-1"
                      type="time"
                      value={row.start_time || ''}
                      onChange={(e) => updateLabourRow(index, 'start_time', e.target.value)}
                      data-testid={`daily-labour-start-${index}`}
                    />
                    <select
                      className="input min-h-11 lg:col-span-2 xl:col-span-1"
                      value={String(row.lunch_duration ?? '30')}
                      onChange={(e) => updateLabourRow(index, 'lunch_duration', e.target.value)}
                      data-testid={`daily-labour-lunch-${index}`}
                    >
                      {lunchOptionsForRow(row.lunch_duration).map((option) => (
                        <option key={option.value} value={option.value}>{formatLunchLabel(option.value)}</option>
                      ))}
                    </select>
                    <input
                      className="input min-h-11 lg:col-span-2 xl:col-span-1"
                      type="time"
                      value={row.finish_time || ''}
                      onChange={(e) => updateLabourRow(index, 'finish_time', e.target.value)}
                      data-testid={`daily-labour-finish-${index}`}
                    />
                    <div className="flex min-h-11 items-center rounded-md border bg-secondary/40 px-3 py-2 text-sm font-bold lg:col-span-2 xl:col-span-1" data-testid={`daily-labour-hours-${index}`}>
                      {(parseFloat(row.total_hours) || 0).toFixed(2)}h
                    </div>
                    <input
                      className="input min-h-11 lg:col-span-2 xl:col-span-1"
                      placeholder="Job #"
                      value={row.job_number || ''}
                      onChange={(e) => updateLabourRow(index, 'job_number', e.target.value)}
                      data-testid={`daily-labour-job-${index}`}
                    />
                    <select
                      className="input min-h-11 lg:col-span-2 xl:col-span-1"
                      value={row.task_code || ''}
                      onChange={(e) => updateLabourRow(index, 'task_code', e.target.value)}
                      data-testid={`daily-labour-task-${index}`}
                    >
                      <option value="">Task code</option>
                      {taskCodeOptionsForRow(row.task_code).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <select
                      className="input min-h-11 lg:col-span-2 xl:col-span-1"
                      value={row.project_manager_id || ''}
                      onChange={(e) => updateLabourRow(index, 'project_manager_id', e.target.value)}
                      data-testid={`daily-labour-pm-${index}`}
                    >
                      <option value="">PM</option>
                      {projectManagerOptionsForRow(row.project_manager_id).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <input
                      className="input min-h-11 sm:col-span-2 lg:col-span-3 xl:col-span-2"
                      placeholder="Description / work done"
                      value={row.description || row.other || ''}
                      onChange={(e) => updateLabourRow(index, 'description', e.target.value)}
                      data-testid={`daily-labour-description-${index}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-11 justify-center sm:col-span-2 lg:col-span-2 xl:col-span-1"
                      onClick={() => removeLabourRow(index)}
                      data-testid={`daily-labour-remove-${index}`}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:flex-wrap">
              <Button type="button" variant="secondary" onClick={addLabourRow} data-testid="daily-labour-add-row">
                Add staff row
              </Button>
              <Button type="button" onClick={saveLabourRows} disabled={labourSaving || !selectedProject} data-testid="daily-labour-save">
                {labourSaving ? 'Saving...' : 'Save labour rows'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={importLabourRowsToTimesheet}
                disabled={labourImporting || labourSaving || labourLoading || !selectedProject || labourRows.length === 0}
                data-testid="daily-labour-import-timesheet"
              >
                {labourImporting ? 'Importing...' : 'Import saved rows to Timesheet review'}
              </Button>
            </div>

            <p className="rounded-lg border border-border/70 bg-secondary/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
              Fields match Timesheet Manager row shape: employee, start, lunch, finish, hours, job number, task code, PM, description. Timesheet import creates review records only; it does not approve payroll.
            </p>
          </CardContent>
        </Card>

        {/* Site Notes */}
            <Card className="ops-card">
              <CardHeader className="ops-card-header border-b border-border/70 bg-secondary/20 px-4 py-4">
                <CardTitle className="font-heading text-base font-black uppercase tracking-[0.14em] flex items-center gap-2">
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
              <CardHeader className="ops-card-header border-b border-border/70 bg-secondary/20 px-4 py-4">
                <CardTitle className="font-heading text-base font-black uppercase tracking-[0.14em] flex items-center gap-2">
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
              <CardHeader className="ops-card-header border-b border-border/70 bg-secondary/20 px-4 py-4">
                <CardTitle className="font-heading text-base font-black uppercase tracking-[0.14em] flex items-center gap-2 text-emerald-500">
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

            {/* Blocked Roadblocks / Concerns */}
            <Card className="ops-card">
              <CardHeader className="ops-card-header border-b border-border/70 bg-secondary/20 px-4 py-4">
                <CardTitle className="font-heading text-base font-black uppercase tracking-[0.14em] flex items-center gap-2 text-red-500">
                  <AlertTriangle className="w-4 h-4" />
                  Blocked / Delayed Roadblocks ({diary.blocked_gates?.length || 0})
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
                  <p className="text-sm text-muted-foreground text-center py-4">No blocked roadblocks</p>
                )}
              </CardContent>
            </Card>

            {/* Overdue Items */}
            <Card className="ops-card lg:col-span-2">
              <CardHeader className="ops-card-header border-b border-border/70 bg-secondary/20 px-4 py-4">
                <CardTitle className="font-heading text-base font-black uppercase tracking-[0.14em] flex items-center gap-2 text-red-400">
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
