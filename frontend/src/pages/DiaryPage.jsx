import React, { useState, useEffect, useCallback, useRef } from 'react';
import { actionItemsApi, diaryApi, integrationsApi, projectsApi, walkaroundApi, gatesApi, programmesApi } from '../lib/api';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import DigitalJobBinder from '../components/DigitalJobBinder';

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

class DiaryPageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Unknown diary error",
    };
  }

  componentDidCatch(error, errorInfo) {
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-background p-6" data-commercial-readiness="diary-error-boundary-v1">
          <section className="mx-auto max-w-3xl rounded-2xl border border-destructive/30 bg-card p-6 shadow-lg">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-destructive">Diary recovery mode</p>
            <h1 className="mt-2 font-heading text-2xl font-black uppercase tracking-[0.12em] text-foreground">
              Diary could not load safely
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              One Diary section hit a runtime error, so the app stopped this page before showing incorrect diary data.
              Reload the page first. If it happens again, record the time and continue using Roadblocks, Walkaround, or Action Items from the sidebar.
            </p>
            <p className="mt-3 rounded-lg bg-secondary/40 p-3 text-xs font-semibold text-muted-foreground">
              Error: {this.state.errorMessage}
            </p>
            <button
              type="button"
              className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-black uppercase tracking-[0.12em] text-primary-foreground"
              onClick={() => window.location.reload()}
            >
              Reload Diary
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

const RESOURCE_SUMMARY_STATUS_LABELS = {
  noted: 'Noted',
  delivered: 'On site',
  used: 'Used today',
  short: 'Short / missing',
  damaged: 'Damaged',
  removed: 'Removed',
};

const getResourceSummaryStatusLabel = (status) => {
  const value = String(status || 'noted')
    .trim()
    .toLowerCase();

  return RESOURCE_SUMMARY_STATUS_LABELS[value] ||
    value
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const ResourceSummaryRow = ({ row = {} }) => {
  const item = String(row.item || '').trim() || 'Resource';
  const quantity = String(row.quantity || '').trim();
  const reference = String(
    row.supplier_or_reference || ''
  ).trim();
  const notes = String(row.notes || '').trim();
  const status = String(row.status || 'noted')
    .trim()
    .toLowerCase();

  const meta = [
    quantity ? `Qty ${quantity}` : '',
    reference,
    notes,
  ].filter(Boolean);

  const statusClassName = (
    status === 'short' ||
    status === 'damaged'
  )
    ? 'border-red-500/30 bg-red-500/10 text-red-600'
    : (
      status === 'delivered' ||
      status === 'used'
    )
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
      : status === 'removed'
        ? 'border-slate-400/30 bg-slate-500/10 text-slate-500'
        : 'border-primary/25 bg-primary/10 text-primary';

  return (
    <div
      className="rounded-lg border border-border/60 bg-background/70 px-3 py-2"
      data-testid="diary-resource-summary-row-v8-9c3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 break-words text-sm font-black text-foreground">
          {item}
        </p>

        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${statusClassName}`}
        >
          {getResourceSummaryStatusLabel(status)}
        </span>
      </div>

      {meta.length > 0 && (
        <p className="mt-1 break-words text-xs font-semibold leading-5 text-muted-foreground">
          {meta.join(' | ')}
        </p>
      )}
    </div>
  );
};

// staff-register-attendance-foundation-v1
const STAFF_ATTENDANCE_OPTIONS = [
  { value: 'at_work', label: 'At work' },
  { value: 'sick', label: 'Sick' },
  { value: 'annual_leave', label: 'Annual leave' },
  { value: 'public_holiday', label: 'Public holiday' },
  { value: 'away_other_site', label: 'Away / other site' },
  { value: 'no_work', label: 'No work' }
];

const STAFF_NON_WORKING_STATUSES = new Set([
  'sick',
  'annual_leave',
  'public_holiday',
  'no_work'
]);

const DiaryPage = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [diary, setDiary] = useState(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [labourRows, setLabourRows] = useState([]);
  const [labourLoading, setLabourLoading] = useState(false);
  const [labourSaving, setLabourSaving] = useState(false);
  const [labourSaveStatus, setLabourSaveStatus] = useState(''); // staff-diary-backend-autosave-v4
  const [labourImporting, setLabourImporting] = useState(false);
  // staff-register-weekly-state-v1
  const [weeklyLabour, setWeeklyLabour] = useState({
    dates: [],
    staff: [],
    totals: {},
    staff_count: 0,
    week_start: '',
    week_end: ''
  });
  const [weeklyLabourLoading, setWeeklyLabourLoading] = useState(false);
  const [weeklyLabourError, setWeeklyLabourError] = useState('');
  const [labourEditMode, setLabourEditMode] = useState(false);
  const [activeLabourIndex, setActiveLabourIndex] = useState(null);
  const [selectedStaffEmployeeValue, setSelectedStaffEmployeeValue] = useState('');
  const [showNewStaffForm, setShowNewStaffForm] = useState(false);
  const [staffSectionExpanded, setStaffSectionExpanded] = useState(false); // staff-collapsible-summary-v1
  const [newStaffName, setNewStaffName] = useState('');
  const [siteResources, setSiteResources] = useState({ materials: [], plant_equipment: [], subcontractors: [] }); // diary-subcontractors-on-site-v1
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesSaving, setResourcesSaving] = useState(false);
  const [selectedBinderMaterialIndex, setSelectedBinderMaterialIndex] = useState(null); // diary-binder-native-material-editor-v8-9c2
  const [resourcesEditMode, setResourcesEditMode] = useState(false);
  const [activeResourceTab, setActiveResourceTab] = useState('materials'); // diary-command-header-tabs-v2
  const [timesheetReferenceOptions, setTimesheetReferenceOptions] = useState({
    employees: [],
    project_managers: [],
    task_codes: [],
    lunch_options: ['0', '30', '60']
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const todayDate = getNzDateString();
    const requestedDate = new URLSearchParams(
      window.location.search
    ).get('date');

    return (
      /^\d{4}-\d{2}-\d{2}$/.test(requestedDate || '') &&
      requestedDate <= todayDate
    )
      ? requestedDate
      : todayDate;
  }); // diary-context-url-date-init-v8-9j2-2
  const [loading, setLoading] = useState(true);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [fullDiaryOpen, setFullDiaryOpen] = useState(() => (
    Boolean(new URLSearchParams(window.location.search).get('view'))
  ));
  const [selectedDiaryActionItem, setSelectedDiaryActionItem] = useState(null); // legacy-action-open-marker-retired-v8-9a6
  const [selectedDiaryActionDraft, setSelectedDiaryActionDraft] = useState(null); // legacy-action-card-marker-retired-v8-9a6
  const [diaryActionSaving, setDiaryActionSaving] = useState(false);
  const [communicationItems, setCommunicationItems] = useState([]); // binder-native-communication-create-v2s2e
  const [communicationSaving, setCommunicationSaving] = useState(false);
  const [selectedDiaryRoadblock, setSelectedDiaryRoadblock] = useState(null); // diary-binder-real-roadblocks-v8-9e1
  const [followUpConfirm, setFollowUpConfirm] = useState(null); // diary-followup-app-confirm-v1-state
  const [followUpConfirmSaving, setFollowUpConfirmSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gates, setGates] = useState([]);
  const [programmeLookaheadItems, setProgrammeLookaheadItems] = useState([]); // diary-programme-lookahead-v1
  const [programmeLookaheadLoading, setProgrammeLookaheadLoading] = useState(false);
  const [programmeLookaheadError, setProgrammeLookaheadError] = useState('');
  const fileInputRef = useRef(null);
  const quickUploadInputRef = useRef(null); // photo-take-upload-choice-v1
  const issueCameraInputRef = useRef(null);
  const issueUploadInputRef = useRef(null);
  const noteInputRef = useRef(null);
  const activeLabourEditorRef = useRef(null);
  const activeLabourNameInputRef = useRef(null);
  const labourDraftReadyRef = useRef('');
  const labourServerAutosaveTimerRef = useRef(null);
  const labourLastSavedPayloadRef = useRef('');
  const labourSaveInFlightRef = useRef(false); // staff-autosave-flash-loop-repair-v1
  const resourcesDraftReadyRef = useRef('');
  const resourcesEditBaselineRef = useRef(null); // resource-edit-baseline-v8-9k2-3
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

  // staff-register-normal-day-speed-v1
  const getNormalDayLabourValues = () => {
    const date = new Date(`${selectedDate}T12:00:00`);
    const dayOfWeek = Number.isNaN(date.getTime())
      ? 1
      : date.getDay();

    if (dayOfWeek === 6) {
      return {
        attendance_status: 'at_work',
        start_time: '07:00',
        finish_time: '13:00',
        lunch_duration: '0',
        total_hours: 6
      };
    }

    if (dayOfWeek === 5) {
      return {
        attendance_status: 'at_work',
        start_time: '07:00',
        finish_time: '15:30',
        lunch_duration: '30',
        total_hours: 8
      };
    }

    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
      return {
        attendance_status: 'at_work',
        start_time: '07:00',
        finish_time: '16:30',
        lunch_duration: '30',
        total_hours: 9
      };
    }

    return {
      attendance_status: 'at_work',
      start_time: '',
      finish_time: '',
      lunch_duration: '0',
      total_hours: 0
    };
  };

  const createEmptyLabourRow = () => ({
    employee_name: '',
    attendance_status: 'at_work',
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
    const attendance_status = STAFF_ATTENDANCE_OPTIONS.some(
      (option) => option.value === row.attendance_status
    )
      ? row.attendance_status
      : 'at_work';

    const start_time = normaliseTimeValue(row.start_time);
    const finish_time = normaliseTimeValue(row.finish_time);
    const lunch_duration = String(row.lunch_duration ?? '30');

    const total_hours = STAFF_NON_WORKING_STATUSES.has(attendance_status)
      ? 0
      : calculateLabourHours(start_time, finish_time, lunch_duration);

    return {
      ...row,
      attendance_status,
      start_time,
      finish_time,
      lunch_duration,
      total_hours
    };
  };

  const updateLabourRow = (index, field, value) => {
    setLabourRows((current) => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const updated = { ...row, [field]: value };
      if (field === 'attendance_status') {
        if (STAFF_NON_WORKING_STATUSES.has(value)) {
          updated.start_time = '';
          updated.finish_time = '';
          updated.total_hours = 0;
        } else {
          updated.total_hours = calculateLabourHours(
            updated.start_time,
            updated.finish_time,
            updated.lunch_duration
          );
        }
      }

      if (['start_time', 'finish_time', 'lunch_duration'].includes(field)) {
        updated.total_hours = STAFF_NON_WORKING_STATUSES.has(updated.attendance_status)
          ? 0
          : calculateLabourHours(
              updated.start_time,
              updated.finish_time,
              updated.lunch_duration
            );
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

    // staff-diary-no-forced-focus-v2: keep Staff on Site editor stable; do not force focus/keyboard/page movement.
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
        ...getNormalDayLabourValues(),
        employee_id: employeeOption.employee_id || '',
        employee_name: staffName,
        sync_status: employeeOption.linked_to_timesheet ? 'local_only' : 'local_pending_timesheet_staff'
      }
    ]);

    window.requestAnimationFrame(() => openLabourEditor(labourRows.length));
  };

  // staff-register-add-allocation-row-v1
  const addLabourAllocationForStaff = (sourceIndex) => {
    const sourceRow = labourRows[sourceIndex];

    if (!sourceRow) {
      toast.error('Selected staff row could not be found');
      return -1;
    }

    const employeeName = String(sourceRow.employee_name || '').trim();

    if (!employeeName) {
      toast.error('Add the staff member name before adding another task');
      return -1;
    }

    const nextIndex = labourRows.length;

    const nextRow = normaliseLabourRow({
      ...createEmptyLabourRow(),
      employee_id: sourceRow.employee_id || '',
      employee_name: employeeName,
      attendance_status: sourceRow.attendance_status || 'at_work',
      job_number:
        sourceRow.job_number ||
        currentProject?.job_number ||
        '',
      task_code: '',
      start_time: '',
      finish_time: '',
      lunch_duration: '0',
      total_hours: 0,
      description: '',
      other: '',
      source: 'LLD',
      source_diary_project_id: selectedProject || '',
      source_diary_date: selectedDate,
      sync_status:
        sourceRow.sync_status ||
        (
          sourceRow.employee_id
            ? 'local_only'
            : 'local_pending_timesheet_staff'
        )
    });

    setLabourRows((current) => [
      ...current,
      nextRow
    ]);

    setLabourSaveStatus(
      'New task row added — enter times and task'
    );

    return nextIndex;
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
    toast.info('Site-only staff added to this diary. Add them in Timesheet Manager to make them permanent.');
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

  const copyPreviousDayCrew = async () => {
    if (!selectedProject || !selectedDate) {
      toast.error('Select a project and date first');
      return;
    }

    if (labourRows.length > 0) {
      toast.info('This day already has staff recorded');
      return;
    }

    const previousDate = parseDateInput(selectedDate);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateValue = formatDateInput(previousDate);

    setLabourLoading(true);

    try {
      const res = await diaryApi.getLabour(selectedProject, previousDateValue);
      const previousRows = Array.isArray(res.data?.rows) ? res.data.rows : [];

      if (previousRows.length === 0) {
        toast.info('No staff were recorded on the previous day');
        return;
      }

      const seenStaff = new Set();

      const copiedRows = previousRows
        .filter((row) => {
          const staffKey = String(
            row.employee_id || row.employee_name || ''
          ).trim().toLowerCase();

          if (!staffKey || seenStaff.has(staffKey)) {
            return false;
          }

          seenStaff.add(staffKey);
          return true;
        })
        .map((row) => normaliseLabourRow({
          ...createEmptyLabourRow(),
          ...getNormalDayLabourValues(),
          employee_id: row.employee_id || '',
          employee_name: row.employee_name || '',
          job_number: currentProject?.job_number || row.job_number || '',
          source: 'LLD',
          source_diary_project_id: selectedProject,
          source_diary_date: selectedDate,
          sync_status: row.employee_id
            ? 'local_only'
            : 'local_pending_timesheet_staff'
        }));

      if (copiedRows.length === 0) {
        toast.info('No usable staff were found on the previous day');
        return;
      }

      setLabourRows(copiedRows);
      setLabourSaveStatus('Previous crew copied - saving');
      toast.success(
        `${copiedRows.length} staff copied from previous day`
      );
    } catch (error) {
      toast.error(
        error.response?.data?.detail ||
        'Previous day crew could not be loaded'
      );
    } finally {
      setLabourLoading(false);
    }
  }; // foreman-daily-crew-copy-previous-v1

  const markAllStaffAtWork = () => {
    const defaults = getNormalDayLabourValues();

    setLabourRows((current) => current.map((row) => ({
      ...row,
      ...defaults
    })));

    setLabourSaveStatus('Normal day applied — saving');
    toast.success('All listed staff marked at work with normal hours');
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

  const cloneSiteResources = useCallback((resources = {}) => ({
    materials: (Array.isArray(resources.materials) ? resources.materials : []).map((row) => ({ ...row })),
    plant_equipment: (Array.isArray(resources.plant_equipment) ? resources.plant_equipment : []).map((row) => ({ ...row })),
    subcontractors: (Array.isArray(resources.subcontractors) ? resources.subcontractors : []).map((row) => ({ ...row }))
  }), []);

  const beginSiteResourcesEdit = () => {
    if (!resourcesEditMode) {
      resourcesEditBaselineRef.current = cloneSiteResources(siteResources);
    }

    setResourcesEditMode(true);
  }; // safe-resource-edit-entry-v8-9k2-3

  const addResourceRow = (category) => {
    if (!resourcesEditMode) {
      beginSiteResourcesEdit();
    }

    setSiteResources((current) => ({
      ...current,
      [category]: [...(Array.isArray(current?.[category]) ? current[category] : []), createEmptyResourceRow()]
    }));
  };

  const removeResourceRow = (category, index) => {
    setSiteResources((current) => ({
      ...current,
      [category]: (Array.isArray(current?.[category]) ? current[category] : []).filter((_, rowIndex) => rowIndex !== index)
    }));
  };

  const resourceMaterials = Array.isArray(siteResources?.materials) ? siteResources.materials : [];
  const resourcePlantEquipment = Array.isArray(siteResources?.plant_equipment) ? siteResources.plant_equipment : [];
  const resourceSubcontractors = Array.isArray(siteResources?.subcontractors) ? siteResources.subcontractors : []; // diary-subcontractors-on-site-v1
  const selectedBinderMaterial = (
    Number.isInteger(selectedBinderMaterialIndex) &&
    resourceMaterials[selectedBinderMaterialIndex]
  ) || null;
  const resourcesTotalCount = resourceMaterials.length + resourcePlantEquipment.length + resourceSubcontractors.length;
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
      // Corrupt or unreadable device drafts are ignored so the diary can continue loading.
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
      setDraftStatus('Draft autosave unavailable on this device. Save manually before leaving.');
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
    ...(Array.isArray(resources.plant_equipment) ? resources.plant_equipment : []),
    ...(Array.isArray(resources.subcontractors) ? resources.subcontractors : [])
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

    beginSiteResourcesEdit();
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
    return `${start} to ${finish} | ${job} | ${code} | ${hours}${hasNotes ? ' | Notes' : ''}`; // staff-diary-check-mobile-text-cleanup-v2
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

    const isCleanStaffOption = (employee) => { // staff-timesheet-dropdown-filter-v1
      const combined = ['employee_name', 'name', 'full_name', 'display_name', 'email', 'id']
        .map((key) => String(employee?.[key] || ''))
        .join(' ')
        .toLowerCase();
      if (combined.includes('tm cert')) return false;
      if (combined.includes('cert employee')) return false;
      if (combined.includes('cert pm')) return false;
      if (combined.includes('demo')) return false;
      if (combined.includes('sample')) return false;
      return true;
    };

    // staff-picker-name-dedupe-v2s2d
    const seenNames = new Set();

    sourceEmployees.forEach((employee) => {
      if (!isCleanStaffOption(employee)) return;
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

      const nameKey = displayName.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
      const isCurrentValue = String(currentValue || '').trim() === value;

      if (
        !value ||
        seen.has(value) ||
        (seenNames.has(nameKey) && !isCurrentValue)
      ) return;

      seen.add(value);
      seenNames.add(nameKey);
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
        label: `${current} (site-only diary entry)`,
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
    entry_type: 'general_note', // diary-quick-walkaround-v1
    needs_action: false,
    action_type: 'none',
    priority: 'medium',
    owner: 'Me',
    due_date: tomorrow,
    gate_id: '',
    photos: [],
    create_action_item: false,
    send_to: 'none'
  });

  const createEmptyIssueRecorderData = () => ({
    issue_type: 'delay',
    title: '',
    location: '',
    related_trade: '',
    description: '',
    impact: 'programme',
    action_required: 'please-confirm',
    response_required_by: tomorrow,
    owner: 'Me',
    priority: 'high',
    recipients: '',
    photos: []
  });

  const [showIssueRecorder, setShowIssueRecorder] = useState(false); // onsite-issue-recorder-v1
  const [issueRecorderData, setIssueRecorderData] = useState(() => createEmptyIssueRecorderData());
  const [issueRecorderSaving, setIssueRecorderSaving] = useState(false);
  const [issueRecorderEmailPreview, setIssueRecorderEmailPreview] = useState('');

  const fetchProjects = useCallback(async () => {
    try {
      const res = await projectsApi.getAll();
      const items = Array.isArray(res.data) ? res.data : (res.data?.value || []);
      const commercialItems = items.filter(isCommercialProjectOption);
      setProjects(commercialItems);
      if (commercialItems.length > 0) {
        const requestedProject = new URLSearchParams(
          window.location.search
        ).get('project');
        const savedProject = localStorage.getItem('lld_last_project_id');
        const preferredProject = [requestedProject, savedProject].find(
          (candidate) => candidate && commercialItems.some((project) => project.id === candidate)
        );

        if (preferredProject) {
          setSelectedProject(preferredProject);
          localStorage.setItem('lld_last_project_id', preferredProject);
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
      setDraftStatus('Timesheet staff and task-code lists could not be loaded. Lunch options are still available.');
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
  const fetchWeeklyLabour = useCallback(async () => {
    if (!selectedProject || !selectedDate) {
      setWeeklyLabour({
        dates: [],
        staff: [],
        totals: {},
        staff_count: 0,
        week_start: '',
        week_end: ''
      });
      setWeeklyLabourError('');
      return;
    }

    setWeeklyLabourLoading(true);
    setWeeklyLabourError('');

    try {
      const response = await diaryApi.getWeeklyLabour(
        selectedProject,
        selectedDate
      );

      setWeeklyLabour({
        dates: Array.isArray(response.data?.dates)
          ? response.data.dates
          : [],
        staff: Array.isArray(response.data?.staff)
          ? response.data.staff
          : [],
        totals: response.data?.totals || {},
        staff_count: Number(response.data?.staff_count || 0),
        week_start: response.data?.week_start || '',
        week_end: response.data?.week_end || ''
      });
    } catch (error) {
      setWeeklyLabourError(
        error.response?.data?.detail ||
        'Weekly staff summary could not be loaded'
      );
    } finally {
      setWeeklyLabourLoading(false);
    }
  }, [selectedProject, selectedDate]);

  useEffect(() => {
    fetchWeeklyLabour();
  }, [fetchWeeklyLabour]);

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
      setDraftStatus('Staff diary rows could not be loaded. Restoring any saved device draft if available.');
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
      setSiteResources({ materials: [], plant_equipment: [], subcontractors: [] });
      resourcesEditBaselineRef.current = null;
      resourcesDraftReadyRef.current = '';
      setResourcesEditMode(false);
      setActiveResourceTab('materials');
      setSelectedBinderMaterialIndex(null);
      return;
    }

    const draftKey = getDiaryDraftKey('resources');
    resourcesEditBaselineRef.current = null;
    setResourcesEditMode(false);
    setActiveResourceTab('materials');
    setSelectedBinderMaterialIndex(null);
    setResourcesLoading(true);

    try {
      const res = await diaryApi.getResources(selectedProject, selectedDate);
      const serverResources = {
        materials: Array.isArray(res.data?.materials) ? res.data.materials : [],
        plant_equipment: Array.isArray(res.data?.plant_equipment) ? res.data.plant_equipment : [],
        subcontractors: Array.isArray(res.data?.subcontractors) ? res.data.subcontractors : []
      };

      resourcesEditBaselineRef.current = cloneSiteResources(serverResources);

      const draft = readDiaryDraft('resources');

      if (draft?.resources && hasMeaningfulResourceRows(draft.resources)) {
        setSiteResources(cloneSiteResources(draft.resources));
        setResourcesEditMode(true);
        setDraftStatus('Resources draft restored on this device');
      } else {
        setSiteResources(serverResources);
      }

      resourcesDraftReadyRef.current = draftKey;
    } catch (error) {
      setDraftStatus('Site resources could not be loaded. Restoring any saved device draft if available.');

      const draft = readDiaryDraft('resources');

      if (draft?.resources && hasMeaningfulResourceRows(draft.resources)) {
        setSiteResources(cloneSiteResources(draft.resources));
        setResourcesEditMode(true);
        setDraftStatus('Resources draft restored on this device');
      } else {
        setSiteResources({ materials: [], plant_equipment: [], subcontractors: [] });
      }

      resourcesDraftReadyRef.current = draftKey;
    } finally {
      setResourcesLoading(false);
    }
  }, [selectedProject, selectedDate, cloneSiteResources]);

  const cancelSiteResourcesEdit = () => {
    const baseline = resourcesEditBaselineRef.current
      ? cloneSiteResources(resourcesEditBaselineRef.current)
      : null;

    const currentResources = cloneSiteResources(siteResources);
    const hasChanges = baseline
      ? JSON.stringify(currentResources) !== JSON.stringify(baseline)
      : hasMeaningfulResourceRows(currentResources);

    if (hasChanges && !window.confirm('Discard unsaved site resource changes?')) {
      return;
    }

    clearDiaryDraft('resources');
    setResourcesEditMode(false);
    setActiveResourceTab('materials');
    setSelectedBinderMaterialIndex(null);
    setDraftStatus(hasChanges ? 'Resource changes discarded' : 'Resource editing closed');

    if (baseline) {
      setSiteResources(baseline);
    } else {
      fetchSiteResources();
    }
  }; // safe-resource-edit-cancel-v8-9k2-3

  const saveSiteResources = async (resourceOverride = null) => {
    if (!selectedProject || !selectedDate) {
      toast.error('Select a project and date first');
      return false;
    }

    const materialsToSave = Array.isArray(resourceOverride?.materials)
      ? resourceOverride.materials
      : resourceMaterials;
    const plantToSave = Array.isArray(resourceOverride?.plant_equipment)
      ? resourceOverride.plant_equipment
      : resourcePlantEquipment;
    const subcontractorsToSave = Array.isArray(resourceOverride?.subcontractors)
      ? resourceOverride.subcontractors
      : resourceSubcontractors;

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
        materials: cleanRows(materialsToSave),
        plant_equipment: cleanRows(plantToSave),
        subcontractors: cleanRows(subcontractorsToSave)
      });

      const savedResources = {
        materials: Array.isArray(res.data?.materials) ? res.data.materials : [],
        plant_equipment: Array.isArray(res.data?.plant_equipment) ? res.data.plant_equipment : [],
        subcontractors: Array.isArray(res.data?.subcontractors) ? res.data.subcontractors : []
      };

      setSiteResources(savedResources);
      resourcesEditBaselineRef.current = cloneSiteResources(savedResources);
      clearDiaryDraft('resources');
      setDraftStatus('Resources saved to diary');
      setResourcesEditMode(false);
      setActiveResourceTab('materials');
      setSelectedBinderMaterialIndex(null);
      toast.success('Site resources saved to diary');
      fetchDiary();
      fetchSiteResources();
      return true;
    } catch (error) {
      toast.error('Failed to save site resources');
      return false;
    } finally {
      setResourcesSaving(false);
    }
  };

  const openBinderMaterial = (index) => {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= resourceMaterials.length
    ) {
      return;
    }

    setSelectedBinderMaterialIndex(index);
  };

  const addBinderMaterial = () => {
    const reusableBlankIndex = resourceMaterials.findIndex((row) => (
      !row?.id &&
      ![
        row?.item,
        row?.supplier_or_reference,
        row?.quantity,
        row?.notes
      ].some((value) => String(value || '').trim())
    ));

    if (reusableBlankIndex >= 0) {
      setSelectedBinderMaterialIndex(reusableBlankIndex);
      return;
    }

    const newIndex = resourceMaterials.length;
    addResourceRow('materials');
    setSelectedBinderMaterialIndex(newIndex);
  };

  const updateSelectedBinderMaterial = (field, value) => {
    if (!Number.isInteger(selectedBinderMaterialIndex)) return;

    updateResourceRow(
      'materials',
      selectedBinderMaterialIndex,
      field,
      value
    );
  };

  const closeSelectedBinderMaterial = () => {
    if (Number.isInteger(selectedBinderMaterialIndex)) {
      const row = resourceMaterials[selectedBinderMaterialIndex];
      const hasMeaningfulValue = [
        row?.item,
        row?.supplier_or_reference,
        row?.quantity,
        row?.notes
      ].some((value) => String(value || '').trim());

      if (row && !row.id && !hasMeaningfulValue) {
        removeResourceRow('materials', selectedBinderMaterialIndex);
      }
    }

    setSelectedBinderMaterialIndex(null);
  };

  const saveSelectedBinderMaterial = async () => {
    if (!Number.isInteger(selectedBinderMaterialIndex)) return;

    const row = resourceMaterials[selectedBinderMaterialIndex];

    if (!row || !String(row.item || '').trim()) {
      toast.error('Material or item is required');
      return;
    }

    const saved = await saveSiteResources();

    if (saved) {
      setSelectedBinderMaterialIndex(null);
    }
  };

  const removeSelectedBinderMaterial = async () => {
    if (!Number.isInteger(selectedBinderMaterialIndex)) return;

    const previousResources = siteResources;
    const nextResources = {
      ...siteResources,
      materials: resourceMaterials.filter(
        (_, index) => index !== selectedBinderMaterialIndex
      )
    };

    setSiteResources(nextResources);

    const saved = await saveSiteResources(nextResources);

    if (saved) {
      setSelectedBinderMaterialIndex(null);
    } else {
      setSiteResources(previousResources);
    }
  };

  const saveLabourRows = async ({ silent = false } = {}) => {
    if (!selectedProject || !selectedDate) {
      toast.error('Select a project and date first');
      return;
    }

    if (labourSaveInFlightRef.current) {
      return;
    }

    labourSaveInFlightRef.current = true;
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

      const cleanRowsPayload = JSON.stringify(cleanRows);
      const res = await diaryApi.saveLabour(selectedProject, {
        date: selectedDate,
        rows: cleanRows
      });

      const savedRows = Array.isArray(res.data?.rows)
        ? res.data.rows.map(normaliseLabourRow)
        : [];

      const savedComparableRows = savedRows
        .filter((row) => [
          row.employee_name,
          row.start_time,
          row.finish_time,
          row.job_number,
          row.task_code,
          row.description,
          row.other
        ].some((value) => String(value || '').trim()))
        .map((row) => normaliseLabourRow({
          ...row,
          source: 'LLD',
          source_diary_project_id: selectedProject,
          source_diary_date: selectedDate,
          sync_status: 'diary_check_only',
          project_manager_id: ''
        }));

      labourLastSavedPayloadRef.current =
        JSON.stringify(savedComparableRows);

      setLabourRows(savedRows);
      clearDiaryDraft('labour');
      setDraftStatus('Staff diary check autosaved');
      setLabourSaveStatus('Saved');

      fetchWeeklyLabour();
    } catch (error) {
      setLabourSaveStatus('Save failed');
      if (!silent) {
        toast.error('Failed to autosave staff diary check');
      }
    } finally {
      labourSaveInFlightRef.current = false;
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
      const detail = error?.response?.data?.detail;
      toast.error(detail || 'Failed to import labour rows to Timesheet');
    } finally {
      setLabourImporting(false);
    }
  };
  const fetchDiary = useCallback(async () => {
    if (!selectedProject) return;

    try {
      const [res, actionItemsRes] = await Promise.all([
        diaryApi.get(selectedProject, selectedDate),
        actionItemsApi
          .getAll({ project_id: selectedProject })
          .catch(() => ({ data: [] }))
      ]);

      setDiary(res.data);

      const loadedActionItems = Array.isArray(actionItemsRes?.data)
        ? actionItemsRes.data
        : Array.isArray(actionItemsRes?.data?.value)
          ? actionItemsRes.data.value
          : [];

      setCommunicationItems(loadedActionItems);
    } catch (error) {
      setDraftStatus('Diary could not be loaded. Check connection or refresh.');
      setDiary(null);
      setCommunicationItems([]);
    }
  }, [selectedProject, selectedDate]);


  const markDayReviewed = async () => {
    if (!selectedProject || !selectedDate) {
      toast.error('Select a project and date first');
      return;
    }

    const reviewProjectId = selectedProject;
    const reviewDate = selectedDate;

    setReviewSaving(true);

    try {
      const res = await diaryApi.markReviewed(reviewProjectId, {
        date: reviewDate,
      });

      setDiary((current) => (
        String(current?.project?.id || '') === String(reviewProjectId) &&
        String(current?.date || '') === String(reviewDate)
          ? {
              ...(current || {}),
              review: res.data,
            }
          : current
      ));

      toast.success('Day marked reviewed');
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(detail || 'Failed to mark day reviewed');
    } finally {
      setReviewSaving(false);
    }
  };

  const reopenDayReview = async () => {
    if (!selectedProject || !selectedDate) {
      toast.error('Select a project and date first');
      return;
    }

    const reviewProjectId = selectedProject;
    const reviewDate = selectedDate;

    setReviewSaving(true);

    try {
      const res = await diaryApi.reopenReview(reviewProjectId, {
        date: reviewDate,
      });

      setDiary((current) => (
        String(current?.project?.id || '') === String(reviewProjectId) &&
        String(current?.date || '') === String(reviewDate)
          ? {
              ...(current || {}),
              review: res.data,
            }
          : current
      ));

      toast.success('Day review reopened');
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(detail || 'Failed to reopen day review');
    } finally {
      setReviewSaving(false);
    }
  };
  // diary-day-review-actions-v8-9j8-3

  const getDiaryProgrammeTaskWindowDate = (task = {}) => {
    return task.programme_start_date || task.start_date || task.start || task.end_date || task.due_date || '';
  }; // diary-programme-lookahead-v1

  const fetchProgrammeLookahead = useCallback(async () => {
    if (!selectedProject) {
      setProgrammeLookaheadItems([]);
      setProgrammeLookaheadError('');
      return;
    }

    setProgrammeLookaheadLoading(true);
    setProgrammeLookaheadError('');

    try {
      const project = projects.find((item) => String(item.id) === String(selectedProject));
      const projectLabel = project?.job_number
        ? `${project.job_number} - ${project.name || 'Project'}`
        : (project?.name || 'Selected project');

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const windowEnd = new Date(today);
      windowEnd.setDate(today.getDate() + 42);

      const programmeRes = await programmesApi.getAll(selectedProject);
      const programmes = Array.isArray(programmeRes?.data) ? programmeRes.data : (programmeRes?.data?.items || []);
      const rows = [];

      for (const programme of programmes.slice(0, 3)) {
        if (!programme?.id) continue;

        const tasksRes = await programmesApi.getTasks(programme.id);
        const tasks = Array.isArray(tasksRes?.data) ? tasksRes.data : (tasksRes?.data?.items || []);

        tasks.forEach((task) => {
          const dateValue = getDiaryProgrammeTaskWindowDate(task);
          if (!dateValue) return;

          const date = new Date(dateValue);
          if (Number.isNaN(date.getTime())) return;
          date.setHours(0, 0, 0, 0);

          if (date < today || date > windowEnd) return;

          rows.push({
            id: task.id || `${programme.id}-${task.name || task.title || task.task_name || rows.length}`,
            title: task.name || task.title || task.task_name || 'Programme task',
            projectLabel,
            programmeLabel: programme.filename || programme.name || 'Programme',
            dateValue,
            dateTime: date.getTime(),
            status: task.is_tracked ? 'Tracked' : (task.status || task.owner_tag || 'Upcoming')
          });
        });
      }

      rows.sort((a, b) => a.dateTime - b.dateTime || a.title.localeCompare(b.title));
      setProgrammeLookaheadItems(rows.slice(0, 6));
    } catch (error) {
      setProgrammeLookaheadItems([]);
      setProgrammeLookaheadError('Programme lookahead unavailable');
    } finally {
      setProgrammeLookaheadLoading(false);
    }
  }, [projects, selectedProject]);

  const fetchGates = useCallback(async () => {
    if (!selectedProject) return;
    try {
      const res = await gatesApi.getAll({ project_id: selectedProject });
      const items = Array.isArray(res.data) ? res.data : (res.data?.value || []);
      setGates(items.filter(g => g.status !== 'COMPLETED'));
    } catch (error) {
      setDraftStatus('Related roadblocks could not be loaded.');
      setGates([]);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (loading) return;

    const params = new URLSearchParams(window.location.search);

    if (selectedProject) {
      params.set('project', selectedProject);
    } else {
      params.delete('project');
    }

    if (selectedDate) {
      params.set('date', selectedDate);
    } else {
      params.delete('date');
    }

    const nextQuery = params.toString();
    const nextPath = nextQuery
      ? '/diary?' + nextQuery
      : '/diary';

    window.history.replaceState({}, '', nextPath);
  }, [loading, selectedProject, selectedDate]);
  // diary-context-url-persistence-v8-9j2-2

  useEffect(() => {
    if (selectedProject) {
      fetchDiary();
      fetchLabourRows();
      fetchSiteResources();
      fetchGates();
      fetchProgrammeLookahead();

      const quickKey = getDiaryDraftKey('quick_entry');
      const draft = readDiaryDraft('quick_entry');
      if (draft?.entryData && String(draft.entryData.note || '').trim()) {
        setEntryData((current) => ({ ...current, ...draft.entryData }));
        setDraftStatus('Capture activity draft restored on this device');
      }
      quickEntryDraftReadyRef.current = quickKey;
    }
  }, [selectedProject, selectedDate, fetchDiary, fetchLabourRows, fetchSiteResources, fetchGates, fetchProgrammeLookahead]);

  useEffect(() => {
    const key = getDiaryDraftKey('labour');
    if (!key || labourDraftReadyRef.current !== key || labourSaving || labourLoading) return;
    if (hasMeaningfulLabourRows(labourRows)) {
      writeDiaryDraft('labour', { rows: labourRows }); // diary-draft-autosave-v1-labour
    }
  }, [labourRows, selectedProject, selectedDate, labourSaving, labourLoading]);

  useEffect(() => {
    const key = getDiaryDraftKey('resources');
    if (!resourcesEditMode || !key || resourcesDraftReadyRef.current !== key || resourcesSaving || resourcesLoading) return;
    if (hasMeaningfulResourceRows(siteResources)) {
      writeDiaryDraft('resources', { resources: siteResources }); // diary-draft-autosave-v1-resources
    }
  }, [siteResources, selectedProject, selectedDate, resourcesSaving, resourcesLoading, resourcesEditMode]); // resource-draft-edit-mode-only-v8-9k2-3

  useEffect(() => {
    if (!labourEditMode || activeLabourIndex === null) return undefined;

    document.body.style.overflow = '';
    document.body.style.touchAction = '';

    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [labourEditMode, activeLabourIndex]); // staff-diary-mobile-scroll-unlocked-v2

  useEffect(() => {
    const key = getDiaryDraftKey('quick_entry');
    if (!key || quickEntryDraftReadyRef.current !== key || submitting) return;
    if (String(entryData.note || '').trim() || (Array.isArray(entryData.photos) && entryData.photos.length > 0)) {
      writeDiaryDraft('quick_entry', { entryData }); // diary-draft-autosave-v1-quick-entry
    }
  }, [entryData, selectedProject, selectedDate, submitting]);

  useEffect(() => {
    const key = getDiaryDraftKey('labour');

    if (
      !key ||
      labourDraftReadyRef.current !== key ||
      labourLoading ||
      labourSaveInFlightRef.current
    ) {
      return undefined;
    }

    if (
      !selectedProject ||
      !selectedDate ||
      !hasMeaningfulLabourRows(labourRows)
    ) {
      return undefined;
    }

    const pendingRows = labourRows
      .filter((row) => [
        row.employee_name,
        row.start_time,
        row.finish_time,
        row.job_number,
        row.task_code,
        row.description,
        row.other
      ].some((value) => String(value || '').trim()))
      .map((row) => normaliseLabourRow({
        ...row,
        source: 'LLD',
        source_diary_project_id: selectedProject,
        source_diary_date: selectedDate,
        sync_status: 'diary_check_only',
        project_manager_id: ''
      }));

    const pendingPayload = JSON.stringify(pendingRows);
    if (pendingPayload === labourLastSavedPayloadRef.current) {
      setLabourSaveStatus('Saved');
      return undefined;
    }

    setLabourSaveStatus('Auto-saving...');

    if (labourServerAutosaveTimerRef.current) {
      window.clearTimeout(labourServerAutosaveTimerRef.current);
    }

    labourServerAutosaveTimerRef.current = window.setTimeout(() => {
      if (labourSaveInFlightRef.current) {
        return;
      }

      saveLabourRows({ silent: true });
    }, 900);

    return () => {
      if (labourServerAutosaveTimerRef.current) {
        window.clearTimeout(labourServerAutosaveTimerRef.current);
      }
    };
  }, [labourRows, selectedProject, selectedDate, labourLoading]); // staff-diary-backend-autosave-v4

  const changeDate = (days) => {
    const current = parseDateInput(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(formatDateInput(current));
  };

  const selectDate = (dateValue) => {
    const nextDate = String(dateValue || '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return;
    if (nextDate > today) return;

    setSelectedDate(nextDate);
  }; // quick-date-picker-v8-9i1

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
  const normaliseDiaryItemKey = (value) => String(value || '').trim().toLowerCase();
  const walkaroundNoteKeys = new Set((Array.isArray(diary?.walkaround_entries) ? diary.walkaround_entries : []).map((entry) => normaliseDiaryItemKey(entry.note)).filter(Boolean)); // diary-init-order-fix-v1
  const visibleRaisedActionItems = openActionItems.filter((item) => !walkaroundNoteKeys.has(normaliseDiaryItemKey(item.title || item.task_name || item.name || item.note)));
  const visibleRaisedActionItemsCount = visibleRaisedActionItems.length; // diary-carry-forward-followups-v1 keeps prior unresolved items visible until completed

  const getHumanDiaryActionTitle = (item = {}) => {
    const raw = String(item.title || item.task_name || item.name || item.description || item.note || item.details || '').trim();

    if (!raw) {
      return 'Follow-up item';
    }

    const structuredSource = String(item.description || item.note || item.details || item.title || '').trim();
    const source = structuredSource.includes('WALKAROUND CAPTURE -') || structuredSource.includes('CAPTURE SITE ACTIVITY -')
      ? structuredSource
      : raw;

    if (source.includes('WALKAROUND CAPTURE -') || source.includes('CAPTURE SITE ACTIVITY -')) {
      const cleaned = source
        .split(/\r?\n/)
        .filter((line) => !/^WALKAROUND CAPTURE - /i.test(line))
        .filter((line) => !/^CAPTURE SITE ACTIVITY - /i.test(line))
        .filter((line) => !/^PRIORITY - /i.test(line))
        .filter((line) => !/^NEEDS SENDING - /i.test(line))
        .filter((line) => !/^ACTION - /i.test(line))
        .filter((line) => !/^SORT TO - /i.test(line))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleaned) {
        return cleaned;
      }
    }

    return raw
      .replace(/^WALKAROUND CAPTURE\s*-\s*/i, '')
      .replace(/^CAPTURE SITE ACTIVITY\s*-\s*/i, '')
      .replace(/\s+PRIORITY\s*-\s*/i, ' | Priority: ')
      .replace(/\s+NEEDS SENDING\s*-\s*/i, ' | Send: ')
      .replace(/\s+ACTION\s*-\s*/i, ' | Action: ')
      .replace(/\s+SORT TO\s*-\s*/i, ' | ')
      .replace(/\s+/g, ' ')
      .trim() || 'Follow-up item';
  }; // diary-epic-human-action-titles-v1

  const prepareBinderActionItems = (items = []) => (
    (Array.isArray(items) ? items : []).map((item) => ({
      ...item,
      binder_display_title: getHumanDiaryActionTitle(item)
    }))
  ); // diary-binder-shared-canonical-title-v8-9d4

  const requestDiaryFollowUpConfirm = (mode, item) => {
    if (!item?.id) {
      return;
    }

    const label =
      item.binder_display_title ||
      getHumanDiaryActionTitle(item) ||
      "this follow-up";
    setFollowUpConfirm({ mode, item, label });
  }; // diary-followup-app-confirm-v1-request

  const handleCompleteFollowUpFromDiary = (item) => {
    requestDiaryFollowUpConfirm("close", item);
  }; // diary-complete-carry-forward-v6 diary-close-out-wording-v1

  const handleReopenClosedOutFromDiary = (item) => {
    requestDiaryFollowUpConfirm("reopen", item);
  }; // diary-closed-out-reopen-v2

  const executeDiaryFollowUpConfirm = async () => {
    if (!followUpConfirm?.item?.id || followUpConfirmSaving) {
      return;
    }

    setFollowUpConfirmSaving(true);

    try {
      if (followUpConfirm.mode === "reopen") {
        await actionItemsApi.reopen(followUpConfirm.item.id);
        toast.success("Follow-up reopened");
      } else {
        await actionItemsApi.complete(followUpConfirm.item.id);
        toast.success("Follow-up closed out");
      }

      setFollowUpConfirm(null);
      window.location.reload();
    } catch (error) {
      toast.error(followUpConfirm.mode === "reopen"
        ? "Could not reopen this follow-up. Refresh and try again."
        : "Could not close out this follow-up. Refresh and try again."
      );
    } finally {
      setFollowUpConfirmSaving(false);
    }
  }; // diary-followup-app-confirm-v1-execute

  const getDiaryFollowupRawDate = (item) => {
    if (!item) {
      return null;
    }

    return item.created_at || item.createdAt || item.created_date || item.createdDate || item.raised_at || item.raisedAt || item.opened_at || item.openedAt || item.date || item.diary_date || null;
  };

  const getDiaryFollowupAgeLabel = (item) => {
    const rawDate = getDiaryFollowupRawDate(item);

    if (!rawDate) {
      return "Age unknown";
    }

    const openedDate = new Date(rawDate);
    const selected = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date();

    if (Number.isNaN(openedDate.getTime()) || Number.isNaN(selected.getTime())) {
      return "Age unknown";
    }

    const openedDay = new Date(openedDate.getFullYear(), openedDate.getMonth(), openedDate.getDate());
    const selectedDay = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate());
    const ageDays = Math.max(0, Math.round((selectedDay - openedDay) / 86400000));
    const sinceLabel = openedDate.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });

    if (ageDays === 0) {
      return "Open today";
    }

    if (ageDays === 1) {
      return "1 day open";
    }

    return `${ageDays} days open`;
  };

  const getDiaryFollowupSourceLabel = (item) => {
    const sourceText = [
      item?.source,
      item?.source_type,
      item?.sourceType,
      item?.origin,
      item?.origin_type,
      item?.created_from,
      item?.createdFrom,
      item?.entry_type,
      item?.entryType,
      item?.type,
      item?.category
    ].filter(Boolean).join(" ").toLowerCase();

    if (item?.walkaround_id || item?.walkaroundId || sourceText.includes("walkaround") || sourceText.includes("walk around")) {
      return "Walkaround";
    }

    if (item?.diary_id || item?.diaryId || sourceText.includes("diary")) {
      return "Diary";
    }

    if (sourceText.includes("action")) {
      return "Action item";
    }

    return "Follow-up";
  };

  const getOpenFollowupMetaParts = (item) => ([
    item.project_name || item.project?.name,
    item.owner,
    item.priority,
    getDiaryFollowupAgeLabel(item),
    getDiaryFollowupSourceLabel(item)
  ].filter(Boolean)); // diary-followup-age-source-v1 diary-followup-metadata-compact-v2

  const getClosedFollowupMetaParts = (item) => ([
    item.project_name || item.project?.name,
    item.owner,
    item.priority,
    "Closed today",
    getDiaryFollowupSourceLabel(item)
  ].filter(Boolean)); // diary-followup-age-source-v1 diary-followup-metadata-compact-v2
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

  const binderUrgentItems = prepareBinderActionItems([
    ...overdueDiaryItems,
    ...dueTodayItems
  ]);

  const binderTaskItems = prepareBinderActionItems(
    visibleRaisedActionItems
  );

  const [activeDiaryView, setActiveDiaryView] = useState(() => {
    if (typeof window === 'undefined') return 'overview';
    return new URLSearchParams(window.location.search).get('view') || 'overview';
  });
  const [lastCaptureResult, setLastCaptureResult] = useState(null);
  const [quickWalkaroundItems, setQuickWalkaroundItems] = useState([]); // diary-quick-walkaround-v1

  const diaryViewLabels = {
    overview: 'Overview',
    'site-notes': 'Site Notes',
    resources: 'Resources',
    staff: 'Staff',
    rfis: 'RFIs',
  }; // diary-nav-post-capture-v4

  const openDiarySection = (sectionId, tab = null) => {
    if (tab) setActiveResourceTab(tab);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = document.getElementById(sectionId);
        if (!target) return;

        const stickyHeaderOffset = window.innerWidth < 768 ? 168 : 48; // premium-diary-detail-scroll-v1e
        const targetTop = target.getBoundingClientRect().top + window.scrollY - stickyHeaderOffset;

        window.scrollTo({
          top: Math.max(targetTop, 0),
          behavior: 'smooth',
        });
      });
    });
  };

  const openDiaryView = (view = 'overview', tab = null) => {
    const safeView = view || 'overview';
    const isBinderCloseout = safeView === 'overview' && tab === 'closeout';

    if (!isBinderCloseout) {
      setFullDiaryOpen(true);
    }

    setActiveDiaryView(safeView);

    const params = new URLSearchParams(window.location.search);
    params.set('view', safeView);

    if (selectedProject) {
      params.set('project', selectedProject);
    } else {
      params.delete('project');
    }

    if (selectedDate) {
      params.set('date', selectedDate);
    } else {
      params.delete('date');
    }

    // diary-open-view-explicit-context-v8-9j8-4
    if (tab) {
      params.set('tab', tab);
    } else {
      params.delete('tab');
    }

    window.history.pushState({}, '', `/diary?${params.toString()}`);
    window.dispatchEvent(new Event('lld-binder-url-change'));
    // binder-url-tab-sync-v8-9j4-2

    const targetMap = {
      overview: tab === 'closeout' ? 'diary-binder-top' : 'daily-report-readiness', // day-review-landing-scroll-v8-9k1-1
      'site-notes': 'diary-work-section',
      resources: 'diary-resources-section',
      staff: 'diary-staff-section',
      rfis: 'diary-queries-section',
    };

    const target = targetMap[safeView] || 'daily-report-readiness';
    openDiarySection(target, tab);
  }; // diary-nav-post-capture-v4

  const closeFullDiaryRecord = () => {
    setFullDiaryOpen(false);

    const params = new URLSearchParams(window.location.search);
    params.delete('view');

    window.history.pushState(
      {},
      '',
      `/diary${params.toString() ? `?${params.toString()}` : ''}`
    );

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }; // premium-diary-detail-disclosure-v1e

  const getCaptureDiaryView = (capture) => {
    if (!capture) return 'overview';
    const entryType = String(capture.entry_type || '').toLowerCase();
    if (entryType.includes('material') || entryType.includes('plant') || entryType.includes('resource')) return 'resources';
    if (entryType.includes('staff') || entryType.includes('labour') || entryType.includes('labor')) return 'staff';
    if (entryType.includes('rfi') || entryType.includes('query')) return 'rfis';
    return 'site-notes';
  }; // diary-nav-post-capture-v4

  const openActionItemsPage = (section = null, create = false) => {
    const params = new URLSearchParams();
    if (selectedProject) params.set('project', selectedProject);
    if (section) params.set('section', section);
    if (create) params.set('create', '1');
    window.location.assign(`/action-items?${params.toString()}`);
  };

  const openRoadblockCreateFlow = () => {
    const params = new URLSearchParams();
    params.set('create', '1');
    if (selectedProject) params.set('project', selectedProject);
    window.location.assign(`/roadblocks?${params.toString()}`); // diary-direct-roadblock-create-v1
  };

  const openRoadblocksPage = () => {
    const params = new URLSearchParams();
    if (selectedProject) params.set('project', selectedProject);
    window.location.assign(`/roadblocks?${params.toString()}`);
  }; // diary-nav-post-capture-v4

  const openDiaryRoadblock = (roadblock) => {
    if (!roadblock?.id) return;
    setSelectedDiaryRoadblock(roadblock);
  }; // diary-binder-real-roadblocks-v8-9e1

  const closeDiaryRoadblock = () => {
    setSelectedDiaryRoadblock(null);
  }; // diary-binder-real-roadblocks-v8-9e1

  // binder-native-roadblocks-v2s2f
  const [roadblockSaving, setRoadblockSaving] = useState(false);

  const saveBinderRoadblock = async (draft = {}, roadblockId = null) => {
    if (!selectedProject) {
      toast.error('Select a project first');
      return false;
    }

    const name = String(draft.name || '').trim();

    if (!name) {
      toast.error('Add a Roadblock / Concern title');
      return false;
    }

    const payload = {
      project_id: selectedProject,
      name,
      description: String(draft.description || '').trim(),
      order: Number.isFinite(Number(draft.order))
        ? Number(draft.order)
        : 0,
      owner_party: String(draft.owner_party || 'YOU').trim() || 'YOU',
      required_by_date: draft.required_by_date || null,
      expected_complete_date: draft.expected_complete_date || null,
      buffer_days: Number.isFinite(Number(draft.buffer_days))
        ? Number(draft.buffer_days)
        : 2,
      depends_on_gate_ids: Array.isArray(draft.depends_on_gate_ids)
        ? draft.depends_on_gate_ids
        : [],
      is_hard_gate: Boolean(draft.is_hard_gate),
      is_optional: Boolean(draft.is_optional)
    };

    setRoadblockSaving(true);

    try {
      if (roadblockId) {
        const response = await gatesApi.update(roadblockId, payload);
        const updated = response?.data || {
          ...draft,
          ...payload,
          id: roadblockId
        };

        setSelectedDiaryRoadblock((current) => ({
          ...(current || {}),
          ...updated,
          ...payload,
          id: roadblockId
        }));

        toast.success('Roadblock updated');
      } else {
        await gatesApi.create(payload);
        toast.success('Roadblock added');
      }

      await Promise.all([fetchDiary(), fetchGates()]);
      return true;
    } catch (error) {
      toast.error(
        error?.response?.data?.detail ||
        'Failed to save Roadblock'
      );
      return false;
    } finally {
      setRoadblockSaving(false);
    }
  };

  const completeBinderRoadblock = async (roadblock) => {
    if (!roadblock?.id) return false;

    setRoadblockSaving(true);

    try {
      await gatesApi.complete(roadblock.id);

      setSelectedDiaryRoadblock((current) => current ? {
        ...current,
        status: 'COMPLETED'
      } : current);

      toast.success('Roadblock marked complete');
      await Promise.all([fetchDiary(), fetchGates()]);
      return true;
    } catch (error) {
      toast.error(
        error?.response?.data?.detail ||
        'Failed to complete Roadblock'
      );
      return false;
    } finally {
      setRoadblockSaving(false);
    }
  };

  const reopenBinderRoadblock = async (roadblock) => {
    if (!roadblock?.id) return false;

    setRoadblockSaving(true);

    try {
      await gatesApi.reopen(roadblock.id);

      setSelectedDiaryRoadblock((current) => current ? {
        ...current,
        status: 'ON_TRACK'
      } : current);

      toast.success('Roadblock reopened');
      await Promise.all([fetchDiary(), fetchGates()]);
      return true;
    } catch (error) {
      toast.error(
        error?.response?.data?.detail ||
        'Failed to reopen Roadblock'
      );
      return false;
    } finally {
      setRoadblockSaving(false);
    }
  };

  // binder-native-walkaround-save-v2s2g1
const [walkaroundSaving, setWalkaroundSaving] = useState(false);
const saveBinderWalkaround = async (draft = {}) => {
  if (!selectedProject) { toast.error('Select a project first'); return false; }
  const observation = String(draft.observation || '').trim();
  if (!observation) { toast.error('Add the site observation'); return false; }
  const categoryLabels = { progress:'Progress', labour:'Labour', materials_plant:'Materials / Plant', question_rfi:'Question / RFI', issue_defect:'Issue / Defect', clash_holdup:'Clash / Hold Up', health_safety:'H&S', staff_message:'Staff Message', general_note:'General Note' };
  const sendLabels = { none:'No', staff:'Staff', builder:'Builder', client:'Client', architect:'Architect', supplier:'Supplier', subbie:'Subbie', email_draft:'Email Draft' };
  const category = draft.category || 'general_note';
  const sendTo = draft.send_to || 'none';
  const needsAction = sendTo !== 'none' || ['materials_plant','question_rfi','issue_defect','clash_holdup','health_safety','staff_message'].includes(category);
  const actionType = sendTo !== 'none' ? 'email' : category === 'health_safety' ? 'formal' : needsAction ? 'followup' : 'none';
  const buckets = [];
  if (['critical','high'].includes(draft.priority)) buckets.push('High Priority');
  if (sendTo !== 'none') buckets.push('Needs Sending');
  if (category === 'question_rfi') buckets.push('Questions / RFIs');
  if (category === 'clash_holdup') buckets.push('Roadblocks / Hold Ups');
  if (category === 'materials_plant') buckets.push('Materials / Plant');
  if (category === 'health_safety') buckets.push('H&S');
  if (['staff_message','issue_defect'].includes(category)) buckets.push('To Do / Follow Up');
  if (!buckets.length) buckets.push('Diary Only');
  const note = [`WALKAROUND CAPTURE - ${categoryLabels[category] || 'General Note'}`,`PRIORITY - ${String(draft.priority || 'medium').toUpperCase()}`,`NEEDS SENDING - ${sendLabels[sendTo] || 'No'}`,`ACTION - ${actionType === 'none' ? 'Diary Only' : actionType}`,`SORT TO - ${buckets.join(' | ')}`,'',observation].join('\n');
  setWalkaroundSaving(true);
  try {
    const photos = Array.isArray(draft.photos) ? draft.photos.filter(Boolean) : [];
    await walkaroundApi.create({ project_id:selectedProject, note, priority:draft.priority || 'medium', owner:String(draft.owner || 'Me').trim() || 'Me', due_date:draft.due_date || null, gate_id:'', photos, create_action_item:needsAction, action_type:actionType });
    toast.success('Observation added'); await fetchDiary(); return true;
  } catch (error) { toast.error(error?.response?.data?.detail || 'Failed to save observation'); return false; }
  finally { setWalkaroundSaving(false); }
};
const openQuickCaptureEmailDraft = (capture = lastCaptureResult) => {
    if (!capture) {
      toast.error('No saved capture selected for email draft');
      return;
    }

    const projectLine = capture.job_number || capture.project_name
      ? `${capture.job_number ? `${capture.job_number} - ` : ''}${capture.project_name || 'Project'}`
      : 'Project';
    const subject = encodeURIComponent(`LLD Site Diary Action - ${projectLine} - ${selectedDateLabel}`);
    const body = encodeURIComponent([
      `Project: ${projectLine}`,
      `Date: ${selectedDateLabel}`,
      `Type: ${capture.entry_type || 'note'}`,
      `Priority: ${capture.priority || 'medium'}`,
      `Owner: ${capture.owner || 'Me'}`,
      '',
      'Diary capture:',
      capture.note || '',
      '',
      'Action required:',
      capture.needs_action ? (capture.action_type || 'todo') : 'No',
      '',
      'Sent from Long Line Diary.'
    ].join('\n'));

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }; // diary-nav-post-capture-v4

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

  const updateIssueRecorderData = (field, value) => {
    setIssueRecorderData((current) => ({
      ...current,
      [field]: value
    }));
  }; // onsite-issue-recorder-v1

  const handleIssueRecorderPhotoUpload = (event) => {
    const files = Array.from(event.target.files || []);
    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Issue photo must be under 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setIssueRecorderData((current) => ({
          ...current,
          photos: [...(Array.isArray(current.photos) ? current.photos : []), reader.result]
        }));
      };
      reader.readAsDataURL(file);
    });

    event.target.value = '';
  }; // onsite-issue-recorder-v1

  const removeIssueRecorderPhoto = (index) => {
    setIssueRecorderData((current) => ({
      ...current,
      photos: (Array.isArray(current.photos) ? current.photos : []).filter((_, photoIndex) => photoIndex !== index)
    }));
  }; // onsite-issue-recorder-v1

  const getIssueTypeLabel = (value) => issueTypeOptions.find((option) => option.value === value)?.label || 'Formal Site Issue';
  const getIssueImpactLabel = (value) => issueImpactOptions.find((option) => option.value === value)?.label || 'Not selected';
  const getIssueActionLabel = (value) => issueActionOptions.find((option) => option.value === value)?.label || 'Not selected';

  const buildIssueRecorderSummary = () => {
    const projectLabel = currentProject
      ? `${currentProject.job_number ? `${currentProject.job_number} - ` : ''}${currentProject.name || 'Selected project'}`
      : 'Selected project';

    return [
      'FORMAL SITE ISSUE',
      `Project: ${projectLabel}`,
      `Date recorded: ${selectedDateLabel}`,
      `Issue type: ${getIssueTypeLabel(issueRecorderData.issue_type)}`,
      `Title: ${issueRecorderData.title || 'Untitled issue'}`,
      `Location: ${issueRecorderData.location || 'Not recorded'}`,
      `Related trade/task: ${issueRecorderData.related_trade || 'Not recorded'}`,
      `Impact: ${getIssueImpactLabel(issueRecorderData.impact)}`,
      `Action required: ${getIssueActionLabel(issueRecorderData.action_required)}`,
      `Response required by: ${issueRecorderData.response_required_by || 'Not set'}`,
      `Owner: ${issueRecorderData.owner || 'Me'}`,
      '',
      'Issue / site condition:',
      issueRecorderData.description || 'No description entered',
      '',
      `Photos recorded in LLD: ${Array.isArray(issueRecorderData.photos) ? issueRecorderData.photos.length : 0}`
    ].join('\n');
  }; // onsite-issue-recorder-v1

  const buildIssueEmailSubject = () => {
    const job = currentProject?.job_number || 'LLD';
    const title = String(issueRecorderData.title || 'Formal site issue').trim();
    return `Site Issue - ${job} - ${title}`;
  }; // onsite-issue-recorder-v1

  const buildIssueEmailBody = () => {
    return [
      buildIssueRecorderSummary(),
      '',
      'Required response:',
      getIssueActionLabel(issueRecorderData.action_required),
      '',
      'Note:',
      'This issue has been recorded in Long Line Diary. Photos are saved against the LLD issue record; attach photos manually if your email client does not include them automatically.'
    ].join('\n');
  }; // onsite-issue-recorder-v1

  const openIssueRecorderEmailDraft = () => {
    const recipients = String(issueRecorderData.recipients || '').trim();
    const subject = encodeURIComponent(buildIssueEmailSubject());
    const body = encodeURIComponent(issueRecorderEmailPreview || buildIssueEmailBody());
    window.location.href = `mailto:${recipients}?subject=${subject}&body=${body}`;
  }; // onsite-issue-recorder-v1

  const resetIssueRecorder = () => {
    setIssueRecorderData(createEmptyIssueRecorderData());
    setIssueRecorderEmailPreview('');
  }; // onsite-issue-recorder-v1

  const handleIssueRecorderSave = async (event) => {
    event.preventDefault();

    if (!String(issueRecorderData.title || '').trim()) {
      toast.error('Add a short issue title');
      return;
    }

    if (!String(issueRecorderData.description || '').trim()) {
      toast.error('Add what happened on site');
      return;
    }

    if (!selectedProject) {
      toast.error('Select a project first');
      return;
    }

    const summary = buildIssueRecorderSummary();
    setIssueRecorderSaving(true);

    try {
      await walkaroundApi.create({
        note: summary,
        priority: issueRecorderData.priority || 'high',
        owner: issueRecorderData.owner || 'Me',
        due_date: issueRecorderData.response_required_by || tomorrow,
        gate_id: '',
        photos: Array.isArray(issueRecorderData.photos) ? issueRecorderData.photos : [],
        create_action_item: true,
        project_id: selectedProject
      });

      const emailBody = buildIssueEmailBody();
      setIssueRecorderEmailPreview(emailBody);
      localStorage.setItem('lld_last_project_id', selectedProject);
      setDraftStatus('Formal site issue saved to LLD');
      toast.success('Formal site issue saved. Review the email draft before sending.');
      fetchDiary();
    } catch (error) {
      toast.error('Failed to save formal site issue');
    } finally {
      setIssueRecorderSaving(false);
    }
  }; // onsite-issue-recorder-v1

  const handleQuickEntry = async (e) => {
    e.preventDefault();

    if (!entryData.note.trim()) {
      toast.error('Please enter a note');
      noteInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const sendTo = entryData.send_to || 'none';
      const derivedActionType = getSmartCaptureActionType(entryData.entry_type, sendTo);
      const needsAction = derivedActionType !== 'none';
      const sortedBuckets = getWorkThroughBuckets(entryData.entry_type, sendTo, entryData.priority);
      const captureNote = buildSmartCaptureNote();
      const savedCaptureResult = {
        note: captureNote,
        raw_note: entryData.note,
        entry_type: entryData.entry_type,
        needs_action: needsAction,
        action_type: derivedActionType,
        send_to: sendTo,
        priority: entryData.priority || 'medium',
        owner: entryData.owner || 'Me',
        due_date: entryData.due_date,
        project_id: selectedProject,
        project_name: currentProject?.name || '',
        job_number: currentProject?.job_number || '',
        saved_at: new Date().toISOString(),
        has_photos: Array.isArray(entryData.photos) && entryData.photos.length > 0,
        work_through_buckets: sortedBuckets,
      }; // diary-quick-walkaround-v1

      await walkaroundApi.create({
        ...entryData,
        note: captureNote,
        create_action_item: needsAction,
        action_type: derivedActionType,
        project_id: selectedProject
      }); // diary-command-centre-ux-v1 diary-quick-walkaround-v1

      setQuickWalkaroundItems((prev) => [savedCaptureResult, ...prev].slice(0, 12));
      setLastCaptureResult(savedCaptureResult);
      localStorage.setItem('lld_last_project_id', selectedProject);
      clearDiaryDraft('quick_entry');
      setDraftStatus('Diary entry saved - choose next action');
      toast.success('Entry captured. Choose the next action below.');


      // Reset form
      setEntryData({
        note: '',
        entry_type: 'general_note', // diary-quick-walkaround-v1
        needs_action: false,
        action_type: 'none',
        priority: 'medium',
        owner: 'Me',
        due_date: tomorrow,
        gate_id: '',
        photos: [],
        create_action_item: false,
        send_to: 'none'
      });

      // Refresh diary
      fetchDiary();
    fetchLabourRows();
      setShowQuickEntry(true); // diary-quick-walkaround-persistent-queue-v1
    } catch (error) {
      toast.error('Failed to save entry');
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

  const smartCaptureOptions = [
    { value: 'progress', label: 'Progress', hint: 'Work done or progress made' },
    { value: 'labour', label: 'Labour', hint: 'Who is on site / crew numbers' },
    { value: 'materials_plant', label: 'Materials / Plant', hint: 'Materials, plant, deliveries, requests' },
    { value: 'question_rfi', label: 'Question / RFI', hint: 'Answer, design info, or formal RFI needed' },
    { value: 'issue_defect', label: 'Issue / Defect', hint: 'Quality issue, damage, rework, defect' },
    { value: 'clash_holdup', label: 'Clash / Hold Up', hint: 'Trade clash, blocked area, delay' },
    { value: 'health_safety', label: 'H&S', hint: 'Hazard, access, housekeeping, safety' },
    { value: 'staff_message', label: 'Staff Message', hint: 'Information or instruction for staff' },
    { value: 'general_note', label: 'General Note', hint: 'Diary evidence only' }
  ]; // diary-quick-walkaround-v1

  const sendToOptions = [
    { value: 'none', label: 'No' },
    { value: 'staff', label: 'Staff' },
    { value: 'builder', label: 'Builder' },
    { value: 'client', label: 'Client' },
    { value: 'architect', label: 'Architect' },
    { value: 'supplier', label: 'Supplier' },
    { value: 'subbie', label: 'Subbie' },
    { value: 'email_draft', label: 'Email Draft' }
  ]; // diary-quick-walkaround-v1

  const actionOutcomeOptions = [
    { value: 'none', label: 'Diary Only' },
    { value: 'todo', label: 'To Do' },
    { value: 'followup', label: 'Follow Up' },
    { value: 'email', label: 'Needs Sending' },
    { value: 'formal', label: 'Formal Issue' }
  ]; // diary-quick-walkaround-v1

  const getSmartCaptureActionType = (category, sendTo = 'none') => {
    if (sendTo && sendTo !== 'none') return 'email';
    if (category === 'materials_plant') return 'todo';
    if (category === 'question_rfi') return 'followup';
    if (category === 'issue_defect') return 'followup';
    if (category === 'clash_holdup') return 'followup';
    if (category === 'health_safety') return 'formal';
    if (category === 'staff_message') return 'todo';
    return 'none';
  }; // diary-quick-walkaround-v1

  const getWorkThroughBuckets = (category, sendTo = 'none', priority = 'medium') => {
    const buckets = [];
    if (priority === 'urgent' || priority === 'high') buckets.push('High Priority');
    if (sendTo && sendTo !== 'none') buckets.push('Needs Sending');
    if (category === 'question_rfi') buckets.push('Questions / RFIs');
    if (category === 'clash_holdup') buckets.push('Roadblocks / Hold Ups');
    if (category === 'materials_plant') buckets.push('Materials / Plant');
    if (category === 'health_safety') buckets.push('H&S');
    if (category === 'staff_message') buckets.push('To Do / Follow Up');
    if (buckets.length === 0) buckets.push('Diary Only');
    return buckets;
  }; // diary-quick-walkaround-v1

  const selectedSmartCaptureOption = smartCaptureOptions.find((option) => option.value === entryData.entry_type) || smartCaptureOptions[smartCaptureOptions.length - 1];
  const selectedSendToOption = sendToOptions.find((option) => option.value === (entryData.send_to || 'none')) || sendToOptions[0];
  const selectedPriorityOption = priorityOptions.find((option) => option.value === entryData.priority) || priorityOptions[1];
  const derivedSmartActionType = getSmartCaptureActionType(entryData.entry_type, entryData.send_to || 'none');
  const selectedActionOutcomeOption = actionOutcomeOptions.find((option) => option.value === derivedSmartActionType) || actionOutcomeOptions[0];
  const workThroughBuckets = getWorkThroughBuckets(entryData.entry_type, entryData.send_to || 'none', entryData.priority);

  const buildSmartCaptureNote = () => [
    `WALKAROUND CAPTURE - ${selectedSmartCaptureOption.label}`,
    `PRIORITY - ${selectedPriorityOption.label || entryData.priority}`,
    `NEEDS SENDING - ${selectedSendToOption.label}`,
    `ACTION - ${selectedActionOutcomeOption.label}`,
    `SORT TO - ${workThroughBuckets.join(' | ')}`,
    '',
    String(entryData.note || '').trim()
  ].filter(Boolean).join('\n'); // diary-quick-walkaround-v1

  const issueTypeOptions = [
    { value: 'delay', label: 'Delay / Roadblock' },
    { value: 'rfi', label: 'RFI / Clarification' },
    { value: 'defect', label: 'Defect / Quality Issue' },
    { value: 'safety', label: 'Safety Concern' },
    { value: 'access', label: 'Access Issue' },
    { value: 'material', label: 'Material Issue' },
    { value: 'design', label: 'Design Conflict' },
    { value: 'instruction', label: 'Client / Consultant Instruction' },
    { value: 'subcontractor', label: 'Subcontractor Issue' },
    { value: 'other', label: 'Other Site Issue' }
  ]; // onsite-issue-recorder-v1

  const issueImpactOptions = [
    { value: 'none', label: 'No impact yet' },
    { value: 'cost', label: 'Cost impact possible' },
    { value: 'programme', label: 'Programme impact possible' },
    { value: 'work-stopped', label: 'Work stopped' },
    { value: 'work-slowed', label: 'Work slowed' },
    { value: 'instruction-required', label: 'Instruction required' },
    { value: 'variation', label: 'Variation possible' }
  ]; // onsite-issue-recorder-v1

  const issueActionOptions = [
    { value: 'info-only', label: 'Information only' },
    { value: 'please-confirm', label: 'Please confirm' },
    { value: 'please-instruct', label: 'Please instruct' },
    { value: 'please-price', label: 'Please price' },
    { value: 'please-attend', label: 'Please attend site' },
    { value: 'please-approve', label: 'Please approve' },
    { value: 'please-resolve', label: 'Please resolve by due date' }
  ]; // onsite-issue-recorder-v1

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

  const walkaroundEntries = Array.isArray(diary?.walkaround_entries) ? diary.walkaround_entries : [];
  const walkaroundEntriesCount = walkaroundEntries.length;

  const parseQuickWalkaroundQueueItem = (entry = {}) => {
    const note = String(entry?.note || '');
    if (!note.includes('WALKAROUND CAPTURE -')) return null;

    const lines = note.split(/\r?\n/);
    const getLineValue = (prefix) => {
      const found = lines.find((line) => String(line || '').startsWith(prefix));
      return found ? String(found).slice(prefix.length).trim() : '';
    };

    const blankIndex = lines.findIndex((line, index) => index > 0 && !String(line || '').trim());
    const rawNote = blankIndex >= 0 ? lines.slice(blankIndex + 1).join('\n').trim() : note;
    const sortTo = getLineValue('SORT TO - ');
    const buckets = sortTo ? sortTo.split('|').map((bucket) => bucket.trim()).filter(Boolean) : ['Diary Only'];
    const category = getLineValue('WALKAROUND CAPTURE - ') || 'Walkaround Item';
    const priority = getLineValue('PRIORITY - ') || entry.priority || 'medium';
    const actionType = getLineValue('ACTION - ') || entry.action_type || 'Diary Only';
    const sendTo = getLineValue('NEEDS SENDING - ') || entry.send_to || 'No';

    return {
      ...entry,
      title: category,
      display_title: category,
      display_note: rawNote || note,
      raw_note: rawNote || note,
      work_through_buckets: buckets.length > 0 ? buckets : ['Diary Only'],
      priority: String(priority).toLowerCase(),
      action_type: actionType,
      send_to: sendTo,
      saved_at: entry.created_at || entry.saved_at || entry.date || ''
    };
  }; // diary-quick-walkaround-persistent-queue-v1 diary-walkaround-queue-clean-actionable-v1

  const persistentQuickWalkaroundItems = (() => {
    const savedItems = walkaroundEntries.map(parseQuickWalkaroundQueueItem).filter(Boolean);
    const combined = [...quickWalkaroundItems, ...savedItems];
    const seen = new Set();

    return combined.filter((item) => {
      const key = String(item.raw_note || item.note || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 12);
  })(); // diary-quick-walkaround-persistent-queue-v1

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
    title: getHumanDiaryActionTitle(item),
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
  }; // diary-binder-native-action-detail-v8-9a6
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
      toast.error('Failed to update follow-up');
    } finally {
      setDiaryActionSaving(false);
    }
  };

  const completeSelectedDiaryActionItem = () => {
    if (!selectedDiaryActionItem?.id) return;

    handleCompleteFollowUpFromDiary(selectedDiaryActionItem);
  }; // diary-binder-native-action-confirmation-v8-9a6
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
      toast.error('Failed to reopen follow-up');
    } finally {
      setDiaryActionSaving(false);
    }
  };

  const closeDiaryActionItem = () => {
    setSelectedDiaryActionItem(null);
    setSelectedDiaryActionDraft(null);
  }; // diary-binder-native-action-close-v8-9a6

  // binder-native-communication-create-v2s2e
  const saveBinderCommunication = async (draft = {}) => {
    if (!selectedProject || !selectedDate) {
      toast.error('Select a project and diary date first');
      return false;
    }

    const type = String(draft.type || 'Email').trim();
    const contact = String(draft.contact || '').trim();
    const subject = String(draft.subject || '').trim();
    const notes = String(draft.notes || '').trim();
    const owner = String(draft.owner || '').trim();
    const dueDate = String(draft.due_date || '').trim();
    const followUpRequired = Boolean(draft.follow_up_required);

    if (!subject) {
      toast.error('Add a subject for the communication');
      return false;
    }

    if (followUpRequired && (!owner || !dueDate)) {
      toast.error('Add an owner and due date for the follow-up');
      return false;
    }

    const description = [
      `Communication type: ${type}`,
      contact ? `With: ${contact}` : '',
      notes ? `Notes / outcome: ${notes}` : '',
      followUpRequired
        ? 'Follow-up required'
        : 'No follow-up required'
    ].filter(Boolean).join('\n');

    const payload = {
      project_id: selectedProject,
      title: `${type} · ${subject}`,
      description,
      priority: followUpRequired ? 'medium' : 'low',
      due_date: followUpRequired ? dueDate : selectedDate,
      expected_complete_date: followUpRequired ? dueDate : null,
      owner: followUpRequired ? owner : ''
    };

    setCommunicationSaving(true);

    try {
      const createdResponse = await actionItemsApi.create(payload);
      const created = createdResponse?.data;

      if (!created?.id) {
        throw new Error('Created communication returned no action item ID');
      }

      if (!followUpRequired) {
        try {
          await actionItemsApi.complete(created.id);
        } catch (completeError) {
          toast.warning(
            'Communication was saved, but could not be closed automatically. It remains an open follow-up.'
          );

          await fetchDiary();
          return true;
        }
      }

      toast.success(
        followUpRequired
          ? 'Communication saved with follow-up'
          : 'Communication recorded'
      );

      await fetchDiary();
      return true;
    } catch (error) {
      toast.error(
        error?.response?.data?.detail ||
        'Failed to save communication'
      );
      return false;
    } finally {
      setCommunicationSaving(false);
    }
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
        <p className="empty-state-description">Create a project first to view the site diary.</p>
      </div>
    );
  }

  return (
    <div id="diary-binder-top" className="space-y-4 md:space-y-5 lg:space-y-6" data-testid="diary-page" data-day-review-landing="v8-9k1-1" data-commercial-readiness="diary-natural-look-v1a-header-simple diary-natural-look-v1a-wording-cleanup diary-natural-look-v1b-confirmed-queue-copy diary-natural-look-v1c-safe-cleanup diary-desktop-density-hierarchy-v1 lld-digital-job-binder-live-v1">
      <DigitalJobBinder
        currentProject={currentProject}
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={(projectId) => {
          setSelectedProject(projectId);
          localStorage.setItem('lld_last_project_id', projectId);
        }}
        selectedDateLabel={selectedDateLabel}
        selectedDate={selectedDate}
        today={today}
        draftStatus={draftStatus}
        diaryEntries={walkaroundEntries}
        urgentItems={binderUrgentItems}
        taskItems={binderTaskItems}
        materials={resourceMaterials}
        selectedMaterial={selectedBinderMaterial}
        materialSaving={resourcesSaving}
        onOpenMaterial={openBinderMaterial}
        onAddMaterial={addBinderMaterial}
        onMaterialChange={updateSelectedBinderMaterial}
        onSaveMaterial={saveSelectedBinderMaterial}
        onRemoveMaterial={removeSelectedBinderMaterial}
        onCloseMaterial={closeSelectedBinderMaterial}
        labourCount={labourRows.length}
        labourRows={labourRows}
        staffSaving={labourSaving}
        staffImporting={labourImporting}
        staffSaveStatus={labourSaveStatus}
        weeklyLabour={weeklyLabour}
        weeklyLabourLoading={weeklyLabourLoading}
        weeklyLabourError={weeklyLabourError}
        getStaffEmployeeOptions={employeePickerOptions}
        getStaffJobOptions={jobNumberOptionsForRow}
        getStaffTaskOptions={taskCodeOptionsForRow}
        onAddStaffEmployee={(value) => {
          const employeeOption = resolveEmployeeSelection(value);
          if (employeeOption) {
            addStaffRowFromEmployee(employeeOption);
          }
        }}
        onAddSiteStaff={(name) => {
          addStaffRowFromEmployee({
            employee_id: '',
            employee_name: name,
            linked_to_timesheet: false
          });
        }}
        onStaffEmployeeChange={updateLabourRowEmployee}
        onStaffChange={updateLabourRow}
        onSetAllStaffNormalDay={markAllStaffAtWork}
        onSaveStaff={saveLabourRows}
        onRemoveStaff={removeLabourRow}
        onAddStaffAllocation={addLabourAllocationForStaff}
        onImportStaff={importLabourRowsToTimesheet}
        quickNote={entryData.note}
        diaryDraft={entryData}
        diaryCategoryOptions={smartCaptureOptions}
        diaryPriorityOptions={priorityOptions}
        diarySendToOptions={sendToOptions}
        submitting={submitting}
        onQuickNoteChange={(note) => setEntryData((current) => ({ ...current, note }))}
        onDiaryDraftChange={(field, value) => setEntryData((current) => ({
          ...current,
          [field]: value
        }))}
        onDiaryPhotoUpload={handlePhotoUpload}
        onQuickSubmit={handleQuickEntry}
        onChangeDate={changeDate}
        onSelectDate={selectDate}
        onOpenTasks={() => openActionItemsPage('today', true)}
        onOpenTask={openDiaryActionItem}
        onCompleteTask={handleCompleteFollowUpFromDiary}
        taskCompletionPending={Boolean(followUpConfirm) || followUpConfirmSaving}
        selectedTask={selectedDiaryActionItem}
        selectedTaskDraft={selectedDiaryActionDraft}
        taskDetailSaving={diaryActionSaving}
        onTaskDraftChange={updateSelectedDiaryActionDraft}
        onSaveTask={saveSelectedDiaryActionItem}
        onCompleteSelectedTask={completeSelectedDiaryActionItem}
        onReopenSelectedTask={reopenSelectedDiaryActionItem}
        onCloseTask={closeDiaryActionItem}
        onOpenMaterials={() => openDiaryView('resources', 'materials')}
        communicationItems={communicationItems}
        communicationSaving={communicationSaving}
        onAddCommunication={saveBinderCommunication}
        onOpenEmails={() => openActionItemsPage('today')}
        roadblocks={gates} // binder-project-roadblocks-v2s2f2
        selectedRoadblock={selectedDiaryRoadblock}
        roadblockSaving={roadblockSaving}
        onOpenRoadblock={openDiaryRoadblock}
        onCloseRoadblock={closeDiaryRoadblock}
        onSaveRoadblock={saveBinderRoadblock}
        onCompleteRoadblock={completeBinderRoadblock}
        onReopenRoadblock={reopenBinderRoadblock}
        onOpenRoadblocks={openRoadblocksPage}
        walkaroundSaving={walkaroundSaving}
        onSaveWalkaround={saveBinderWalkaround}
        onOpenWalkaround={() => window.location.assign(`/walkaround${selectedProject ? `?project=${selectedProject}` : ''}`)}
        onOpenPhotos={() => window.location.assign(`/walkaround${selectedProject ? `?project=${selectedProject}` : ''}`)} // photo-evidence-workflow-routing-v8-9g2
        dayReview={diary?.review || null}
        reviewSaving={reviewSaving}
        onMarkDayReviewed={markDayReviewed}
        onReopenDayReview={reopenDayReview}
        onCloseDay={() => openDiaryView('overview', 'closeout')}
        onPrintDiary={handlePrintReport}
        // closeout-full-review-context-v8-9j2-2
      />

      <div
        className={`lld-legacy-diary-details space-y-4 md:space-y-5 lg:space-y-6 ${fullDiaryOpen ? 'is-open' : ''}`}
        aria-hidden={!fullDiaryOpen}
        data-testid="lld-full-diary-record-v1e"
      >
        <div className="lld-full-diary-return-bar">
          <div>
            <span>Full diary record</span>
            <strong>{selectedDateLabel}</strong>
          </div>

          <button type="button" onClick={closeFullDiaryRecord}>
            Close details
          </button>
        </div>

      <div className="rounded-2xl border border-border bg-card/95 p-3 shadow-sm sm:p-4 lg:p-6" data-testid="diary-command-header-v2" data-commercial-readiness="diary-desktop-density-hierarchy-v1">
        <div className="flex flex-col gap-3 lg:gap-4" data-commercial-readiness="diary-top-header-responsive-stack-v1 diary-desktop-density-hierarchy-v1">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary lg:text-xs">Site diary</p>
            <h2 className="font-heading text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl" data-testid="daily-heading-polish-v1-marker" data-commercial-readiness="diary-desktop-density-hierarchy-v1">
              {selectedDateLabel}
            </h2>
            <p className="mt-1 truncate text-sm font-semibold text-muted-foreground lg:text-base">
              {currentProject ? `${currentProject.job_number ? `${currentProject.job_number} - ` : ''}${currentProject.name}` : 'No project selected'}
              {selectedDate === today ? ' | Today' : ''}
              {draftStatus ? ` | ${draftStatus}` : ''}
            </p>
          </div>

          <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 lg:max-w-2xl">
            <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} data-testid="prev-day">
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <Select value={selectedProject} onValueChange={(val) => {
              setSelectedProject(val);
              localStorage.setItem('lld_last_project_id', val);
            }}>
              <SelectTrigger className="w-full min-w-0" data-testid="diary-project-select">
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

          <div className="grid w-full grid-cols-2 gap-2 lg:grid-cols-2 lg:gap-3 xl:grid-cols-4" data-commercial-readiness="diary-above-fold-hierarchy-v1 diary-mobile-density-polish-v2 diary-mobile-action-buttons-wrap-fix-v1 diary-top-header-responsive-stack-v1 diary-desktop-density-hierarchy-v1 diary-action-button-breakpoint-v1 diary-action-button-true-2x2-breakpoint-v2">
            {selectedDate === today && (
              <Button
                onClick={() => setShowQuickEntry(!showQuickEntry)}
                className="col-span-2 min-h-11 justify-center font-black lg:col-span-1 lg:min-h-12 lg:text-base"
                data-testid="quick-entry-btn"
                data-commercial-readiness="diary-above-fold-hierarchy-v1"
              >
                <Plus className="w-4 h-4 mr-2" />
                Write today's diary
              </Button>
            )}
            {selectedDate === today && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowIssueRecorder(true)}
                className="col-span-2 min-h-11 justify-center whitespace-normal text-center text-sm font-black leading-tight lg:col-span-1 lg:min-h-12 lg:text-base"
                data-testid="onsite-issue-recorder-btn"
                data-commercial-readiness="onsite-issue-recorder-v1 diary-above-fold-hierarchy-v1"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Record Formal Site Issue
              </Button>
            )}
            <Button
              type="button"
              variant="default"
              onClick={() => openDiaryView('overview', 'closeout')}
              className="col-span-2 min-h-11 justify-center whitespace-normal text-center text-sm font-black leading-tight lg:col-span-1 lg:min-h-12 lg:text-base"
              data-testid="review-close-day-button"
              data-commercial-readiness="diary-above-fold-hierarchy-v1"
            >
              <FileText className="w-4 h-4 mr-2" />
              Review day
            </Button>
            {/* diary-day-review-primary-action-v8-9k1 */}
            <Button
              type="button"
              variant="outline"
              onClick={handlePrintReport}
              disabled={!diary}
              className="min-h-10 justify-center whitespace-normal text-center text-sm font-black leading-tight sm:min-h-11 lg:min-h-12 lg:text-base"
              data-testid="daily-report-print-button"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>

          <button
            type="button"
            onClick={() => { setStaffSectionExpanded(true); openDiaryView('staff'); }}
            className="mt-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-left shadow-sm transition hover:bg-primary/15 active:scale-[0.99] lg:px-4 lg:py-2"
            data-testid="diary-staff-onsite-top-tab-v1"
            data-commercial-readiness="diary-like-ux-v1 diary-staff-onsite-compact-top-tab-v2"
          >
            <span className="font-heading text-[11px] font-black uppercase tracking-[0.16em] text-primary">Staff on site</span>
            <span className="rounded-full border border-primary/30 bg-background/80 px-2.5 py-0.5 text-xs font-black text-foreground">
              {labourRows.length}
            </span>
          </button>
        </div>
      </div>

      {/* Write today's diary Form - diary-above-fold-hierarchy-v1 */}
      {showQuickEntry && selectedDate === today && (
        <Card className="ops-card border-primary/35 bg-card/95 shadow-sm" data-testid="capture-site-activity-card" data-commercial-readiness="diary-command-centre-ux-v1 diary-natural-look-v1a-header-simple">
          <CardHeader className="ops-card-header border-b border-border/60 bg-secondary/20 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-heading text-[11px] font-black uppercase tracking-[0.18em] text-primary">Today's record</p>
                <CardTitle className="mt-1 font-heading text-xl font-black uppercase tracking-[0.12em] text-foreground flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" />
                  Write today's diary
                </CardTitle>
                <p className="mt-2 max-w-2xl text-sm font-semibold text-muted-foreground">
                  Write what happened on site first. Then add the type, priority, who needs to know, and save it to today's diary.
                </p>
              </div>
              <div className="rounded-2xl border border-primary/25 bg-background/80 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-primary">Write - classify - save</div>
            </div>
          </CardHeader>

          <CardContent className="py-3" data-testid="quick-walkaround-capture-v1" data-commercial-readiness="diary-quick-walkaround-v1">
            <form onSubmit={handleQuickEntry} className="space-y-3">
              <div className="rounded-2xl border border-primary/25 bg-background/95 p-3 shadow-sm">
                <Label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-primary">
                  What happened on site?
                </Label>
                <Textarea
                  ref={noteInputRef}
                  placeholder="Example: L5 framing started, steel delivery late, access blocked, check heights with Daniel..."
                  value={entryData.note}
                  onChange={(e) => setEntryData(prev => ({ ...prev, note: e.target.value }))}
                  className="min-h-[104px] border-primary/30 bg-background text-base shadow-inner focus-visible:ring-primary/40"
                  data-testid="quick-walkaround-note"
                />
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-4" data-testid="quick-walkaround-fields-v1">
                <div>
                  <Label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Category</Label>
                  <Select value={entryData.entry_type} onValueChange={(val) => setEntryData(prev => ({ ...prev, entry_type: val }))}>
                    <SelectTrigger className="h-11 border-primary/25" data-testid="quick-walkaround-category-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {smartCaptureOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Priority</Label>
                  <Select value={entryData.priority} onValueChange={(val) => setEntryData(prev => ({ ...prev, priority: val }))}>
                    <SelectTrigger className="h-11 border-primary/25" data-testid="quick-walkaround-priority-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Needs Sending</Label>
                  <Select value={entryData.send_to || 'none'} onValueChange={(val) => setEntryData(prev => ({ ...prev, send_to: val }))}>
                    <SelectTrigger className="h-11 border-primary/25" data-testid="quick-walkaround-send-to-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sendToOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button type="submit" className="h-11 w-full font-black" disabled={submitting || !entryData.note.trim()} data-testid="quick-walkaround-add-item">
                    {submitting ? 'Adding...' : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Add Item
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-secondary/20 p-3" data-testid="things-to-work-through-v1" data-commercial-readiness="diary-quick-walkaround-v1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-heading text-[11px] font-black uppercase tracking-[0.16em] text-primary">Will sort into</p>
                    <p className="mt-1 text-sm font-black text-foreground">{workThroughBuckets.join(' | ')}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      Action: {selectedActionOutcomeOption.label} | Send: {selectedSendToOption.label}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" capture="environment" multiple className="hidden" data-testid="quick-entry-take-photo-input" />
                    <input type="file" ref={quickUploadInputRef} onChange={handlePhotoUpload} accept="image/*" multiple className="hidden" data-testid="quick-entry-upload-photo-input" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="h-10 rounded-md border border-dashed border-primary/40 px-3 text-xs font-black uppercase tracking-[0.08em] text-primary transition hover:bg-primary/10" data-testid="quick-entry-take-photo">
                      Take Photo
                    </button>
                    <button type="button" onClick={() => quickUploadInputRef.current?.click()} className="h-10 rounded-md border border-dashed border-primary/40 px-3 text-xs font-black uppercase tracking-[0.08em] text-primary transition hover:bg-primary/10" data-testid="quick-entry-upload-photo">
                      Upload
                    </button>
                    {entryData.photos.length > 0 && (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                        {entryData.photos.length} photo{entryData.photos.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </form>

            {quickWalkaroundItems.length > 0 && (
              <div className="mt-3 rounded-2xl border border-primary/25 bg-primary/5 p-3" data-testid="things-to-work-through-list-v1" data-commercial-readiness="diary-quick-walkaround-v1">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-heading text-[11px] font-black uppercase tracking-[0.16em] text-primary">Follow-up from walkaround</p>
                  <span className="text-xs font-black text-muted-foreground">{quickWalkaroundItems.length}</span>
                </div>
                <div className="space-y-2">
                  {quickWalkaroundItems.map((item, index) => (
                    <div key={`${item.saved_at}-${index}`} className="rounded-xl border border-border/70 bg-background/90 p-2 text-sm">
                      <div className="mb-1 flex flex-wrap gap-1">
                        {(item.work_through_buckets || ['Diary Only']).map((bucket) => (
                          <span key={bucket} className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-primary">
                            {bucket}
                          </span>
                        ))}
                      </div>
                      <p className="break-words text-sm font-black leading-5 text-foreground" data-testid="diary-human-followup-titles-v1">{item.display_note || item.raw_note || item.note || item.title || 'Walkaround follow-up'}</p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        {item.display_title || item.title || 'Walkaround Item'} | {item.priority || 'medium'} | {item.action_type || 'none'} | Send: {item.send_to || 'none'}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => openActionItemsPage('today')} data-testid="diary-walkaround-queue-open-action-items-v1">
                          Open Action Items
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => openDiaryView('overview')} data-testid="diary-walkaround-queue-review-diary-v1">
                          Review Diary
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Formal Site Issue Dialog - onsite-issue-recorder-v1 diary-above-fold-hierarchy-v1 */}
      <Dialog open={showIssueRecorder} onOpenChange={setShowIssueRecorder}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" data-testid="onsite-issue-recorder-dialog" data-commercial-readiness="onsite-issue-recorder-v1">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-black uppercase tracking-[0.12em] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Formal Site Issue
            </DialogTitle>
            <p className="text-sm font-semibold text-muted-foreground">
              Guided formal site issue capture for delays, RFIs, defects, safety, access, material, or design problems. Save the record first, then review the email draft.
            </p>
          </DialogHeader>

          <form onSubmit={handleIssueRecorderSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Issue type</Label>
                <select
                  className="input mt-1 min-h-11 w-full border-primary/40 bg-background text-foreground"
                  value={issueRecorderData.issue_type}
                  onChange={(event) => updateIssueRecorderData('issue_type', event.target.value)}
                  data-testid="onsite-issue-type"
                >
                  {issueTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Priority</Label>
                <select
                  className="input mt-1 min-h-11 w-full border-primary/40 bg-background text-foreground"
                  value={issueRecorderData.priority}
                  onChange={(event) => updateIssueRecorderData('priority', event.target.value)}
                  data-testid="onsite-issue-priority"
                >
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Short title</Label>
              <Input
                value={issueRecorderData.title}
                onChange={(event) => updateIssueRecorderData('title', event.target.value)}
                placeholder="Example: Ceiling grid access blocked by scaffold"
                className="mt-1 min-h-11"
                data-testid="onsite-issue-title"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Location / area</Label>
                <Input
                  value={issueRecorderData.location}
                  onChange={(event) => updateIssueRecorderData('location', event.target.value)}
                  placeholder="Level, room, area, gridline"
                  className="mt-1 min-h-11"
                  data-testid="onsite-issue-location"
                />
              </div>

              <div>
                <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Related trade / task</Label>
                <Input
                  value={issueRecorderData.related_trade}
                  onChange={(event) => updateIssueRecorderData('related_trade', event.target.value)}
                  placeholder="Ceilings, wall linings, painting, design, client"
                  className="mt-1 min-h-11"
                  data-testid="onsite-issue-related-trade"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">What happened?</Label>
              <Textarea
                value={issueRecorderData.description}
                onChange={(event) => updateIssueRecorderData('description', event.target.value)}
                placeholder="Record the site issue clearly. Include who was told, what is blocked, and what decision is required."
                className="mt-1 min-h-[120px] text-base"
                data-testid="onsite-issue-description"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Impact</Label>
                <select
                  className="input mt-1 min-h-11 w-full border-primary/40 bg-background text-foreground"
                  value={issueRecorderData.impact}
                  onChange={(event) => updateIssueRecorderData('impact', event.target.value)}
                  data-testid="onsite-issue-impact"
                >
                  {issueImpactOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Action required</Label>
                <select
                  className="input mt-1 min-h-11 w-full border-primary/40 bg-background text-foreground"
                  value={issueRecorderData.action_required}
                  onChange={(event) => updateIssueRecorderData('action_required', event.target.value)}
                  data-testid="onsite-issue-action-required"
                >
                  {issueActionOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Response required by</Label>
                <Input
                  type="date"
                  value={issueRecorderData.response_required_by}
                  onChange={(event) => updateIssueRecorderData('response_required_by', event.target.value)}
                  className="mt-1 min-h-11"
                  data-testid="onsite-issue-response-date"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Owner</Label>
                <select
                  className="input mt-1 min-h-11 w-full border-primary/40 bg-background text-foreground"
                  value={issueRecorderData.owner}
                  onChange={(event) => updateIssueRecorderData('owner', event.target.value)}
                  data-testid="onsite-issue-owner"
                >
                  {ownerOptions.map((owner) => (
                    <option key={owner} value={owner}>{owner}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Email recipients</Label>
                <Input
                  value={issueRecorderData.recipients}
                  onChange={(event) => updateIssueRecorderData('recipients', event.target.value)}
                  placeholder="name@example.co.nz, other@example.co.nz"
                  className="mt-1 min-h-11"
                  data-testid="onsite-issue-recipients"
                />
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-border/70 bg-secondary/20 p-3">
              <Label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Photos / evidence</Label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  ref={issueCameraInputRef}
                  onChange={handleIssueRecorderPhotoUpload}
                  data-testid="onsite-issue-take-photo-input"
                />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  ref={issueUploadInputRef}
                  onChange={handleIssueRecorderPhotoUpload}
                  data-testid="onsite-issue-upload-photo-input"
                />
                <button
                  type="button"
                  onClick={() => issueCameraInputRef.current?.click()}
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-dashed border-primary/45 px-3 py-2 text-sm font-black uppercase tracking-[0.08em] text-primary transition hover:bg-primary/10"
                  data-testid="onsite-issue-take-photo"
                  data-commercial-readiness="photo-take-upload-choice-v1"
                >
                  <Camera className="w-4 h-4" />
                  Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => issueUploadInputRef.current?.click()}
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-dashed border-primary/45 px-3 py-2 text-sm font-black uppercase tracking-[0.08em] text-primary transition hover:bg-primary/10"
                  data-testid="onsite-issue-upload-photo"
                  data-commercial-readiness="photo-take-upload-choice-v1"
                >
                  <Package className="w-4 h-4" />
                  Upload Photo
                </button>

                {(Array.isArray(issueRecorderData.photos) ? issueRecorderData.photos : []).map((photo, index) => (
                  <div key={index} className="relative">
                    <img src={photo} alt={`Issue evidence ${index + 1}`} className="h-14 w-14 rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => removeIssueRecorderPhoto(index)}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                      aria-label="Remove issue photo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs font-semibold text-muted-foreground">
                V1 saves photos into the LLD issue record. The email draft includes the issue text; attach photos manually if required by your email client.
              </p>
            </div>

            {issueRecorderEmailPreview && (
              <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 p-3" data-testid="onsite-issue-email-preview">
                <div className="mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-300" />
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">Email preview ready</p>
                </div>
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-background/80 p-3 text-xs text-foreground">{issueRecorderEmailPreview}</pre>
              </div>
            )}

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button type="button" variant="ghost" onClick={() => setShowIssueRecorder(false)}>
                Close
              </Button>
              {issueRecorderEmailPreview && (
                <>
                  <Button type="button" variant="outline" onClick={resetIssueRecorder} data-testid="onsite-issue-new">
                    New Formal Issue
                  </Button>
                  <Button type="button" variant="outline" onClick={openIssueRecorderEmailDraft} data-testid="onsite-issue-open-email">
                    <Send className="mr-2 h-4 w-4" />
                    Open Email Draft
                  </Button>
                </>
              )}
              <Button type="submit" disabled={issueRecorderSaving || !issueRecorderData.title.trim() || !issueRecorderData.description.trim()} data-testid="onsite-issue-save">
                {issueRecorderSaving ? 'Saving...' : 'Save Formal Issue + Preview Email'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {lastCaptureResult && (
        <Card className="ops-card border-primary/50 bg-primary/5" data-testid="diary-last-capture-panel-v4" data-commercial-readiness="diary-nav-post-capture-v4 diary-natural-look-v2-nav-copy">
          <CardContent className="space-y-3 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="font-heading text-[11px] font-black uppercase tracking-[0.2em] text-primary">Saved - next action</p>
                <h3 className="mt-1 font-heading text-lg font-black uppercase tracking-[0.1em] text-foreground">
                  Capture saved to diary
                </h3>
                <p className="mt-2 max-h-16 overflow-hidden text-sm font-semibold text-muted-foreground">
                  {lastCaptureResult.note}
                </p>
                <p className="mt-2 text-xs font-bold text-muted-foreground">
                  {diaryViewLabels[getCaptureDiaryView(lastCaptureResult)] || 'Diary'} view | {lastCaptureResult.needs_action ? `Action: ${lastCaptureResult.action_type}` : 'No action required'}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:min-w-[420px]">
                <Button type="button" size="sm" onClick={() => openDiaryView(getCaptureDiaryView(lastCaptureResult))} data-testid="diary-last-capture-view-record-v4">
                  View Diary Record
                </Button>
                {lastCaptureResult.needs_action && (
                  <Button type="button" size="sm" variant="outline" onClick={() => openActionItemsPage('today')} data-testid="diary-last-capture-action-items-v4">
                    Open Action Items
                  </Button>
                )}
                {String(lastCaptureResult.action_type || '').toLowerCase().includes('email') && (
                  <Button type="button" size="sm" variant="outline" onClick={() => openQuickCaptureEmailDraft(lastCaptureResult)} data-testid="diary-last-capture-email-v4">
                    <Send className="mr-2 h-4 w-4" />
                    Open Email Draft
                  </Button>
                )}
                {String(lastCaptureResult.action_type || '').toLowerCase().includes('formal') && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowIssueRecorder(true)} data-testid="diary-last-capture-formal-issue-v4">
                    Record Formal Issue
                  </Button>
                )}
                {String(lastCaptureResult.entry_type || '').toLowerCase().includes('issue') && (
                  <Button type="button" size="sm" variant="outline" onClick={openRoadblockCreateFlow} data-testid="diary-last-capture-roadblock-v4">
                    Add Roadblock
                  </Button>
                )}
                <Button type="button" size="sm" variant="ghost" onClick={() => setLastCaptureResult(null)} data-testid="diary-last-capture-dismiss-v4">
                  Dismiss
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!showQuickEntry && persistentQuickWalkaroundItems.length > 0 && (
        <Card className="ops-card border-primary/45 bg-primary/5" data-testid="things-to-work-through-persistent-v1" data-commercial-readiness="diary-quick-walkaround-persistent-queue-v1">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-heading text-[11px] font-black uppercase tracking-[0.16em] text-primary">Follow-up from walkaround</p>
                <CardTitle className="mt-1 text-base font-black text-foreground">Walkaround follow-ups</CardTitle>
              </div>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                {persistentQuickWalkaroundItems.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {persistentQuickWalkaroundItems.map((item, index) => (
              <div key={`${item.saved_at || 'queue'}-${index}`} className="rounded-xl border border-border/70 bg-background/90 p-3 text-sm" data-testid="things-to-work-through-persistent-item-v1">
                <div className="mb-2 flex flex-wrap gap-1">
                  {(item.work_through_buckets || ['Diary Only']).map((bucket) => (
                    <span key={bucket} className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-primary">
                      {bucket}
                    </span>
                  ))}
                </div>
                <p className="break-words text-sm font-black leading-5 text-foreground" data-testid="diary-human-followup-titles-v1">{item.display_note || item.raw_note || item.note || item.title || 'Walkaround follow-up'}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  {item.display_title || item.title || 'Walkaround Item'} | {item.priority || 'medium'} | {item.action_type || 'Diary Only'} | Send: {item.send_to || 'No'}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => openActionItemsPage('today')} data-testid="diary-walkaround-queue-open-action-items-v1">
                    Open Action Items
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => openDiaryView('overview')} data-testid="diary-walkaround-queue-review-diary-v1">
                    Review Diary
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Diary Command Strip / Clickable Checklist - diary-command-header-tabs-v2 */}
      <Card
        id="daily-report-readiness"
        className="ops-card"
        data-testid="daily-report-readiness"
        data-commercial-readiness="closeout-review-target-v8-9j1-1"
      >
        <CardContent className="space-y-3 py-3 lg:space-y-4 lg:py-5" data-testid="diary-mobile-compression-v5" data-commercial-readiness="diary-desktop-density-hierarchy-v1">
            <div className="rounded-2xl border border-primary/30 bg-background/85 p-2 shadow-inner sm:p-3 lg:p-5" data-testid="diary-status-summary-v1" data-commercial-readiness="diary-status-summary-v1 diary-above-fold-hierarchy-v1 diary-mobile-density-polish-v2 diary-desktop-density-hierarchy-v1">
              <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading text-xs font-black uppercase tracking-[0.18em] text-primary lg:text-base">{selectedDate === today ? "Today's site diary" : "Selected day site diary"}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground lg:text-sm">{selectedDate === today ? "A quick check of today's staff, work, notes, follow-ups, and evidence." : "A quick check of the selected day's staff, work, notes, follow-ups, and evidence."}</p>
                  {/* historical-diary-wording-v8-9j3-1 */}
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                  labourRows.length > 0 && walkaroundEntriesCount > 0
                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-orange-400/40 bg-orange-500/10 text-orange-300'
                }`}>
                  {labourRows.length > 0 && walkaroundEntriesCount > 0 ? 'Started' : 'Needs entry'}
                </span>
              </div>

              <div className="rounded-xl border border-orange-400/30 bg-orange-500/10 px-3 py-2 lg:px-4 lg:py-3" data-testid="diary-needs-attention-strip-v1" data-commercial-readiness="diary-scan-flow-v1 diary-view-state-attention-v2 diary-desktop-density-hierarchy-v1">
                <p className="font-heading text-[11px] font-black uppercase tracking-[0.14em] text-orange-500">Needs attention</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  {(diary?.blocked_gates?.length || 0) + (diary?.overdue_items?.length || 0) + dueTodayItems.length > 0
                    ? `${diary?.blocked_gates?.length || 0} roadblocks | ${diary?.overdue_items?.length || 0} overdue | ${dueTodayItems.length} due this day`
                    : 'No active roadblocks, overdue items, or carried-forward follow-ups.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:gap-3" data-testid="diary-status-summary-grid-v1" data-commercial-readiness="diary-desktop-density-hierarchy-v1">
                <button type="button" onClick={() => { setStaffSectionExpanded(true); openDiaryView('staff'); }} className="rounded-xl border border-border/70 bg-secondary/30 px-2 py-2 text-left transition hover:border-primary/60 hover:bg-primary/10 active:scale-[0.99] sm:p-3 lg:p-4">
                  <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Staff</span>
                  <span className="mt-0.5 block text-sm font-black text-foreground sm:text-lg">{labourRows.length}</span>
                  <span className="mt-0.5 block truncate text-[10px] font-bold text-muted-foreground sm:text-[11px]">{labourRows.length > 0 ? `${labourTotalHours.toFixed(2)}h checked` : 'Missing'}</span>
                </button>

                <button type="button" onClick={() => openActionItemsPage('today')} className="rounded-xl border border-border/70 bg-secondary/30 px-2 py-2 text-left transition hover:border-primary/60 hover:bg-primary/10 active:scale-[0.99] sm:p-3 lg:p-4">
                  <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Follow-ups</span>
                  <span className="mt-0.5 block text-sm font-black text-foreground sm:text-lg">{dueTodayItems.length}</span>
                  <span className="mt-0.5 block truncate text-[10px] font-bold text-muted-foreground sm:text-[11px]">Due this diary day</span>
                </button>

                <button type="button" onClick={() => openDiaryView('site-notes')} className="rounded-xl border border-border/70 bg-secondary/30 px-2 py-2 text-left transition hover:border-primary/60 hover:bg-primary/10 active:scale-[0.99] sm:p-3 lg:p-4">
                  <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Site notes</span>
                  <span className="mt-0.5 block text-sm font-black text-foreground sm:text-lg">{walkaroundEntriesCount}</span>
                  <span className="mt-0.5 block truncate text-[10px] font-bold text-muted-foreground sm:text-[11px]">{walkaroundEntriesCount > 0 ? 'Recorded' : 'Missing'}</span>
                </button>

                <button type="button" onClick={() => openDiaryView('resources', activeResourceTab || 'materials')} className="rounded-xl border border-border/70 bg-secondary/30 px-2 py-2 text-left transition hover:border-primary/60 hover:bg-primary/10 active:scale-[0.99] sm:p-3 lg:p-4">
                  <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Resources</span>
                  <span className="mt-0.5 block text-sm font-black text-foreground sm:text-lg">M/P</span>
                  <span className="mt-0.5 block truncate text-[10px] font-bold text-muted-foreground sm:text-[11px]">Materials / plant</span>
                </button>
              </div>
            </div>
            {(programmeLookaheadLoading || Boolean(programmeLookaheadError) || programmeLookaheadItems.length > 0) && ( /* simple-daily-hide-empty-lookahead-v8-9k2-1 */
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-2 shadow-inner sm:p-3 lg:p-5" data-testid="diary-programme-lookahead-v1" data-commercial-readiness="diary-programme-lookahead-v1 diary-above-fold-hierarchy-v1 diary-mobile-density-polish-v2 diary-desktop-density-hierarchy-v1">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading text-xs font-black uppercase tracking-[0.18em] text-emerald-300 lg:text-base">6 Week Lookahead</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">Upcoming tasks for this job.</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/programme')}
                  className="shrink-0 rounded-full border border-emerald-400/40 bg-background/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300 transition hover:bg-emerald-500/10"
                  data-testid="diary-programme-lookahead-open-programme"
                >
                  Open Programme
                </button>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/55 px-2 py-1.5 sm:p-3" data-testid="diary-programme-lookahead-summary-v1">
                {programmeLookaheadLoading ? (
                  <p className="text-xs font-semibold text-muted-foreground">Loading programme lookahead...</p>
                ) : programmeLookaheadError ? (
                  <p className="text-xs font-semibold text-amber-300">{programmeLookaheadError}</p>
                ) : programmeLookaheadItems.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Next 6 weeks</span>
                      <span className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-300">{programmeLookaheadItems.length} shown</span>
                    </div>
                    {programmeLookaheadItems.slice(0, 4).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate('/programme')}
                        className="w-full rounded-lg border border-border/70 bg-secondary/25 p-2 text-left transition hover:border-emerald-400/50 hover:bg-emerald-500/10"
                        data-testid={`diary-programme-lookahead-item-${item.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0 truncate text-xs font-black text-foreground">{item.title}</span>
                          <span className="shrink-0 text-[10px] font-bold text-muted-foreground">{new Date(item.dateValue).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' })}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1 text-[10px] font-bold text-muted-foreground">
                          <span>{item.status}</span>
                          <span>|</span>
                          <span className="truncate">{item.programmeLabel}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-muted-foreground">No tasks found for this job.</p>
                )}
              </div>
            </div>
            )}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5" data-testid="diary-attention-strip-v2" data-commercial-readiness="diary-lower-mobile-clutter-polish-v2 diary-attention-strip-compact-polish-v1">
            <button
              type="button"
              onClick={() => openActionItemsPage('blocked')}
              className="rounded-xl border border-red-400/40 bg-red-500/10 px-2.5 py-1.5 text-left transition hover:bg-red-500/15"
              data-testid="diary-command-overdue"
            >
              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-red-400">Overdue</span>
              <span className="block text-lg font-black sm:text-xl">{overdueDiaryItems.length}</span>
            </button>
            <button
              type="button"
              onClick={() => openActionItemsPage('today')}
              className="rounded-xl border border-orange-400/35 bg-orange-500/10 px-2.5 py-1.5 text-left transition hover:bg-orange-500/15"
              data-testid="diary-command-due-today"
            >
              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-orange-400">Follow-ups</span>
              <span className="block text-lg font-black sm:text-xl">{dueTodayItems.length}</span>
            </button>
            <button
              type="button"
              onClick={() => openActionItemsPage('week')}
              className="rounded-xl border border-primary/35 bg-primary/10 px-2.5 py-1.5 text-left transition hover:bg-primary/15"
              data-testid="diary-command-forecast"
            >
              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-primary">Upcoming</span>
              <span className="block text-lg font-black sm:text-xl">{nextThreeWeeksItems.length}</span>
            </button>
            <button
              type="button"
              onClick={openRoadblocksPage}
              className="rounded-xl border border-red-500/35 bg-secondary/30 px-2.5 py-1.5 text-left transition hover:bg-secondary/45"
              data-testid="diary-command-roadblocks-open"
            >
              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-red-400">Roadblocks</span>
              <span className="block text-lg font-black sm:text-xl">{diary?.summary?.blocked_gates || 0}</span>
            </button>
            <button
              type="button"
              onClick={() => openDiaryView('rfis')}
              className="rounded-xl border border-sky-400/35 bg-sky-500/10 px-2.5 py-1.5 text-left transition hover:bg-sky-500/15"
              data-testid="diary-command-queries-rfis"
            >
              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-sky-500">RFIs</span>
              <span className="block text-lg font-black sm:text-xl">0</span>
            </button>
          </div>

                      {/* diary-remove-desktop-review-shortcuts-v2 diary-natural-look-v1c-comment-cleanup: removed redundant review shortcut clutter. Site diary summary and action strip are the release navigation. */}


          {!hasDiaryContent && (
            <p className="rounded-xl border border-border/60 bg-background/55 px-3 py-2 text-xs font-semibold text-muted-foreground" data-commercial-readiness="diary-scan-flow-v1">
              No reportable activity for this day yet. Add a diary note or review another date before issuing a report.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(followUpConfirm)} onOpenChange={(open) => {
        if (!open && !followUpConfirmSaving) {
          setFollowUpConfirm(null);
        }
      }}>
        <DialogContent className="sm:max-w-md" data-testid="diary-followup-app-confirm-v1-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl uppercase tracking-tight">
              {followUpConfirm?.mode === "reopen" ? "Reopen follow-up?" : "Close out follow-up?"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              {followUpConfirm?.mode === "reopen"
                ? "Moves this item back to Follow-ups."
                : "Marks this follow-up closed for the diary day."}
            </p>
            <p className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 font-semibold text-foreground">
              {followUpConfirm?.label || "This follow-up"}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setFollowUpConfirm(null)} disabled={followUpConfirmSaving}>
              Cancel
            </Button>
            <Button type="button" className="btn-primary" onClick={executeDiaryFollowUpConfirm} disabled={followUpConfirmSaving}>
              {followUpConfirmSaving
                ? "Working..."
                : followUpConfirm?.mode === "reopen"
                  ? "Reopen"
                  : "Close Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {draftStatus && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary" data-testid="diary-draft-autosave-v1-status">
          {draftStatus}
        </div>
      )}

      {diary && (
        <>
          {/* Content Sections */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5" data-commercial-readiness="diary-desktop-density-hierarchy-v1">
            {/* Roadblocks / Critical Site Issues - diary-field-sheet-layout-v1 */}
            {(diary.blocked_gates?.length || 0) > 0 && ( /* simple-daily-hide-empty-roadblocks-v8-9k2-1 */
            <Card id="diary-roadblocks-section" className="ops-card" data-commercial-readiness="diary-critical-sections-compact-polish-v1">
              <CardHeader className="ops-card-header border-b border-red-500/25 border-l-4 border-l-red-500 bg-red-500/10 px-3 py-3 shadow-sm lg:px-4 lg:py-4" data-commercial-readiness="diary-heading-hierarchy-v4 diary-desktop-density-hierarchy-v1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="font-heading text-[17px] font-black leading-tight tracking-tight flex items-center gap-2 text-red-500 lg:text-xl" data-commercial-readiness="diary-heading-hierarchy-v3 diary-desktop-density-hierarchy-v1">
                      <AlertTriangle className="w-4 h-4" />
                      Roadblocks / Critical Site Issues ({diary.blocked_gates?.length || 0})
                    </CardTitle>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">Check blockers first, then keep moving through the diary.</p>
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
                        <p className="rounded-xl border border-border/60 bg-background/55 px-3 py-2 text-xs font-semibold text-muted-foreground" data-commercial-readiness="diary-scan-flow-v1">
                          Owner: {gate.owner_party} | Required:{' '}
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
            )}

            {/* Overdue Follow-ups - moved into critical hierarchy - diary-critical-hierarchy-staff-compact-v1 */}
            {(diary.overdue_items?.length || 0) > 0 && ( /* simple-daily-hide-empty-overdue-v8-9k2-1 */
            <Card id="diary-overdue-followups" className="ops-card" data-testid="diary-overdue-top-section" data-commercial-readiness="diary-critical-sections-compact-polish-v1">
              <CardHeader className="ops-card-header border-b border-red-400/25 border-l-4 border-l-red-400 bg-red-500/10 px-3 py-3 shadow-sm lg:px-4 lg:py-4" data-commercial-readiness="diary-heading-hierarchy-v4 diary-desktop-density-hierarchy-v1">
                <CardTitle className="font-heading text-[17px] font-black leading-tight tracking-tight flex items-center gap-2 text-red-400 lg:text-xl" data-commercial-readiness="diary-heading-hierarchy-v3 diary-desktop-density-hierarchy-v1">
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
                        <p className="text-sm font-semibold leading-5" data-testid="diary-epic-human-action-titles-v1">{getHumanDiaryActionTitle(item)}</p>
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
                  <p className="rounded-lg border border-dashed border-red-400/25 bg-red-500/5 px-3 py-2 text-sm text-muted-foreground">No overdue follow-ups.</p>
                )}
              </CardContent>
            </Card>
            )}


            {/* Follow-ups / Carry Forward - diary-carry-forward-ui-clarity-v2 */}
            {dueTodayItems.length > 0 && ( /* simple-daily-hide-empty-due-v8-9k2-1 */
            <Card id="diary-due-today-section" className="ops-card" data-testid="diary-due-today-section" data-commercial-readiness="diary-critical-sections-compact-polish-v1">
              <CardHeader className="ops-card-header border-b border-orange-500/25 border-l-4 border-l-orange-500 bg-orange-500/10 px-3 py-3 shadow-sm lg:px-4 lg:py-4" data-commercial-readiness="diary-heading-hierarchy-v4 diary-desktop-density-hierarchy-v1">
                <CardTitle className="font-heading text-[17px] font-black leading-tight tracking-tight flex items-center gap-2 text-orange-500 lg:text-xl" data-commercial-readiness="diary-heading-hierarchy-v3 diary-desktop-density-hierarchy-v1">
                  <Target className="w-4 h-4" />
                  Due This Diary Day ({dueTodayItems.length})
                </CardTitle>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Items due on this diary date. Overdue items are listed separately above.</p>
              </CardHeader>

              <CardContent className="py-3">
                {dueTodayItems.length > 0 ? (
                  <div className="space-y-2">
                    {sortDiaryPriorityFirst(dueTodayItems).map((item) => (
                      <div
                        key={item.id}
                        className={`w-full p-2 rounded-md border-l-4 text-left transition ${selectedDiaryActionItem?.id === item.id ? 'border-l-orange-300 bg-orange-500/20 ring-2 ring-orange-400/30' : 'border-l-orange-400 bg-orange-500/10 hover:border-orange-400/70 hover:bg-orange-500/15'}`}
                        data-testid={`diary-carry-forward-followup-row-${item.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => openDiaryActionItem(item)}
                            className="min-w-0 flex-1 text-left"
                            data-testid={`diary-due-today-clickthrough-${item.id}`}
                          >
                            <p className="text-sm font-semibold leading-5" data-testid="diary-epic-human-action-titles-v1">{getHumanDiaryActionTitle(item)}</p>
                            <p className="rounded-xl border border-border/60 bg-background/55 px-3 py-2 text-xs font-semibold text-muted-foreground" data-commercial-readiness="diary-scan-flow-v1">
                              {getOpenFollowupMetaParts(item).join(' | ')}
                            </p>
                          </button>
                          <button
                            type="button"
                            className="shrink-0 rounded-md border border-orange-500/50 bg-orange-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-orange-700 hover:bg-orange-500/20"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCompleteFollowUpFromDiary(item);
                            }}
                            data-testid={`diary-closeout-followup-${item.id}`}
                          >
                            Close out
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-orange-400/25 bg-orange-500/5 px-3 py-2 text-sm text-muted-foreground">No open carried-forward follow-ups.</p>
                )}
              </CardContent>
            </Card>
            )}

            {/* RFIs - diary-critical-hierarchy-staff-compact-v1 */}
            <Card id="diary-queries-section" className="ops-card" data-testid="diary-queries-rfis-section" data-commercial-readiness="diary-critical-sections-compact-polish-v1">
              <CardHeader className="ops-card-header border-b border-sky-500/25 border-l-4 border-l-sky-500 bg-sky-500/10 px-3 py-3 shadow-sm lg:px-4 lg:py-4" data-commercial-readiness="diary-heading-hierarchy-v4 diary-desktop-density-hierarchy-v1">
                <CardTitle className="font-heading text-[17px] font-black leading-tight tracking-tight flex items-center gap-2 text-sky-500 lg:text-xl" data-commercial-readiness="diary-heading-hierarchy-v3 diary-desktop-density-hierarchy-v1">
                  <ListTodo className="w-4 h-4" />
                  RFIs (0)
                </CardTitle>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Questions needing answers before they block work.</p>
              </CardHeader>

              <CardContent className="py-3">
                <div className="rounded-lg border border-dashed border-sky-400/30 bg-sky-500/5 px-3 py-2 text-sm text-muted-foreground" data-commercial-readiness="diary-scan-flow-v1">
                  No RFIs recorded for this diary day.
                </div>
              </CardContent>
            </Card>

            <Card id="diary-staff-section" className="ops-card w-full max-w-full overflow-hidden" data-testid="daily-labour-card" data-commercial-readiness="staff-mobile-overflow-containment-v2 diary-staff-section-wording-polish-v1">
          <CardHeader className="ops-card-header border-b border-primary/25 border-l-4 border-l-primary bg-primary/10 px-3 py-3 shadow-sm lg:px-4 lg:py-4" data-testid="daily-labour-polish-v1-marker" data-commercial-readiness="diary-heading-hierarchy-v4 diary-desktop-density-hierarchy-v1">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="font-heading text-[17px] font-black leading-tight tracking-tight text-foreground lg:text-xl" data-commercial-readiness="diary-heading-hierarchy-v3 diary-desktop-density-hierarchy-v1">Staff on Site</CardTitle>
                <p className="rounded-xl border border-border/60 bg-background/55 px-3 py-2 text-xs font-semibold text-muted-foreground" data-commercial-readiness="diary-scan-flow-v1">
                  Diary check only until you import saved rows to Timesheet.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-stretch" data-commercial-readiness="staff-collapsible-summary-v1">
                <div className="grid w-full grid-cols-2 gap-2 rounded-xl border border-primary/30 bg-background/70 p-2 text-center sm:w-auto sm:min-w-[13rem]" data-testid="staff-onsite-summary-polish-v1">
                  <div className="rounded-lg bg-secondary/40 px-2 py-1">
                    <span className="block text-lg font-black leading-none text-foreground" data-testid="daily-labour-row-count">{labourRows.length}</span>
                    <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">staff</span>
                  </div>
                  <div className="rounded-lg bg-secondary/40 px-2 py-1">
                    <span className="block text-lg font-black leading-none text-foreground" data-testid="daily-labour-total-hours">{labourTotalHours.toFixed(2)}</span>
                    <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">check hrs</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 justify-center px-3 text-xs font-black uppercase tracking-[0.14em] sm:w-auto"
                  onClick={() => setStaffSectionExpanded((value) => !value)}
                  aria-expanded={staffSectionExpanded}
                  data-testid="diary-staff-collapse-toggle"
                >
                  {staffSectionExpanded ? 'Collapse' : 'Expand'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className={`${staffSectionExpanded ? 'max-h-[34rem] py-3 opacity-100' : 'max-h-0 py-0 opacity-0 pointer-events-none'} w-full max-w-full space-y-3 overflow-y-auto overflow-x-hidden px-3 transition-all duration-200 sm:px-4`} data-testid="diary-staff-compact-panel-v1" data-commercial-readiness="staff-collapsible-summary-v1">
            {labourLoading ? (
              <p className="text-sm text-muted-foreground">Loading staff...</p>
            ) : (
              <div className="w-full min-w-0 max-w-full space-y-2 overflow-hidden" data-testid="daily-labour-rows">
                <div
                  className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-primary/40 bg-primary/5 p-2"
                  data-testid="staff-diary-check-picker-v1"
                  onClick={(event) => {
                    if (event.target === event.currentTarget) {
                      setActiveLabourIndex(null);
                      setLabourEditMode(false); // staff-name-resolve-click-away-v1
                    }
                  }}
                >
                  <div className="mb-3 flex min-w-0 items-center justify-between gap-3 overflow-hidden">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-primary">Staff on Site</p>
                      <p className="truncate text-xs font-bold text-muted-foreground">{labourRows.length} staff - {labourTotalHours.toFixed(2)}h total</p>
                    </div>
                  </div>

                  <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" data-testid="staff-timesheet-picker">
                    <select
                      className="input lld-daily-labour-control lld-staff-picker-control min-h-11 w-full min-w-0 border-primary/45 bg-background text-foreground shadow-inner"
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
                      <option value="" data-commercial-readiness="staff-picker-dark-options-v1 staff-site-only-wording-v1">Add from Timesheet staff</option>
                      {employeePickerOptions().map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <Button type="button" variant="outline" className="w-full justify-center sm:w-auto" onClick={() => setShowNewStaffForm((value) => !value)} data-testid="staff-timesheet-add-new-toggle">
                      + Add site-only staff
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-center sm:w-auto"
                      onClick={copyPreviousDayCrew}
                      disabled={labourLoading || labourSaving || labourRows.length > 0}
                      data-testid="staff-copy-previous-day-v1"
                      title={labourRows.length > 0
                        ? 'Available when this day has no staff recorded'
                        : 'Copy the previous day crew into this day with normal hours'}
                    >
                      Copy previous crew
                    </Button>

                    {/* LLD / TIMESHEET IMPORT STAFF CARD BUTTON V1 */}
                    <Button
                      type="button"
                      variant="default"
                      className="w-full justify-center sm:w-auto"
                      onClick={importLabourRowsToTimesheet}
                      disabled={labourImporting || labourSaving || !Array.isArray(labourRows) || labourRows.length === 0}
                      data-testid="staff-import-saved-rows-to-timesheet"
                      title="Send saved LLD daily labour rows to Timesheet Manager for review. This does not approve payroll."
                    >
                      {labourImporting ? 'Importing...' : 'Import saved rows to Timesheet'}
                    </Button>
                  </div>

                  {showNewStaffForm && (
                    <div className="mt-3 rounded-lg border border-dashed border-primary/50 bg-background/70 p-3" data-testid="staff-timesheet-add-new-form" data-commercial-readiness="staff-site-only-wording-v1">
                      <p className="mb-2 text-xs font-bold text-muted-foreground">
                        Adds this person to today's diary only. Permanent staff are managed in Timesheet Manager.
                      </p>
                      <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <input
                          className="input lld-daily-labour-control min-h-11 w-full min-w-0 border-primary/45 bg-background text-foreground shadow-inner"
                          placeholder="Site-only staff name"
                          value={newStaffName}
                          onChange={(e) => setNewStaffName(e.target.value)}
                          data-testid="staff-timesheet-new-name"
                        />
                        <Button type="button" onClick={addNewStaffToDiary} disabled={!newStaffName.trim()} data-testid="staff-timesheet-add-new-confirm">
                          Add to this diary
                        </Button>
                      </div>
                    </div>
                  )}

                  {labourRows.length === 0 ? (
                    <div className="mt-3 rounded-lg border border-dashed border-border/70 bg-background/60 px-3 py-4 text-sm font-semibold text-muted-foreground" data-testid="staff-timesheet-empty">
                      No staff recorded yet. Add Timesheet staff or site-only staff.
                    </div>
                  ) : (
                    <div className="mt-2 grid w-full min-w-0 max-w-full gap-1.5 overflow-visible pr-0 sm:max-h-56 sm:overflow-y-auto sm:overflow-x-hidden sm:pr-1" data-testid="staff-timesheet-selected-list" data-commercial-readiness="staff-manual-add-visible-list-v1 staff-selected-list-mobile-show-all-v1">
                      {labourRows.map((row, index) => (
                        <button
                          key={row.id || index}
                          type="button"
                          className={`flex w-full min-w-0 max-w-full items-center justify-between gap-2 overflow-hidden rounded-lg border px-2 py-1.5 text-left transition ${
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
                    className="relative z-10 mt-3 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-primary/70 bg-card p-3 shadow-xl sm:p-4"
                    data-testid="diary-staff-timesheet-popout-editor-v1" data-commercial-readiness="staff-diary-always-inline-editor-v2 staff-diary-no-forced-focus-v2"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="mb-3 flex min-w-0 flex-col gap-3 border-b border-primary/25 pb-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Daily Staff Check</p>
                        <h3 className="truncate font-heading text-base font-black uppercase tracking-[0.10em]">
                          {row.employee_name || 'Staff member'}
                        </h3>
                        <p className="text-xs font-semibold text-muted-foreground">
                          Daily check only. Permanent profiles stay in Timesheet Manager.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full justify-center sm:w-auto"
                        onClick={closeLabourEditor}
                        data-testid="diary-staff-popout-close"
                      >
                        Close
                      </Button>
                    </div>

                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="space-y-1 sm:col-span-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Daily staff member</span>
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

                      <label className="space-y-1" data-testid={`daily-labour-start-combo-${index}`}>
                 <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Start</span>
                 <div className="grid gap-2 sm:grid-cols-2">
                   <select
                     className="input lld-daily-labour-control min-h-11 w-full min-w-0 border-primary/45 bg-background text-foreground shadow-inner"
                     value={row.start_time || ''}
                     onChange={(e) => updateLabourRow(index, 'start_time', e.target.value)}
                     data-testid={`daily-labour-start-${index}`}
                   >
                     <option value="">Default start</option>
                     {timeOptionsForRow(row.start_time).map((option) => (
                       <option key={option.value} value={option.value}>{option.label}</option>
                     ))}
                   </select>
                   <Input
                     type="time"
                     step="60"
                     className="lld-daily-labour-control min-h-11 w-full min-w-0 border-primary/45 bg-background text-foreground shadow-inner"
                     value={row.start_time || ''}
                     onChange={(e) => updateLabourRow(index, 'start_time', e.target.value)}
                     data-testid={`daily-labour-start-manual-${index}`} // staff-default-plus-manual-time-v2
                   />
                 </div>
               </label>

                      <label className="space-y-1" data-testid={`daily-labour-finish-combo-${index}`}>
                 <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Finish</span>
                 <div className="grid gap-2 sm:grid-cols-2">
                   <select
                     className="input lld-daily-labour-control min-h-11 w-full min-w-0 border-primary/45 bg-background text-foreground shadow-inner"
                     value={row.finish_time || ''}
                     onChange={(e) => updateLabourRow(index, 'finish_time', e.target.value)}
                     data-testid={`daily-labour-finish-${index}`}
                   >
                     <option value="">Default finish</option>
                     {timeOptionsForRow(row.finish_time).map((option) => (
                       <option key={option.value} value={option.value}>{option.label}</option>
                     ))}
                   </select>
                   <Input
                     type="time"
                     step="60"
                     className="lld-daily-labour-control min-h-11 w-full min-w-0 border-primary/45 bg-background text-foreground shadow-inner"
                     value={row.finish_time || ''}
                     onChange={(e) => updateLabourRow(index, 'finish_time', e.target.value)}
                     data-testid={`daily-labour-finish-manual-${index}`}
                   />
                 </div>
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

            <p className="text-xs font-medium text-muted-foreground">Tap a staff name to edit the diary check. Use Import saved rows to Timesheet when ready.</p>
          </CardContent>
        </Card>

        {/* Daily Evidence - Site Notes / Observations - diary-daily-evidence-hierarchy-v2 site-notes-observations-naming-v1 */}
        <div className="lg:col-span-2 rounded-xl border border-primary/35 border-l-4 border-l-primary bg-primary/12 px-3 py-3 shadow-sm" data-testid="diary-daily-evidence-divider-v2" data-commercial-readiness="diary-heading-hierarchy-v4 diary-daily-evidence-resources-polish-v1">
          <p className="font-heading text-sm font-black leading-tight tracking-tight text-primary" data-commercial-readiness="diary-heading-hierarchy-v3">{selectedDate === today ? "Today's records" : "Selected day's records"}</p>
          {/* historical-evidence-heading-v8-9j8-5 */}
          <p className="mt-1 text-xs font-semibold text-muted-foreground">Site notes, resources, photos, and supporting records.</p>
        </div>

            <Card id="diary-work-section" className="ops-card lg:col-span-2 border-primary/35" data-testid="diary-walkaround-notes-section" data-commercial-readiness="diary-walkaround-safe-array-wording-v2">
              <CardHeader className="ops-card-header border-b border-primary/25 border-l-4 border-l-primary bg-primary/10 px-3 py-3 shadow-sm" data-commercial-readiness="diary-heading-hierarchy-v4">
                <CardTitle className="font-heading text-[18px] font-black leading-tight tracking-tight flex items-center gap-2 text-foreground" data-commercial-readiness="diary-heading-hierarchy-v3">
                  <FileText className="w-4 h-4" />
                  Site Notes / Observations ({walkaroundEntriesCount})
                </CardTitle>
              </CardHeader>

              <CardContent className="py-3 max-h-80 overflow-y-auto">
                {walkaroundEntriesCount > 0 ? (
                  <div className="space-y-3">
                    {sortDiaryPriorityFirst(walkaroundEntries).map((entry) => (
                      <div key={entry.id} className="p-3 bg-secondary/30 rounded-md space-y-1">
                        <p className="text-sm font-semibold leading-6">{entry.note}</p>

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
                          {entry.owner && <span>| {entry.owner}</span>}
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
                  <p className="rounded-lg border border-dashed border-primary/25 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">No site notes recorded yet.</p>
                )}
              </CardContent>
            </Card>

        {/* Site Resources */}
            <Card id="diary-resources-section" className="ops-card lg:col-span-2" data-testid="daily-site-resources-card" data-commercial-readiness="diary-daily-evidence-resources-polish-v1">
              <CardHeader className="ops-card-header border-b border-primary/25 border-l-4 border-l-primary bg-primary/10 px-3 py-3 shadow-sm" data-commercial-readiness="diary-heading-hierarchy-v4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="font-heading text-[17px] font-black leading-tight tracking-tight flex items-center gap-2 text-foreground" data-commercial-readiness="diary-heading-hierarchy-v3">
                      <Package className="w-4 h-4" />
                      Site Resources
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Materials, plant, and subcontractors kept separate.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="rounded-full border border-border bg-background/70 px-3 py-1 text-sm font-semibold text-muted-foreground">
                      {resourceMaterials.length} mat | {resourcePlantEquipment.length} plant | {resourceSubcontractors.length} subs
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={() => window.open(toolTrackerUrl, '_blank', 'noopener,noreferrer')} data-testid="open-tool-tracker">
                      Open Tool Tracker
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 px-3 py-3 sm:px-4">
                {resourcesEditMode && ( /* simple-daily-resources-edit-only-tabs-v8-9k2-2 */
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
                  <button
                    type="button"
                    onClick={() => setActiveResourceTab('subcontractors')}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-black uppercase tracking-[0.10em] transition ${
                      activeResourceTab === 'subcontractors' ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
                    }`}
                    data-testid="diary-resource-tab-subcontractors-v1"
                  >
                    Subcontractors ({resourceSubcontractors.length})
                  </button>
                </div>

                )}
                {resourcesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading site resources...</p>
                ) : resourcesEditMode ? (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-testid="daily-site-resources-edit">
                    {[
                      ['materials', 'Materials on Site', resourceMaterials],
                      ['plant_equipment', 'Plant / Equipment on Site', resourcePlantEquipment],
                      ['subcontractors', 'Subcontractors on Site', resourceSubcontractors]
                    ].filter(([category]) => category === activeResourceTab).map(([category, title, rows]) => (
                      <div key={category} id={category === 'materials' ? 'daily-site-resources-materials' : category === 'subcontractors' ? 'daily-site-resources-subcontractors' : 'daily-site-resources-plant'} className="lld-resource-section rounded-xl border border-border/70 bg-secondary/20 p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-black uppercase tracking-[0.08em] text-foreground">{title}</p>
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
                                  placeholder={category === 'materials' ? 'Material / item' : category === 'subcontractors' ? 'Subcontractor / company' : 'Plant / equipment / tool'}
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
                                  placeholder={category === 'materials' ? 'Supplier / docket' : category === 'subcontractors' ? 'Trade / area' : 'Owned / hired / Tool Tracker ref'}
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
                                  placeholder={category === 'subcontractors' ? 'Work carried out / notes' : 'Notes'}
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
                ) : resourcesTotalCount === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/80 bg-secondary/20 px-3 py-3" data-testid="diary-compact-empty-resources-v1" data-commercial-readiness="diary-compact-empty-resources-v1">
                    <p className="text-sm font-black text-foreground">{selectedDate === today ? "No site resources recorded today." : "No site resources recorded for this day."}</p>
                    {/* historical-resource-empty-state-v8-9j8-6 */}
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">Add materials, plant, tools, or subcontractors only when they need to be part of the diary record.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" data-testid="daily-site-resources-summary-clean-v1">
                    {resourceMaterials.length > 0 && (
                      <div id="daily-site-resources-materials" className="lld-resource-section rounded-xl border border-border/70 bg-secondary/20 p-3" data-testid="diary-resource-materials-panel-v1">
                        <p className="mb-2 text-sm font-black uppercase tracking-[0.08em] text-foreground">Materials on Site</p>
                        <div className="space-y-2">
                          {resourceMaterials.map((row, index) => (
                            <ResourceSummaryRow key={row.id || index} row={row} />
                          ))}
                        </div>
                      </div>
                    )}

                    {resourcePlantEquipment.length > 0 && (
                      <div id="daily-site-resources-plant" className="lld-resource-section rounded-xl border border-border/70 bg-secondary/20 p-3" data-testid="diary-resource-plant-panel-v1">
                        <p className="mb-2 text-sm font-black uppercase tracking-[0.08em] text-foreground">Plant / Equipment on Site</p>
                        <div className="space-y-2">
                          {resourcePlantEquipment.map((row, index) => (
                            <ResourceSummaryRow key={row.id || index} row={row} />
                          ))}
                        </div>
                      </div>
                    )}

                    {resourceSubcontractors.length > 0 && (
                      <div id="daily-site-resources-subcontractors" className="lld-resource-section rounded-xl border border-primary/30 bg-primary/5 p-3" data-testid="diary-resource-subcontractors-panel-v2">
                        <p className="mb-2 text-sm font-black uppercase tracking-[0.08em] text-foreground">Subcontractors on Site</p>
                        <div className="space-y-2">
                          {resourceSubcontractors.map((row, index) => (
                            <ResourceSummaryRow key={row.id || index} row={row} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:flex-wrap" data-testid="diary-resources-action-bar-v8-9k2-2">
                  {!resourcesEditMode ? (
                    <Button type="button" variant="secondary" onClick={beginSiteResourcesEdit} data-testid="daily-site-resources-edit-button">
                      {resourcesTotalCount === 0 ? 'Add resources' : 'Add / edit resources'}
                    </Button>
                  ) : (
                    <>
                      <Button type="button" onClick={saveSiteResources} disabled={resourcesSaving || !selectedProject} data-testid="daily-site-resources-save">
                        {resourcesSaving ? 'Saving...' : 'Save resources'}
                      </Button>
                      <Button type="button" variant="secondary" onClick={cancelSiteResourcesEdit} disabled={resourcesSaving} data-testid="daily-site-resources-cancel-v8-9k2-3">
                        Cancel changes
                      </Button>
                    </>
                  )}
                </div>

                <p className="rounded-lg border border-border/70 bg-secondary/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  Diary-only resources. Tool Tracker remains the asset register.
                </p>
              </CardContent>
            </Card>



            {/* diary-remove-duplicate-followups-v1: duplicate lower open follow-up card removed; completed follow-ups kept in one section */}
            {(diary.action_items_closed?.length || 0) > 0 && ( /* simple-daily-hide-empty-completed-v8-9k2-1 */
            <Card id="diary-action-completed-section" className="ops-card" data-testid="diary-closed-out-today-section" data-commercial-readiness="diary-closed-out-section-polish-v1">
              <CardHeader className="ops-card-header border-b border-emerald-500/25 border-l-4 border-l-emerald-500 bg-emerald-500/10 px-3 py-3 shadow-sm" data-commercial-readiness="diary-heading-hierarchy-v4">
                <CardTitle className="font-heading text-base font-black uppercase tracking-[0.14em] flex items-center gap-2 text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" />
                  Completed follow-ups ({diary.action_items_closed?.length || 0})
                </CardTitle>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Completed for this day. Reopen only when work needs to continue.</p>
              </CardHeader>

              <CardContent className="py-3 max-h-80 overflow-y-auto">
                {diary.action_items_closed?.length > 0 ? (
                  <div className="space-y-2">
                    {sortDiaryPriorityFirst(diary.action_items_closed).map((item) => (
                      <div
                        key={item.id}
                        className="w-full rounded-md border border-emerald-500/20 border-l-4 border-l-emerald-500 bg-emerald-500/10 p-2"
                        data-testid={`diary-closed-out-row-${item.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => openDiaryActionItem(item)}
                            className="min-w-0 flex-1 text-left"
                            data-testid={`diary-closed-out-details-${item.id}`}
                          >
                            <p className="text-sm font-semibold leading-5" data-testid="diary-epic-human-action-titles-v1">{getHumanDiaryActionTitle(item)}</p>
                            <p className="rounded-xl border border-border/60 bg-background/55 px-3 py-2 text-xs font-semibold text-muted-foreground" data-commercial-readiness="diary-scan-flow-v1">
                              {getClosedFollowupMetaParts(item).join(" | ")}
                            </p>
                          </button>
                          <button
                            type="button"
                            className="shrink-0 rounded-md border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-amber-700 hover:bg-amber-500/20"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleReopenClosedOutFromDiary(item);
                            }}
                            data-testid={`diary-reopen-closed-out-${item.id}`}
                          >
                            Reopen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-sm text-muted-foreground">No completed follow-ups for this day.</p>
                )}
              </CardContent>
            </Card>
            )}

          </div>
        </>
      )}
      </div>
    </div>
  );
};

const DiaryPageWithErrorBoundary = () => (
  <DiaryPageErrorBoundary>
    <DiaryPage />
  </DiaryPageErrorBoundary>
);

export default DiaryPageWithErrorBoundary;
