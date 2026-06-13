import React, { useState, useEffect, useCallback, useRef } from 'react';
import { actionItemsApi, diaryApi, integrationsApi, projectsApi, walkaroundApi, gatesApi } from '../lib/api';
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
  ChevronUp,
  Package
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
  const [labourEditMode, setLabourEditMode] = useState(false);
  const [activeLabourIndex, setActiveLabourIndex] = useState(null);
  const [selectedStaffEmployeeValue, setSelectedStaffEmployeeValue] = useState('');
  const [showNewStaffForm, setShowNewStaffForm] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [siteResources, setSiteResources] = useState({ materials: [], plant_equipment: [] });
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesSaving, setResourcesSaving] = useState(false);
  const [resourcesEditMode, setResourcesEditMode] = useState(false);
  const [activeResourceTab, setActiveResourceTab] = useState('materials'); // diary-command-header-tabs-v2
  const [timesheetReferenceOptions, setTimesheetReferenceOptions] = useState({
    employees: [],
    project_managers: [],
    task_codes: [],
    lunch_options: ['0', '30', '60']
  });
  const [selectedDate, setSelectedDate] = useState(() => getNzDateString());
  const [loading, setLoading] = useState(true);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [selectedDiaryActionItem, setSelectedDiaryActionItem] = useState(null); // diary-action-inline-close-panel-v1
  const [selectedDiaryActionDraft, setSelectedDiaryActionDraft] = useState(null); // diary-inline-action-edit-panel-v1
  const [diaryActionSaving, setDiaryActionSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gates, setGates] = useState([]);
  const fileInputRef = useRef(null);
  const noteInputRef = useRef(null);
  const activeLabourEditorRef = useRef(null);
  const activeLabourNameInputRef = useRef(null);
  const labourDraftReadyRef = useRef('');
  const resourcesDraftReadyRef = useRef('');
  const quickEntryDraftReadyRef = useRef('');
  const [draftStatus, setDraftStatus] = useState('');

  const today = getNzDateString();
  const tomorrow = getNzDateString(1);

  const getDefaultProjectManagerId = () => {
    const projectManagers = Array.isArray(timesheetReferenceOptions.project_managers)
      ? timesheetReferenceOptions.project_managers
      : [];

    const davidOption = projectManagers.find((option) => {
      const text = `${option.label || ''} ${option.name || ''} ${option.email || ''} ${option.value || ''}`.toLowerCase();
      return text.includes('david') || text.includes('david.long') || text.includes('long');
    });

    return davidOption?.value || currentProject?.project_manager_id || projectManagers[0]?.value || '';
  };

  const createEmptyLabourRow = () => ({
    employee_name: '',
    work_date: selectedDate,
    day: selectedDateLabel || '',
    start_time: '', // diary-staff-manual-time-entry-v1
    finish_time: '',
    lunch_duration: '30',
    total_hours: 0,
    job_number: currentProject?.job_number || '',
    task_code: '',
    project_manager_id: '',
    description: '',
    other: '', // staff-diary-check-notes-v1
    source: 'LLD',
    source_diary_project_id: selectedProject || '',
    source_diary_date: selectedDate,
    sync_status: 'diary_check_only'
  });

  const normaliseTimeValue = (value) => {
    if (!value) return '';
    const text = String(value).trim();
    const match = text.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return '';
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  };

  const calculateLabourHours = (start, finish, lunchMinutes) => {
    const safeStart = normaliseTimeValue(start);
    const safeFinish = normaliseTimeValue(finish);
    if (!safeStart || !safeFinish) return 0;
    const startDate = new Date(`1970-01-01T${safeStart}:00`);
    const finishDate = new Date(`1970-01-01T${safeFinish}:00`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(finishDate.getTime())) return 0;
    const minutes = Math.max(0, (finishDate - startDate) / 60000);
    const lunch = parseFloat(lunchMinutes || 0) || 0;
    return Math.max(0, (minutes - lunch) / 60);
  };

  const normaliseLabourRow = (row = {}) => {
    const start_time = normaliseTimeValue(row.start_time);
    const finish_time = normaliseTimeValue(row.finish_time);
    const lunch_duration = String(row.lunch_duration ?? '30');
    return {
      ...row,
      start_time,
      finish_time,
      lunch_duration,
      total_hours: calculateLabourHours(start_time, finish_time, lunch_duration)
    };
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

  const openLabourEditor = (index) => {
    setActiveLabourIndex(index);
    setLabourEditMode(true);

    window.requestAnimationFrame(() => {
      activeLabourEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => {
        activeLabourNameInputRef.current?.focus();
      }, 150);
    });
  };

  const toggleLabourEditor = (index) => {
    if (labourEditMode && activeLabourIndex === index) {
      closeLabourEditor();
      return;
    }

    openLabourEditor(index);
  };

  const closeLabourEditor = () => {
    setActiveLabourIndex(null);
    setLabourEditMode(false); // diary-staff-timesheet-popout-editor-v1
  };

  const addLabourRow = () => {
    setLabourRows((current) => {
      const next = [...current, createEmptyLabourRow()];
      const nextIndex = next.length - 1;
      window.requestAnimationFrame(() => openLabourEditor(nextIndex)); // diary-staff-edit-focus-v2
      return next;
    });
  };

  const addStaffRowFromEmployee = (employeeOption) => {
    const staffName = String(
      employeeOption?.employee_name ||
      employeeOption?.display_name ||
      employeeOption?.label ||
      employeeOption?.name ||
      employeeOption?.value ||
      ''
    ).trim();

    if (!staffName) {
      toast.error('Select a staff member first');
      return;
    }

    setLabourRows((current) => [
      ...current,
      {
        ...createEmptyLabourRow(),
        employee_id: employeeOption.employee_id || '',
        employee_name: staffName,
        sync_status: employeeOption.linked_to_timesheet ? 'local_only' : 'local_pending_timesheet_staff'
      }
    ]);

    setActiveLabourIndex(null);
    setLabourEditMode(false);
  };

  const addSelectedStaffToDiary = () => {
    const employeeOption = resolveEmployeeSelection(selectedStaffEmployeeValue);
    if (!employeeOption) {
      toast.error('Select a staff member first');
      return;
    }

    addStaffRowFromEmployee(employeeOption);
    setSelectedStaffEmployeeValue('');
  };

  const addNewStaffToDiary = () => {
    const name = newStaffName.trim();
    if (!name) {
      toast.error('Enter the staff member name first');
      return;
    }

    addStaffRowFromEmployee({
      value: name,
      label: `${name} (manual diary staff)`,
      employee_id: '',
      employee_name: name,
      linked_to_timesheet: false
    });

    setNewStaffName('');
    setShowNewStaffForm(false);
    toast.info('Staff added to this diary check. Timesheet Manager stays separate.');
  };

  const updateLabourRowEmployee = (index, selectedValue) => {
    const employeeOption = resolveEmployeeSelection(selectedValue);
    if (!employeeOption) {
      updateLabourRow(index, 'employee_name', '');
      updateLabourRow(index, 'employee_id', '');
      return;
    }

    setLabourRows((current) => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      return normaliseLabourRow({
        ...row,
        employee_id: employeeOption.employee_id || '',
        employee_name: employeeOption.employee_name,
        sync_status: employeeOption.linked_to_timesheet ? (row.sync_status || 'local_only') : 'local_pending_timesheet_staff'
      });
    }));
  };

  const removeLabourRow = (index) => {
    setLabourRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setActiveLabourIndex(null);
  };

  const createEmptyResourceRow = () => ({
    item: '',
    supplier_or_reference: '',
    quantity: '',
    status: 'noted',
    notes: ''
  });

  const updateResourceRow = (category, index, field, value) => {
    setSiteResources((current) => {
      const rows = Array.isArray(current?.[category]) ? current[category] : [];
      return {
        ...current,
        [category]: rows.map((row, rowIndex) => (
          rowIndex === index ? { ...row, [field]: value } : row
        ))
      };
    });
  };

  const addResourceRow = (category) => {
    setSiteResources((current) => ({
      ...current,
      [category]: [...(Array.isArray(current?.[category]) ? current[category] : []), createEmptyResourceRow()]
    }));
    setResourcesEditMode(true);
  };

  const removeResourceRow = (category, index) => {
    setSiteResources((current) => ({
      ...current,
      [category]: (Array.isArray(current?.[category]) ? current[category] : []).filter((_, rowIndex) => rowIndex !== index)
    }));
  };

  const resourceMaterials = Array.isArray(siteResources?.materials) ? siteResources.materials : [];
  const resourcePlantEquipment = Array.isArray(siteResources?.plant_equipment) ? siteResources.plant_equipment : [];
  const resourcesTotalCount = resourceMaterials.length + resourcePlantEquipment.length;
  const toolTrackerUrl = process.env.REACT_APP_TOOL_TRACKER_URL || 'https://tool-tracker-enterprise.vercel.app';

  const getDiaryDraftKey = (section) => {
    if (!selectedProject || !selectedDate) return '';
    return `lld_diary_draft_${section}_${selectedProject}_${selectedDate}`;
  };

  const readDiaryDraft = (section) => {
    const key = getDiaryDraftKey(section);
    if (!key) return null;

    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn(`Failed to read ${section} diary draft`, error);
      return null;
    }
  };

  const writeDiaryDraft = (section, payload) => {
    const key = getDiaryDraftKey(section);
    if (!key) return;

    try {
      localStorage.setItem(key, JSON.stringify({
        ...payload,
        savedAt: new Date().toISOString(),
        projectId: selectedProject,
        date: selectedDate
      }));
      setDraftStatus('Draft autosaved on this device');
    } catch (error) {
      console.warn(`Failed to write ${section} diary draft`, error);
    }
  };

  const clearDiaryDraft = (section) => {
    const key = getDiaryDraftKey(section);
    if (!key) return;
    localStorage.removeItem(key);
  };

  const hasMeaningfulLabourRows = (rows = []) => rows.some((row) => [
    row.employee_name,
    row.start_time,
    row.finish_time,
    row.job_number,
    row.task_code,
    row.description,
    row.other
  ].some((value) => String(value || '').trim()));

  const hasMeaningfulResourceRows = (resources = {}) => [
    ...(Array.isArray(resources.materials) ? resources.materials : []),
    ...(Array.isArray(resources.plant_equipment) ? resources.plant_equipment : [])
  ].some((row) => [
    row.item,
    row.supplier_or_reference,
    row.quantity,
    row.status,
    row.notes
  ].some((value) => String(value || '').trim()));

  const scrollToSiteResources = (target = 'card') => {
    const targetId = target === 'materials'
      ? 'daily-site-resources-materials'
      : target === 'plant'
        ? 'daily-site-resources-plant'
        : 'daily-site-resources-card';

    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setResourcesEditMode(true);
  };

  const labourTotalHours = labourRows.reduce((sum, row) => sum + (parseFloat(row.total_hours) || 0), 0);
  const savedLabourEntries = labourRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row?.id);
  const activeLabourEntry = activeLabourIndex !== null && labourRows[activeLabourIndex]
    ? { row: labourRows[activeLabourIndex], index: activeLabourIndex }
    : null;

  const editableLabourEntries = activeLabourEntry ? [activeLabourEntry] : [];

  const formatTimeForDiary = (value) => {
    const time = normaliseTimeValue(value);
    if (!time) return '';
    const [hourText, minuteText] = time.split(':');
    const hour = parseInt(hourText, 10);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minuteText} ${suffix}`;
  };

  const formatStaffOnSiteLine = (row) => {
    const start = formatTimeForDiary(row.start_time) || 'Start';
    const finish = formatTimeForDiary(row.finish_time) || 'Finish';
    const job = row.job_number || currentProject?.job_number || 'Job #';
    const code = row.task_code || 'Code';
    const hours = `${(parseFloat(row.total_hours) || 0).toFixed(2)}h`;
    const hasNotes = Boolean(String(row.description || row.other || '').trim());
    return `${start} to ${finish} â€¢ ${job} â€¢ ${code} â€¢ ${hours}${hasNotes ? ' â€¢ Notes' : ''}`;
  };

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

  const isCommercialProjectOption = (project = {}) => {
    const status = String(project.status || '').trim().toLowerCase();
    const jobNumber = String(project.job_number || '').trim().toLowerCase();
    const name = String(project.name || project.project_name || '').trim().toLowerCase();
    const combined = `${jobNumber} ${name}`;

    if (status && !['active', 'open', 'current'].includes(status)) return false;
    if (combined.includes('demo')) return false;
    if (combined.includes('site coordination note')) return false;
    if (combined.includes('sample')) return false;
    if (combined.includes('test project')) return false;

    return true;
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

  const labourTimePresetOptions = [
    { value: '06:30', label: '6:30 AM' },
    { value: '07:00', label: '7:00 AM' },
    { value: '07:30', label: '7:30 AM' },
    { value: '08:00', label: '8:00 AM' },
    { value: '15:30', label: '3:30 PM' },
    { value: '16:00', label: '4:00 PM' },
    { value: '16:30', label: '4:30 PM' },
    { value: '17:00', label: '5:00 PM' },
    { value: '17:30', label: '5:30 PM' }
  ];

  const timeOptionsForRow = (currentValue) => buildReferenceOptions(
    labourTimePresetOptions,
    currentValue,
    ['value'],
    ['label', 'value']
  );

  const employeeOptionsForRow = (currentValue) => buildReferenceOptions(
    timesheetReferenceOptions.employees,
    currentValue,
    ['employee_name', 'name', 'full_name', 'display_name', 'email', 'id'],
    ['employee_name', 'name', 'full_name', 'display_name', 'email', 'id']
  );

  const employeePickerOptions = (currentValue = '') => {
    const sourceEmployees = Array.isArray(timesheetReferenceOptions.employees)
      ? timesheetReferenceOptions.employees
      : [];

    const options = [];
    const seen = new Set();

    sourceEmployees.forEach((employee) => {
      const employeeId = String(employee.employee_id || employee.id || employee.value || '').trim();
      const employeeName = String(
        employee.employee_name ||
        employee.name ||
        employee.full_name ||
        employee.display_name ||
        employee.label ||
        employee.email ||
        ''
      ).trim();
      const displayName = employeeName || employeeId;
      const value = employeeId || displayName;

      if (!value || seen.has(value)) return;

      seen.add(value);
      options.push({
        value,
        label: displayName,
        employee_id: employeeId,
        employee_name: displayName,
        display_name: displayName,
        linked_to_timesheet: Boolean(employeeId)
      });
    });

    const current = String(currentValue || '').trim();
    if (current && !seen.has(current)) {
      options.unshift({
        value: current,
        label: `${current} (pending Timesheet link)`,
        employee_id: '',
        employee_name: current,
        linked_to_timesheet: false
      });
    }

    return options;
  };

  const resolveEmployeeSelection = (value) => {
    const selectedValue = String(value || '').trim();
    if (!selectedValue) return null;

    const matchedOption = employeePickerOptions(selectedValue).find((option) => option.value === selectedValue);
    if (matchedOption) {
      const displayName = String(matchedOption.employee_name || matchedOption.label || matchedOption.display_name || selectedValue).trim();
      return {
        ...matchedOption,
        label: displayName,
        employee_name: displayName,
        display_name: displayName
      };
    }

    return {
      value: selectedValue,
      label: selectedValue,
      employee_id: '',
      employee_name: selectedValue,
      display_name: selectedValue,
      linked_to_timesheet: false
    };
  };

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

  const jobNumberOptionsForRow = (currentValue) => {
    const jobOptions = (Array.isArray(projects) ? projects : [])
      .filter((project) => project?.job_number)
      .map((project) => ({
        value: String(project.job_number),
        label: `${project.job_number}${project.name ? ` - ${project.name}` : ''}`
      }));

    return buildReferenceOptions(
      jobOptions,
      currentValue || currentProject?.job_number || '',
      ['value'],
      ['label', 'value']
    );
  };

  const lunchOptionsForRow = (currentValue) => {
    const configuredLunchOptions = Array.isArray(timesheetReferenceOptions.lunch_options)
      ? timesheetReferenceOptions.lunch_options
      : [];
    const safeLunchOptions = ['0', '30', '60', ...configuredLunchOptions]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean);

    return buildReferenceOptions(safeLunchOptions, currentValue ?? '30');
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
      const commercialItems = items.filter(isCommercialProjectOption);
      setProjects(commercialItems);
      if (commercialItems.length > 0) {
        const savedProject = localStorage.getItem('lld_last_project_id');
        if (savedProject && commercialItems.some(p => p.id === savedProject)) {
          setSelectedProject(savedProject);
        } else {
          setSelectedProject(commercialItems[0].id);
          localStorage.setItem('lld_last_project_id', commercialItems[0].id);
        }
      } else {
        setSelectedProject('');
        localStorage.removeItem('lld_last_project_id');
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
      labourDraftReadyRef.current = '';
      return;
    }

    const draftKey = getDiaryDraftKey('labour');
    setLabourLoading(true);
    try {
      const res = await diaryApi.getLabour(selectedProject, selectedDate);
      const rows = Array.isArray(res.data?.rows) ? res.data.rows : [];
      const draft = readDiaryDraft('labour');

      if (Array.isArray(draft?.rows) && hasMeaningfulLabourRows(draft.rows)) {
        setLabourRows(draft.rows.map(normaliseLabourRow));
        setLabourEditMode(true);
        setDraftStatus('Staff draft restored on this device');
      } else {
        setLabourRows(rows.map(normaliseLabourRow));
      }

      labourDraftReadyRef.current = draftKey;
    } catch (error) {
      console.error('Failed to load labour rows:', error);
      const draft = readDiaryDraft('labour');
      if (Array.isArray(draft?.rows) && hasMeaningfulLabourRows(draft.rows)) {
        setLabourRows(draft.rows.map(normaliseLabourRow));
        setLabourEditMode(true);
        setDraftStatus('Staff draft restored on this device');
      } else {
        setLabourRows([]);
      }
      labourDraftReadyRef.current = draftKey;
    } finally {
      setLabourLoading(false);
    }
  }, [selectedProject, selectedDate]);

  const fetchSiteResources = useCallback(async () => {
    if (!selectedProject || !selectedDate) {
      setSiteResources({ materials: [], plant_equipment: [] });
      resourcesDraftReadyRef.current = '';
      return;
    }

    const draftKey = getDiaryDraftKey('resources');
    setResourcesLoading(true);
    try {
      const res = await diaryApi.getResources(selectedProject, selectedDate);
      const serverResources = {
        materials: Array.isArray(res.data?.materials) ? res.data.materials : [],
        plant_equipment: Array.isArray(res.data?.plant_equipment) ? res.data.plant_equipment : []
      };
      const draft = readDiaryDraft('resources');

      if (draft?.resources && hasMeaningfulResourceRows(draft.resources)) {
        setSiteResources({
          materials: Array.isArray(draft.resources.materials) ? draft.resources.materials : [],
          plant_equipment: Array.isArray(draft.resources.plant_equipment) ? draft.resources.plant_equipment : []
        });
        setResourcesEditMode(true);
        setDraftStatus('Resources draft restored on this device');
      } else {
        setSiteResources(serverResources);
      }

      resourcesDraftReadyRef.current = draftKey;
    } catch (error) {
      console.error('Failed to load site resources:', error);
      const draft = readDiaryDraft('resources');
      if (draft?.resources && hasMeaningfulResourceRows(draft.resources)) {
        setSiteResources({
          materials: Array.isArray(draft.resources.materials) ? draft.resources.materials : [],
          plant_equipment: Array.isArray(draft.resources.plant_equipment) ? draft.resources.plant_equipment : []
        });
        setResourcesEditMode(true);
        setDraftStatus('Resources draft restored on this device');
      } else {
        setSiteResources({ materials: [], plant_equipment: [] });
      }
      resourcesDraftReadyRef.current = draftKey;
    } finally {
      setResourcesLoading(false);
    }
  }, [selectedProject, selectedDate]);

  const saveSiteResources = async () => {
    if (!selectedProject || !selectedDate) {
      toast.error('Select a project and date first');
      return;
    }

    setResourcesSaving(true);
    try {
      const cleanRows = (rows) => (Array.isArray(rows) ? rows : [])
        .filter((row) => String(row.item || '').trim())
        .map((row) => ({
          id: row.id,
          item: String(row.item || '').trim(),
          supplier_or_reference: String(row.supplier_or_reference || '').trim(),
          quantity: String(row.quantity || '').trim(),
          status: String(row.status || 'noted').trim(),
          notes: String(row.notes || '').trim()
        }));

      const res = await diaryApi.saveResources(selectedProject, {
        date: selectedDate,
        materials: cleanRows(resourceMaterials),
        plant_equipment: cleanRows(resourcePlantEquipment)
      });

      setSiteResources({
        materials: Array.isArray(res.data?.materials) ? res.data.materials : [],
        plant_equipment: Array.isArray(res.data?.plant_equipment) ? res.data.plant_equipment : []
      });
      clearDiaryDraft('resources');
      setDraftStatus('Resources saved to diary');
      setResourcesEditMode(false);
      toast.success('Site resources saved to diary');
      fetchDiary();
      fetchSiteResources();
    } catch (error) {
      console.error('Failed to save site resources:', error);
      toast.error('Failed to save site resources');
    } finally {
      setResourcesSaving(false);
    }
  };

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
          row.job_number,
          row.task_code,
          row.description,
          row.other
        ].some((value) => String(value || '').trim()));

      const incompleteRow = startedRows.find(({ row }) => !(row.employee_name || '').trim());

      if (incompleteRow) {
        toast.error(`Add staff name for diary check row ${incompleteRow.rowNumber}`);
        return;
      }

      const invalidTimeRow = startedRows.find(({ row }) => {
        if (!row.start_time || !row.finish_time) return false;
        const start = new Date(`1970-01-01T${row.start_time}`);
        const finish = new Date(`1970-01-01T${row.finish_time}`);
        return !Number.isNaN(start.getTime()) && !Number.isNaN(finish.getTime()) && finish <= start;
      });

      if (invalidTimeRow) {
        toast.error(`Finish time must be after start time for staff row ${invalidTimeRow.rowNumber}`);
        return;
      }

      const cleanRows = startedRows
        .map(({ row }) => normaliseLabourRow({
          ...row,
          work_date: selectedDate,
          day: selectedDateLabel || '',
          job_number: row.job_number || currentProject?.job_number || '',
          source: 'LLD',
          source_diary_project_id: selectedProject,
          source_diary_date: selectedDate,
  sync_status: 'diary_check_only',
  project_manager_id: '',
  description: row.description || row.other || '',
  other: row.other || row.description || ''
        }));

      const res = await diaryApi.saveLabour(selectedProject, {
        date: selectedDate,
        rows: cleanRows
      });

      setLabourRows(Array.isArray(res.data?.rows) ? res.data.rows.map(normaliseLabourRow) : []);
      clearDiaryDraft('labour');
      setDraftStatus('Staff saved to diary');
      closeLabourEditor();
      toast.success('Staff diary check saved');
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
        toast.success(`Imported ${entryCount} labour row${entryCount === 1 ? '' : 's'} to Timesheet Manager`);
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
      fetchSiteResources();
      fetchGates();

      const quickKey = getDiaryDraftKey('quick_entry');
      const draft = readDiaryDraft('quick_entry');
      if (draft?.entryData && String(draft.entryData.note || '').trim()) {
        setEntryData((current) => ({ ...current, ...draft.entryData }));
        setDraftStatus('Quick entry draft restored on this device');
      }
      quickEntryDraftReadyRef.current = quickKey;
    }
  }, [selectedProject, selectedDate, fetchDiary, fetchLabourRows, fetchSiteResources, fetchGates]);

  useEffect(() => {
    const key = getDiaryDraftKey('labour');
    if (!key || labourDraftReadyRef.current !== key || labourSaving || labourLoading) return;
    if (hasMeaningfulLabourRows(labourRows)) {
      writeDiaryDraft('labour', { rows: labourRows }); // diary-draft-autosave-v1-labour
    }
  }, [labourRows, selectedProject, selectedDate, labourSaving, labourLoading]);

  useEffect(() => {
    const key = getDiaryDraftKey('resources');
    if (!key || resourcesDraftReadyRef.current !== key || resourcesSaving || resourcesLoading) return;
    if (hasMeaningfulResourceRows(siteResources)) {
      writeDiaryDraft('resources', { resources: siteResources }); // diary-draft-autosave-v1-resources
    }
  }, [siteResources, selectedProject, selectedDate, resourcesSaving, resourcesLoading]);

  useEffect(() => {
    const key = getDiaryDraftKey('quick_entry');
    if (!key || quickEntryDraftReadyRef.current !== key || submitting) return;
    if (String(entryData.note || '').trim() || (Array.isArray(entryData.photos) && entryData.photos.length > 0)) {
      writeDiaryDraft('quick_entry', { entryData }); // diary-draft-autosave-v1-quick-entry
    }
  }, [entryData, selectedProject, selectedDate, submitting]);

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

  const openActionItems = Array.isArray(diary?.action_items_opened) ? diary.action_items_opened : [];
  const overdueDiaryItems = Array.isArray(diary?.overdue_items) ? diary.overdue_items : [];
  const forecastEndDate = (() => {
    const date = parseDateInput(selectedDate);
    date.setDate(date.getDate() + 21);
    return formatDateInput(date);
  })();

  const getItemDueDateKey = (item = {}) => String(item.due_date || item.expected_complete_date || '').slice(0, 10);
  const dueTodayItems = openActionItems.filter((item) => getItemDueDateKey(item) === selectedDate);
  const nextThreeWeeksItems = openActionItems.filter((item) => {
    const due = getItemDueDateKey(item);
    return due && due > selectedDate && due <= forecastEndDate;
  });

  const openDiarySection = (sectionId, tab = null) => {
    if (tab) setActiveResourceTab(tab);
    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const openActionItemsPage = (filter) => {
    const params = new URLSearchParams();
    if (selectedProject) params.set('project', selectedProject);
    if (filter) params.set('filter', filter);
    window.location.assign(`/action-items?${params.toString()}`);
  };

  const openRoadblockCreateFlow = () => {
    const params = new URLSearchParams();
    params.set('create', '1');
    if (selectedProject) params.set('project', selectedProject);
    window.location.assign(`/roadblocks?${params.toString()}`); // diary-direct-roadblock-create-v1
  };

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
      clearDiaryDraft('quick_entry');
      setDraftStatus('Diary entry saved');
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

  const diaryPriorityRank = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    deferred: 4
  }; // priority-sort-clickthrough-v2

  const getDiaryPriorityRank = (priority) => diaryPriorityRank[String(priority || '').trim().toLowerCase()] ?? 99;

  const getDiaryDateRank = (value, fallback = Number.MAX_SAFE_INTEGER) => {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.getTime();
  };

  const sortDiaryPriorityFirst = (items = []) => {
    return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
      const priorityDiff = getDiaryPriorityRank(a.priority) - getDiaryPriorityRank(b.priority);
      if (priorityDiff !== 0) return priorityDiff;

      const dueDiff = getDiaryDateRank(a.due_date || a.expected_complete_date) - getDiaryDateRank(b.due_date || b.expected_complete_date);
      if (dueDiff !== 0) return dueDiff;

      return getDiaryDateRank(b.created_at, 0) - getDiaryDateRank(a.created_at, 0);
    });
  };

  const normaliseDiaryActionDraft = (item = {}) => ({
    title: item.title || item.task_name || item.name || '',
    description: item.description || item.note || item.details || '',
    priority: String(item.priority || 'medium').toLowerCase(),
    status: String(item.status || 'open').toLowerCase(),
    due_date: String(item.due_date || '').slice(0, 10),
    expected_complete_date: String(item.expected_complete_date || '').slice(0, 10),
    owner: item.owner || ''
  });

  const openDiaryActionItem = (item) => {
    if (!item?.id) return;

    if (selectedDiaryActionItem?.id === item.id) {
      closeDiaryActionItem();
      return;
    }

    setSelectedDiaryActionItem(item);
    setSelectedDiaryActionDraft(normaliseDiaryActionDraft(item));

    window.requestAnimationFrame(() => {
      document.getElementById('diary-action-detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }; // diary-action-inline-close-panel-v1

  const updateSelectedDiaryActionDraft = (field, value) => {
    setSelectedDiaryActionDraft((current) => ({
      ...(current || normaliseDiaryActionDraft(selectedDiaryActionItem || {})),
      [field]: value
    }));
  };

  const saveSelectedDiaryActionItem = async () => {
    if (!selectedDiaryActionItem?.id || !selectedDiaryActionDraft) return;

    const title = String(selectedDiaryActionDraft.title || '').trim();
    if (!title) {
      toast.error('Action item title is required');
      return;
    }

    setDiaryActionSaving(true);
    try {
      const payload = {
        project_id: selectedDiaryActionItem.project_id || selectedDiaryActionItem.job_id || selectedProject,
        title,
        description: String(selectedDiaryActionDraft.description || '').trim(),
        priority: selectedDiaryActionDraft.priority || 'medium',
        status: selectedDiaryActionDraft.status || 'open',
        due_date: selectedDiaryActionDraft.due_date || null,
        expected_complete_date: selectedDiaryActionDraft.expected_complete_date || null,
        owner: String(selectedDiaryActionDraft.owner || '').trim()
      };

      const res = await actionItemsApi.update(selectedDiaryActionItem.id, payload);
      const updated = res.data || { ...selectedDiaryActionItem, ...payload };

      setSelectedDiaryActionItem(updated);
      setSelectedDiaryActionDraft(normaliseDiaryActionDraft(updated));
      toast.success('Follow-up updated');
      fetchDiary();
    } catch (error) {
      console.error('Failed to update diary follow-up:', error);
      toast.error('Failed to update follow-up');
    } finally {
      setDiaryActionSaving(false);
    }
  };

  const completeSelectedDiaryActionItem = async () => {
    if (!selectedDiaryActionItem?.id) return;

    setDiaryActionSaving(true);
    try {
      await actionItemsApi.complete(selectedDiaryActionItem.id);
      toast.success('Follow-up marked complete');
      setSelectedDiaryActionItem(null);
      setSelectedDiaryActionDraft(null);
      fetchDiary();
    } catch (error) {
      console.error('Failed to complete diary follow-up:', error);
      toast.error('Failed to complete follow-up');
    } finally {
      setDiaryActionSaving(false);
    }
  };

  const reopenSelectedDiaryActionItem = async () => {
    if (!selectedDiaryActionItem?.id) return;

    setDiaryActionSaving(true);
    try {
      await actionItemsApi.reopen(selectedDiaryActionItem.id);
      toast.success('Follow-up reopened');
      fetchDiary();
      setSelectedDiaryActionItem((current) => current ? { ...current, status: 'open' } : current);
      setSelectedDiaryActionDraft((current) => current ? { ...current, status: 'open' } : current);
    } catch (error) {
      console.error('Failed to reopen diary follow-up:', error);
      toast.error('Failed to reopen follow-up');
    } finally {
      setDiaryActionSaving(false);
    }
  };

  const closeDiaryActionItem = () => {
    setSelectedDiaryActionItem(null);
    setSelectedDiaryActionDraft(null);
    window.requestAnimationFrame(() => {
      document.getElementById('daily-report-readiness')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }; // diary-inline-action-edit-panel-v1

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
      <div className="rounded-2xl border border-border bg-card/95 p-3 shadow-sm sm:p-4" data-testid="diary-command-header-v2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">Daily Diary</p>
            <h2 className="font-heading text-2xl font-black uppercase tracking-[0.08em] sm:text-3xl" data-testid="daily-heading-polish-v1-marker">
              {selectedDateLabel}
            </h2>
            <p className="mt-1 truncate text-sm font-semibold text-muted-foreground">
              {currentProject ? `${currentProject.job_number ? `${currentProject.job_number} - ` : ''}${currentProject.name}` : 'No project selected'}
              {selectedDate === today ? ' â€¢ Today' : ''}
              {draftStatus ? ` â€¢ ${draftStatus}` : ''}
            </p>
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 lg:flex lg:w-auto">
            <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} data-testid="prev-day">
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <Select value={selectedProject} onValueChange={(val) => {
              setSelectedProject(val);
              localStorage.setItem('lld_last_project_id', val);
            }}>
              <SelectTrigger className="w-full min-w-0 lg:w-[240px]" data-testid="diary-project-select">
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

          <div className="flex flex-wrap gap-2">
            {selectedDate === today && (
              <Button onClick={() => setShowQuickEntry(!showQuickEntry)} data-testid="quick-entry-btn">
                <Plus className="w-4 h-4 mr-2" />
                Quick Entry
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handlePrintReport}
              disabled={!diary}
              data-testid="daily-report-print-button"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
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

      {/* Diary Command Strip / Clickable Checklist - diary-command-header-tabs-v2 */}
      <Card className="ops-card" data-testid="daily-report-readiness">
        <CardContent className="space-y-3 py-3" data-testid="diary-mobile-compression-v5">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5" data-testid="diary-attention-strip-v2">
            <button
              type="button"
              onClick={() => openDiarySection('diary-overdue-followups')}
              className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-left transition hover:bg-red-500/15"
              data-testid="diary-command-overdue"
            >
              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-red-400">Overdue</span>
              <span className="block text-xl font-black">{overdueDiaryItems.length}</span>
            </button>
            <button
              type="button"
              onClick={() => openDiarySection('diary-due-today-section')}
              className="rounded-xl border border-orange-400/35 bg-orange-500/10 px-3 py-2 text-left transition hover:bg-orange-500/15"
              data-testid="diary-command-due-today"
            >
              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-orange-400">Due Today</span>
              <span className="block text-xl font-black">{dueTodayItems.length}</span>
            </button>
            <button
              type="button"
              onClick={() => openDiarySection('diary-action-open-section')}
              className="rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 text-left transition hover:bg-primary/15"
              data-testid="diary-command-forecast"
            >
              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-primary">Next 2â€“3 Weeks</span>
              <span className="block text-xl font-black">{nextThreeWeeksItems.length}</span>
            </button>
            <button
              type="button"
              onClick={openRoadblockCreateFlow}
              className="rounded-xl border border-red-500/35 bg-secondary/30 px-3 py-2 text-left transition hover:bg-secondary/45"
              data-testid="diary-command-roadblocks-create"
            >
              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-red-400">Roadblocks</span>
              <span className="block text-xl font-black">{diary?.summary?.blocked_gates || 0}</span>
            </button>
            <button
              type="button"
              onClick={() => openDiarySection('diary-queries-section')}
              className="rounded-xl border border-sky-400/35 bg-sky-500/10 px-3 py-2 text-left transition hover:bg-sky-500/15"
              data-testid="diary-command-queries-rfis"
            >
              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-sky-500">Queries / RFIs</span>
              <span className="block text-xl font-black">0</span>
            </button>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <div>
                <p className="font-heading text-sm font-black uppercase tracking-[0.14em]">Today's Diary Checklist</p>
                <p className="text-xs text-muted-foreground">Tap a label to jump to that part of the diary.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-4 lg:grid-cols-8" data-testid="diary-clickable-checklist-v2">
              <button type="button" onClick={() => openDiarySection('diary-roadblocks-section')} className="rounded border border-border bg-secondary/30 px-2 py-1 text-left font-semibold hover:bg-secondary/50">
                Roadblocks: {diary?.summary?.blocked_gates || 0}
              </button>
              <button type="button" onClick={() => openDiarySection('diary-staff-section')} className="rounded border border-border bg-secondary/30 px-2 py-1 text-left font-semibold hover:bg-secondary/50">
                Staff: {labourRows.length}
              </button>
              <button type="button" onClick={() => openDiarySection('diary-work-section')} className="rounded border border-border bg-secondary/30 px-2 py-1 text-left font-semibold hover:bg-secondary/50">
                Work: {diary?.summary?.entries_count || 0}
              </button>
              <button type="button" onClick={() => openDiarySection('diary-resources-section', 'materials')} className="rounded border border-border bg-secondary/30 px-2 py-1 text-left font-semibold hover:bg-secondary/50">
                Materials: {resourceMaterials.length}
              </button>
              <button type="button" onClick={() => openDiarySection('diary-resources-section', 'plant_equipment')} className="rounded border border-border bg-secondary/30 px-2 py-1 text-left font-semibold hover:bg-secondary/50">
                Plant: {resourcePlantEquipment.length}
              </button>
              <button type="button" onClick={() => openDiarySection('diary-queries-section')} className="rounded border border-border bg-secondary/30 px-2 py-1 text-left font-semibold hover:bg-secondary/50" data-testid="diary-checklist-queries-rfis">
                Queries/RFIs: 0
              </button>
              <button type="button" onClick={() => openDiarySection('diary-action-open-section')} className="rounded border border-border bg-secondary/30 px-2 py-1 text-left font-semibold hover:bg-secondary/50">
                Follow-ups: {diary?.summary?.items_opened || 0}
              </button>
              <button type="button" onClick={() => openDiarySection('diary-action-completed-section')} className="rounded border border-border bg-secondary/30 px-2 py-1 text-left font-semibold hover:bg-secondary/50">
                Completed: {diary?.summary?.items_closed || 0}
              </button>
            </div>
          </div>

          {!hasDiaryContent && (
            <p className="text-xs text-muted-foreground">
              No reportable activity for this day yet. Add a quick entry or review another date before issuing a report.
            </p>
          )}
        </CardContent>
      </Card>

      {selectedDiaryActionItem && selectedDiaryActionDraft && (
        <Card id="diary-action-detail-panel" className="ops-card border-primary/60 bg-card shadow-lg" data-testid="diary-inline-action-edit-panel-v1">
          <CardHeader className="ops-card-header border-b border-primary/25 bg-primary/10 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Edit Follow-up In Diary</p>
                <CardTitle className="mt-1 font-heading text-base font-black uppercase tracking-[0.12em]">
                  {selectedDiaryActionDraft.title || 'Untitled action item'}
                </CardTitle>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  Stay in the Diary. Edit, save, complete, reopen, or close from this panel.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={closeDiaryActionItem} disabled={diaryActionSaving} data-testid="diary-action-close-inline">
                  Close
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 px-4 py-4">
            <div className="grid gap-3 lg:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Title</span>
                <Input
                  className="min-h-11 border-primary/45 bg-background text-foreground shadow-inner"
                  value={selectedDiaryActionDraft.title}
                  onChange={(e) => updateSelectedDiaryActionDraft('title', e.target.value)}
                  data-testid="diary-action-title-input"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Owner</span>
                <Input
                  className="min-h-11 border-primary/45 bg-background text-foreground shadow-inner"
                  value={selectedDiaryActionDraft.owner}
                  onChange={(e) => updateSelectedDiaryActionDraft('owner', e.target.value)}
                  placeholder="Responsible person"
                  data-testid="diary-action-owner-input"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Priority</span>
                <select
                  className="input min-h-11 w-full border-primary/45 bg-background text-foreground shadow-inner"
                  value={selectedDiaryActionDraft.priority}
                  onChange={(e) => updateSelectedDiaryActionDraft('priority', e.target.value)}
                  data-testid="diary-action-priority-select"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="deferred">Deferred</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Status</span>
                <select
                  className="input min-h-11 w-full border-primary/45 bg-background text-foreground shadow-inner"
                  value={selectedDiaryActionDraft.status}
                  onChange={(e) => updateSelectedDiaryActionDraft('status', e.target.value)}
                  data-testid="diary-action-status-select"
                >
                  <option value="open">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="completed">Complete</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Due</span>
                <Input
                  type="date"
                  className="min-h-11 border-primary/45 bg-background text-foreground shadow-inner"
                  value={selectedDiaryActionDraft.due_date}
                  onChange={(e) => updateSelectedDiaryActionDraft('due_date', e.target.value)}
                  data-testid="diary-action-due-date-input"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Expected Complete</span>
                <Input
                  type="date"
                  className="min-h-11 border-primary/45 bg-background text-foreground shadow-inner"
                  value={selectedDiaryActionDraft.expected_complete_date}
                  onChange={(e) => updateSelectedDiaryActionDraft('expected_complete_date', e.target.value)}
                  data-testid="diary-action-expected-date-input"
                />
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Details</span>
              <Textarea
                className="min-h-[90px] border-primary/45 bg-background text-foreground shadow-inner"
                value={selectedDiaryActionDraft.description}
                onChange={(e) => updateSelectedDiaryActionDraft('description', e.target.value)}
                placeholder="Notes, instruction, required response, or site detail..."
                data-testid="diary-action-description-input"
              />
            </label>

            <div className="flex flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row sm:flex-wrap">
              <Button type="button" className="btn-primary" onClick={saveSelectedDiaryActionItem} disabled={diaryActionSaving} data-testid="diary-action-save-inline">
                {diaryActionSaving ? 'Saving...' : 'Save Follow-up'}
              </Button>
              <Button type="button" variant="outline" onClick={completeSelectedDiaryActionItem} disabled={diaryActionSaving} data-testid="diary-action-complete-inline">
                Mark Complete
              </Button>
              <Button type="button" variant="outline" onClick={reopenSelectedDiaryActionItem} disabled={diaryActionSaving} data-testid="diary-action-reopen-inline">
                Reopen
              </Button>
              <Button type="button" variant="secondary" onClick={closeDiaryActionItem} disabled={diaryActionSaving}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {draftStatus && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary" data-testid="diary-draft-autosave-v1-status">
          {draftStatus}
        </div>
      )}

      {diary && (
        <>
          {/* Content Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Roadblocks / Critical Site Issues - diary-field-sheet-layout-v1 */}
            <Card id="diary-roadblocks-section" className="ops-card">
              <CardHeader className="ops-card-header border-b border-border/70 bg-secondary/20 px-3 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="font-heading text-base font-black uppercase tracking-[0.14em] flex items-center gap-2 text-red-500">
                      <AlertTriangle className="w-4 h-4" />
                      Roadblocks / Critical Site Issues ({diary.blocked_gates?.length || 0})
                    </CardTitle>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">Check blockers first. If nothing is stopping progress, keep moving through the diary.</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={openRoadblockCreateFlow}
                    data-testid="diary-add-roadblock-direct"
                  >
                    Add Roadblock / Concern
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="py-3 max-h-80 overflow-y-auto">
                {diary.blocked_gates?.length > 0 ? (
                  <div className="space-y-2">
                    {diary.blocked_gates.map((gate) => (
                      <div key={gate.id} className="p-2 bg-red-950/30 rounded-md border-l-4 border-l-red-500">
                        <p className="text-sm font-medium">{gate.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Owner: {gate.owner_party} â€¢ Required:{' '}
                          {new Date(gate.required_by_date).toLocaleDateString('en-NZ', {
                            day: '2-digit',
                            month: 'short'
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">No roadblocks recorded for this diary day.</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={openRoadblockCreateFlow}
                      data-testid="diary-add-roadblock-empty"
                    >
                      Add Roadblock / Concern
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Overdue Follow-ups - moved into critical hierarchy - diary-critical-hierarchy-staff-compact-v1 */}
            <Card id="diary-overdue-followups" className="ops-card" data-testid="diary-overdue-top-section">
              <CardHeader className="ops-card-header border-b border-border/70 bg-secondary/20 px-4 py-4">
                <CardTitle className="font-heading text-base font-black uppercase tracking-[0.14em] flex items-center gap-2 text-red-400">
                  <Target className="w-4 h-4" />
                  Overdue Follow-ups ({diary.overdue_items?.length || 0})
                </CardTitle>
              </CardHeader>

              <CardContent className="py-3">
                {diary.overdue_items?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {sortDiaryPriorityFirst(diary.overdue_items).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openDiaryActionItem(item)}
                        className={`w-full p-2 rounded-md border-l-4 text-left transition ${selectedDiaryActionItem?.id === item.id ? 'border-l-red-300 bg-red-500/20 ring-2 ring-red-400/30' : 'border-l-red-400 bg-red-950/20 hover:border-red-400/70 hover:bg-red-500/10'}`}
                        data-testid={`diary-overdue-clickthrough-${item.id}`}
                      >
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
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No overdue follow-ups</p>
                )}
              </CardContent>
            </Card>


            {/* Due Today Follow-ups - diary-critical-hierarchy-staff-compact-v1 */}
            <Card id="diary-due-today-section" className="ops-card" data-testid="diary-due-today-section">
              <CardHeader className="ops-card-header border-b border-border/70 bg-secondary/20 px-4 py-4">
                <CardTitle className="font-heading text-base font-black uppercase tracking-[0.14em] flex items-center gap-2 text-orange-500">
                  <Target className="w-4 h-4" />
                  Due Today ({dueTodayItems.length})
                </CardTitle>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Follow-ups due today. Critical and high priority stay at the top.</p>
              </CardHeader>

              <CardContent className="py-3">
                {dueTodayItems.length > 0 ? (
                  <div className="space-y-2">
                    {sortDiaryPriorityFirst(dueTodayItems).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openDiaryActionItem(item)}
                        className={`w-full p-2 rounded-md border-l-4 text-left transition ${selectedDiaryActionItem?.id === item.id ? 'border-l-orange-300 bg-orange-500/20 ring-2 ring-orange-400/30' : 'border-l-orange-400 bg-orange-500/10 hover:border-orange-400/70 hover:bg-orange-500/15'}`}
                        data-testid={`diary-due-today-clickthrough-${item.id}`}
                      >
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {[item.project_name || item.project?.name, item.owner, item.priority].filter(Boolean).join(' â€¢ ')}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Nothing due today</p>
                )}
              </CardContent>
            </Card>

            {/* Queries / RFIs - diary-critical-hierarchy-staff-compact-v1 */}
            <Card id="diary-queries-section" className="ops-card" data-testid="diary-queries-rfis-section">
              <CardHeader className="ops-card-header border-b border-border/70 bg-secondary/20 px-4 py-4">
                <CardTitle className="font-heading text-base font-black uppercase tracking-[0.14em] flex items-center gap-2 text-sky-500">
                  <ListTodo className="w-4 h-4" />
                  Queries / RFIs (0)
                </CardTitle>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Questions needing answers. Keep these separate from roadblocks until they start blocking work.</p>
              </CardHeader>

              <CardContent className="py-3">
                <div className="rounded-lg border border-dashed border-sky-400/35 bg-sky-500/10 px-3 py-3 text-sm text-muted-foreground">
                  No Queries / RFIs recorded for this diary day yet. Next feature: raise a query, assign it, set answer required date, then convert to Roadblock if it blocks work.
                </div>
              </CardContent>
            </Card>

            <Card id="diary-staff-section" className="ops-card" data-testid="daily-labour-card">
          <CardHeader className="ops-card-header border-b border-border/70 bg-secondary/20 px-3 py-2 sm:px-4" data-testid="daily-labour-polish-v1-marker">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="font-heading text-base font-black uppercase tracking-[0.14em]">Staff on Site</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Diary check only. Staff complete and sign timesheets separately in Timesheet Manager.
                </p>
              </div>
              <div className="inline-flex w-fit items-center rounded-full border border-border bg-background/70 px-3 py-1 text-sm font-semibold text-muted-foreground">
                <span data-testid="daily-labour-row-count">{labourRows.length}</span> staff â€¢{' '}
                <span data-testid="daily-labour-total-hours">{labourTotalHours.toFixed(2)}</span> check hrs
              </div>
            </div>
          </CardHeader>
          <CardContent className="max-h-[34rem] space-y-3 overflow-y-auto px-3 py-3 sm:px-4" data-testid="diary-staff-compact-panel-v1">
            {labourLoading ? (
              <p className="text-sm text-muted-foreground">Loading staff...</p>
            ) : (
              <div className="space-y-2" data-testid="daily-labour-rows">
                <div
                  className="rounded-xl border border-primary/40 bg-primary/5 p-2"
                  data-testid="staff-diary-check-picker-v1"
                  onClick={(event) => {
                    if (event.target === event.currentTarget) {
                      setActiveLabourIndex(null);
                      setLabourEditMode(false); // staff-name-resolve-click-away-v1
                    }
                  }}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Staff on Site</p>
                      <p className="text-xs font-bold text-muted-foreground">{labourRows.length} staff - {labourTotalHours.toFixed(2)}h total</p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" data-testid="staff-timesheet-picker">
                    <select
                      className="input min-h-11 w-full min-w-0"
                      value={selectedStaffEmployeeValue}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedStaffEmployeeValue(value);
                        const employeeOption = resolveEmployeeSelection(value);
                        if (employeeOption) {
                          addStaffRowFromEmployee(employeeOption); // staff-dropdown-simple-tap-add-v2
                          window.requestAnimationFrame(() => setSelectedStaffEmployeeValue(''));
                        }
                      }}
                      data-testid="staff-timesheet-employee-select"
                    >
                      <option value="">Tap staff name to add to diary</option>
                      {employeePickerOptions().map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <Button type="button" variant="outline" onClick={() => setShowNewStaffForm((value) => !value)} data-testid="staff-timesheet-add-new-toggle">
                      + Add new staff
                    </Button>
                  </div>

                  {showNewStaffForm && (
                    <div className="mt-3 rounded-lg border border-dashed border-primary/50 bg-background/70 p-3" data-testid="staff-timesheet-add-new-form">
                      <p className="mb-2 text-xs font-bold text-muted-foreground">
                        Use this only if the person is not in the dropdown yet. They will be added to today's diary and can be linked in Timesheet Manager later.
                      </p>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <input
                          className="input min-h-11 w-full min-w-0"
                          placeholder="New staff member name"
                          value={newStaffName}
                          onChange={(e) => setNewStaffName(e.target.value)}
                          data-testid="staff-timesheet-new-name"
                        />
                        <Button type="button" onClick={addNewStaffToDiary} disabled={!newStaffName.trim()} data-testid="staff-timesheet-add-new-confirm">
                          Add new staff
                        </Button>
                      </div>
                    </div>
                  )}

                  {labourRows.length === 0 ? (
                    <div className="mt-3 rounded-lg border border-dashed border-border/70 bg-background/60 px-3 py-4 text-sm font-semibold text-muted-foreground" data-testid="staff-timesheet-empty">
                      Tap a staff name above to start today's compact Staff on Site list.
                    </div>
                  ) : (
                    <div className="mt-2 grid max-h-56 gap-1.5 overflow-y-auto pr-1" data-testid="staff-timesheet-selected-list">
                      {labourRows.map((row, index) => (
                        <button
                          key={row.id || index}
                          type="button"
                          className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
                            activeLabourIndex === index
                              ? 'border-primary bg-primary/10'
                              : 'border-border/60 bg-background/70 hover:border-primary/50 hover:bg-primary/5'
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleLabourEditor(index);
                          }}
                          data-testid={`staff-on-site-name-${index}`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-black">{row.employee_name || 'Staff member'}</span>
                            <span className="block truncate text-xs font-semibold text-muted-foreground">
                              {formatStaffOnSiteLine(row)}
                            </span>
                          </span>
                          <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.14em] text-primary">Edit</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {editableLabourEntries.map(({ row, index }) => (
                  <div
                    key={row.id || index}
                    ref={activeLabourEditorRef}
                    className="fixed inset-x-2 bottom-3 z-40 max-h-[88vh] overflow-y-auto rounded-2xl border border-primary/70 bg-card p-3 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(760px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:p-4"
                    data-testid="diary-staff-timesheet-popout-editor-v1"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3 border-b border-primary/25 pb-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Staff Diary Check</p>
                        <h3 className="truncate font-heading text-base font-black uppercase tracking-[0.10em]">
                          {row.employee_name || 'Staff member'}
                        </h3>
                        <p className="text-xs font-semibold text-muted-foreground">
                          Name, start, finish, job, code, hours and staff-specific notes only.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={closeLabourEditor}
                        data-testid="diary-staff-popout-close"
                      >
                        Close
                      </Button>
                    </div>

                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="space-y-1 sm:col-span-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Staff member</span>
                        <select
                          ref={activeLabourNameInputRef}
                          className="input lld-daily-labour-control min-h-11 w-full min-w-0 border-primary/45 bg-background text-foreground shadow-inner"
                          value={row.employee_id || row.employee_name || ''}
                          onChange={(e) => updateLabourRowEmployee(index, e.target.value)}
                          data-testid={`daily-labour-employee-${index}`}
                        >
                          <option value="">Staff member</option>
                          {employeePickerOptions(row.employee_id || row.employee_name).map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Start</span>
                        <select
                          className="input lld-daily-labour-control min-h-11 w-full min-w-0 border-primary/45 bg-background text-foreground shadow-inner"
                          value={row.start_time || ''}
                          onChange={(e) => updateLabourRow(index, 'start_time', e.target.value)}
                          data-testid={`daily-labour-start-${index}`}
                        >
                          <option value="">Start</option>
                          {timeOptionsForRow(row.start_time).map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Finish</span>
                        <select
                          className="input lld-daily-labour-control min-h-11 w-full min-w-0 border-primary/45 bg-background text-foreground shadow-inner"
                          value={row.finish_time || ''}
                          onChange={(e) => updateLabourRow(index, 'finish_time', e.target.value)}
                          data-testid={`daily-labour-finish-${index}`}
                        >
                          <option value="">Finish</option>
                          {timeOptionsForRow(row.finish_time).map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>

                      <div className="space-y-1">
                        <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Hours</span>
                        <div className="lld-daily-labour-hours flex min-h-11 w-full min-w-0 items-center rounded-md border border-primary/35 bg-secondary/40 px-3 py-2 text-sm font-black" data-testid={`daily-labour-hours-${index}`}>
                          {(parseFloat(row.total_hours) || 0).toFixed(2)}h
                        </div>
                      </div>

                      <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Job #</span>
                        <select
                          className="input lld-daily-labour-control min-h-11 w-full min-w-0 border-primary/45 bg-background text-foreground shadow-inner"
                          value={row.job_number || currentProject?.job_number || ''}
                          onChange={(e) => updateLabourRow(index, 'job_number', e.target.value)}
                          data-testid={`daily-labour-job-${index}`}
                        >
                          <option value="">Job #</option>
                          {jobNumberOptionsForRow(row.job_number || currentProject?.job_number).map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Task code</span>
                        <select
                          className="input lld-daily-labour-control min-h-11 w-full min-w-0 border-primary/45 bg-background text-foreground shadow-inner"
                          value={row.task_code || ''}
                          onChange={(e) => updateLabourRow(index, 'task_code', e.target.value)}
                          data-testid={`daily-labour-task-${index}`}
                        >
                          <option value="">Task code</option>
                          {taskCodeOptionsForRow(row.task_code).map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1 sm:col-span-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Staff notes</span>
                        <Textarea
                          className="min-h-[90px] w-full min-w-0 border-primary/45 bg-background text-foreground shadow-inner"
                          placeholder="Notes for this staff member, e.g. left early, induction, worked L4 only..."
                          value={row.description || row.other || ''}
                          onChange={(e) => updateLabourRow(index, 'description', e.target.value)}
                          data-testid={`daily-labour-notes-${index}`}
                        />
                      </label>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row sm:flex-wrap">
                      <Button type="button" onClick={saveLabourRows} disabled={labourSaving || !selectedProject} data-testid="diary-staff-popout-save">
                        {labourSaving ? 'Saving...' : 'Save diary check'}
                      </Button>
                      <Button type="button" variant="outline" onClick={closeLabourEditor} data-testid="diary-staff-popout-close-bottom">
                        Close
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeLabourRow(index)}
                        data-testid={`daily-labour-remove-${index}`}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:flex-wrap">
              <Button type="button" onClick={saveLabourRows} disabled={labourSaving || !selectedProject} data-testid="daily-labour-save">
                {labourSaving ? 'Saving...' : 'Save diary check'}
              </Button>

            </div>

            <p className="text-xs font-medium text-muted-foreground">Tap a staff name to edit the diary check. This does not push to Timesheet Manager.</p>
          </CardContent>
        </Card>

        {/* Work Done Today - diary-work-before-resources-v1 - diary-critical-hierarchy-staff-compact-v1 */}
            <Card id="diary-work-section" className="ops-card lg:col-span-2">
              <CardHeader className="ops-card-header border-b border-border/70 bg-secondary/20 px-4 py-4">
                <CardTitle className="font-heading text-lg font-black uppercase tracking-[0.14em] flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Work Done Today ({diary.walkaround_entries?.length || 0})
                </CardTitle>
              </CardHeader>

              <CardContent className="py-3 max-h-80 overflow-y-auto">
                {diary.walkaround_entries?.length > 0 ? (
                  <div className="space-y-3">
                    {sortDiaryPriorityFirst(diary.walkaround_entries).map((entry) => (
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
                          {entry.owner && <span>â€¢ {entry.owner}</span>}
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

        {/* Site Resources */}
            <Card id="diary-resources-section" className="ops-card lg:col-span-2" data-testid="daily-site-resources-card">
              <CardHeader className="ops-card-header border-b border-border/70 bg-secondary/20 px-4 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="font-heading text-base font-black uppercase tracking-[0.14em] flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Site Resources
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Materials and plant are separated so the diary stays clean.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="rounded-full border border-border bg-background/70 px-3 py-1 text-sm font-semibold text-muted-foreground">
                      {resourceMaterials.length} materials â€¢ {resourcePlantEquipment.length} plant / gear
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={() => window.open(toolTrackerUrl, '_blank', 'noopener,noreferrer')} data-testid="open-tool-tracker">
                      Open Tool Tracker
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 px-4 py-5 sm:px-6">
                <div className="grid grid-cols-2 gap-2" data-testid="diary-resource-tabs-v2">
                  <button
                    type="button"
                    onClick={() => setActiveResourceTab('materials')}
                    className={`rounded-xl border px-3 py-2 text-left text-sm font-black uppercase tracking-[0.12em] transition ${
                      activeResourceTab === 'materials' ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
                    }`}
                    data-testid="diary-resource-tab-materials"
                  >
                    Materials ({resourceMaterials.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveResourceTab('plant_equipment')}
                    className={`rounded-xl border px-3 py-2 text-left text-sm font-black uppercase tracking-[0.12em] transition ${
                      activeResourceTab === 'plant_equipment' ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
                    }`}
                    data-testid="diary-resource-tab-plant"
                  >
                    Plant ({resourcePlantEquipment.length})
                  </button>
                </div>

                {resourcesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading site resources...</p>
                ) : resourcesTotalCount === 0 && !resourcesEditMode ? (
                  <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground" data-testid="daily-site-resources-empty">
                    No resources recorded for this diary day.
                  </div>
                ) : !resourcesEditMode ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="daily-site-resources-summary">
                    <div id="daily-site-resources-materials" className="lld-resource-section rounded-xl border border-border/70 bg-secondary/20 p-3">
                      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Materials</p>
                      {resourceMaterials.length > 0 ? (
                        <div className="space-y-2">
                          {resourceMaterials.map((row, index) => (
                            <div key={row.id || index} className="lld-resource-summary-row rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                              <p className="text-sm font-bold">{row.item}</p>
                              <p className="text-xs text-muted-foreground">{[row.quantity, row.supplier_or_reference, row.status].filter(Boolean).join(' â€¢ ')}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No materials recorded.</p>
                      )}
                    </div>

                    <div id="daily-site-resources-plant" className="lld-resource-section rounded-xl border border-border/70 bg-secondary/20 p-3">
                      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Plant</p>
                      {resourcePlantEquipment.length > 0 ? (
                        <div className="space-y-2">
                          {resourcePlantEquipment.map((row, index) => (
                            <div key={row.id || index} className="lld-resource-summary-row rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                              <p className="text-sm font-bold">{row.item}</p>
                              <p className="text-xs text-muted-foreground">{[row.quantity, row.supplier_or_reference, row.status].filter(Boolean).join(' â€¢ ')}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No plant, equipment, or tools recorded.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-testid="daily-site-resources-edit">
                    {[
                      ['materials', 'Materials', resourceMaterials],
                      ['plant_equipment', 'Plant', resourcePlantEquipment]
                    ].filter(([category]) => category === activeResourceTab).map(([category, title, rows]) => (
                      <div key={category} id={category === 'materials' ? 'daily-site-resources-materials' : 'daily-site-resources-plant'} className="lld-resource-section rounded-xl border border-border/70 bg-secondary/20 p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
                          <Button type="button" size="sm" variant="secondary" onClick={() => addResourceRow(category)} data-testid={`daily-site-resources-add-${category}`}>
                            Add row
                          </Button>
                        </div>

                        {(rows.length === 0) ? (
                          <p className="text-sm text-muted-foreground">No rows yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {rows.map((row, index) => (
                              <div key={row.id || index} className="lld-resource-edit-row grid grid-cols-1 gap-2 rounded-lg border border-border/60 bg-background/70 p-3 md:grid-cols-2">
                                <Input
                                  value={row.item || ''}
                                  onChange={(e) => updateResourceRow(category, index, 'item', e.target.value)}
                                  placeholder={category === 'materials' ? 'Material / item' : 'Plant / equipment / tool'}
                                  data-testid={`daily-site-resources-item-${category}-${index}`}
                                />
                                <Input
                                  value={row.quantity || ''}
                                  onChange={(e) => updateResourceRow(category, index, 'quantity', e.target.value)}
                                  placeholder="Qty / hours / count"
                                  data-testid={`daily-site-resources-quantity-${category}-${index}`}
                                />
                                <Input
                                  value={row.supplier_or_reference || ''}
                                  onChange={(e) => updateResourceRow(category, index, 'supplier_or_reference', e.target.value)}
                                  placeholder={category === 'materials' ? 'Supplier / docket' : 'Owned / hired / Tool Tracker ref'}
                                  data-testid={`daily-site-resources-reference-${category}-${index}`}
                                />
                                <select
                                  className="input min-h-11 w-full"
                                  value={row.status || 'noted'}
                                  onChange={(e) => updateResourceRow(category, index, 'status', e.target.value)}
                                  data-testid={`daily-site-resources-status-${category}-${index}`}
                                >
                                  <option value="noted">Noted</option>
                                  <option value="delivered">Delivered / on site</option>
                                  <option value="used">Used today</option>
                                  <option value="short">Short / missing</option>
                                  <option value="damaged">Damaged / breakdown</option>
                                  <option value="removed">Removed / off hire</option>
                                </select>
                                <Input
                                  className="md:col-span-2"
                                  value={row.notes || ''}
                                  onChange={(e) => updateResourceRow(category, index, 'notes', e.target.value)}
                                  placeholder="Notes"
                                  data-testid={`daily-site-resources-notes-${category}-${index}`}
                                />
                                <div className="md:col-span-2">
                                  <Button type="button" variant="ghost" size="sm" onClick={() => removeResourceRow(category, index)}>
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:flex-wrap">
                  <Button type="button" variant="secondary" onClick={() => setResourcesEditMode(true)} data-testid="daily-site-resources-edit-button">
                    Add / edit resources
                  </Button>
                  <Button type="button" onClick={saveSiteResources} disabled={resourcesSaving || !selectedProject} data-testid="daily-site-resources-save">
                    {resourcesSaving ? 'Saving...' : 'Save resources'}
                  </Button>
                </div>

                <p className="rounded-lg border border-border/70 bg-secondary/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  Diary-only resource capture. Tool Tracker remains the full asset register.
                </p>
              </CardContent>
            </Card>

            {/* Action Items Raised Today - action-wording-cleanup-v1 */}
            <Card id="diary-action-open-section" className="ops-card">
              <CardHeader className="ops-card-header border-b border-border/70 bg-secondary/20 px-4 py-4">
                <CardTitle className="font-heading text-base font-black uppercase tracking-[0.14em] flex items-center gap-2">
                  <ListTodo className="w-4 h-4" />
                  Action Items Raised Today ({diary.action_items_opened?.length || 0})
                </CardTitle>
              </CardHeader>

              <CardContent className="py-3 max-h-80 overflow-y-auto">
                {diary.action_items_opened?.length > 0 ? (
                  <div className="space-y-2">
                    {sortDiaryPriorityFirst(diary.action_items_opened).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openDiaryActionItem(item)}
                        className={`w-full p-2 rounded-md border-l-4 text-left transition ${selectedDiaryActionItem?.id === item.id ? 'border-l-primary bg-primary/15 ring-2 ring-primary/25' : 'border-l-amber-500 bg-secondary/30 hover:border-primary/50 hover:bg-primary/5'}`}
                        data-testid={`diary-action-open-clickthrough-${item.id}`}
                      >
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
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No action items raised today</p>
                )}
              </CardContent>
            </Card>

            {/* Action Items Completed Today */}
            <Card id="diary-action-completed-section" className="ops-card">
              <CardHeader className="ops-card-header border-b border-border/70 bg-secondary/20 px-4 py-4">
                <CardTitle className="font-heading text-base font-black uppercase tracking-[0.14em] flex items-center gap-2 text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" />
                  Action Items Completed Today ({diary.action_items_closed?.length || 0})
                </CardTitle>
              </CardHeader>

              <CardContent className="py-3 max-h-80 overflow-y-auto">
                {diary.action_items_closed?.length > 0 ? (
                  <div className="space-y-2">
                    {sortDiaryPriorityFirst(diary.action_items_closed).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openDiaryActionItem(item)}
                        className={`w-full p-2 rounded-md border-l-4 text-left transition ${selectedDiaryActionItem?.id === item.id ? 'border-l-emerald-300 bg-emerald-500/15 ring-2 ring-emerald-400/25' : 'border-l-emerald-500 bg-secondary/30 hover:border-primary/50 hover:bg-primary/5'}`}
                        data-testid={`diary-action-closed-clickthrough-${item.id}`}
                      >
                        <p className="text-sm font-medium">{item.title}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No action items completed today</p>
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
