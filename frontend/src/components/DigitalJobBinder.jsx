import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Camera,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Mail,
  Package,
  Plus,
  Printer,
  Route,
  Users,
} from 'lucide-react';
import './DigitalJobBinder.css';

const BINDER_TABS = [
  { id: 'today', label: 'Today', description: 'Diary + My Day', color: 'coral' },
  { id: 'diary', label: 'Diary', description: 'Daily records', color: 'orange' },
  { id: 'tasks', label: 'Tasks', description: 'Actions & checks', color: 'yellow' },
  { id: 'materials', label: 'Materials', description: 'On site & required', color: 'green' },
  { id: 'emails', label: 'Emails / Calls', description: 'Communications', color: 'teal' },
  { id: 'roadblocks', label: 'Roadblocks', description: 'Issues & impact', color: 'blue' },
  { id: 'walkaround', label: 'Walkaround', description: 'Site capture', color: 'indigo' },
  { id: 'photos', label: 'Photos', description: 'Evidence', color: 'purple' },
  { id: 'staff', label: 'Staff', description: 'Labour', color: 'pink' },
  { id: 'closeout', label: 'Day review', description: 'Check this day', color: 'slate' }, // day-review-language-v8-9k1
];

const BINDER_REGISTER_COPY = {
  tasks: {
    listTitle: 'Open actions',
    detailTitle: 'Action desk',
    unit: 'action',
    emptyAction: 'Open Tasks',
    selection: 'Select an action to review.',
  },
  materials: {
    listTitle: 'Materials register',
    detailTitle: 'Material desk',
    unit: 'material record',
    emptyAction: 'Add material',
    selection: 'Select a material to review.',
  },
  emails: {
    listTitle: 'Communications log',
    detailTitle: 'Communication desk',
    unit: 'communication',
    emptyAction: 'Add communication',
    selection: 'Select a communication to review.',
  },
  roadblocks: {
    listTitle: 'Active roadblocks',
    detailTitle: 'Roadblock desk',
    unit: 'roadblock',
    emptyAction: '+ Add Roadblock',
    selection: 'Select a roadblock to review or edit.',
  },
  walkaround: {
    listTitle: 'Site observations',
    detailTitle: 'Observation desk',
    unit: 'observation',
    emptyAction: 'Open Walkaround',
    selection: 'Select an observation to review.',
  },
  photos: {
    listTitle: 'Photo evidence',
    detailTitle: 'Evidence desk',
    unit: 'photo',
    emptyAction: 'Add photo evidence',
    selection: 'Select a photo to review.',
  },
  staff: {
    listTitle: 'Staff on site',
    detailTitle: 'Staff desk',
    unit: 'staff member',
    emptyAction: 'Open Staff diary',
    selection: 'Select a staff entry to review.',
  },
  closeout: {
    listTitle: 'Day readiness',
    detailTitle: 'Review desk',
    unit: 'check',
    emptyAction: 'Open day review',
    selection: 'Work through the readiness register.',
  },
};

const getBinderPageNumber = (tabId, pageOffset = 0) => {
  const tabIndex = Math.max(
    0,
    BINDER_TABS.findIndex((tab) => tab.id === tabId)
  );

  return String((tabIndex * 2) + pageOffset + 1).padStart(2, '0');
};

const getRequestedBinderTab = () => {
  if (typeof window === 'undefined') return 'today';

  const requestedTab = new URLSearchParams(window.location.search).get('tab');

  return BINDER_TABS.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : 'today';
};

const safeText = (value, fallback = '') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const getItemTitle = (item = {}) => safeText(
  item.title ||
  item.task_name ||
  item.name ||
  item.note ||
  item.description ||
  item.details,
  'Follow-up item'
);

const getItemDisplayTitle = (item = {}) => {
  const originalTitle = getItemTitle(item);
  const isWalkaroundCapture = /^WALKAROUND CAPTURE\s*-\s*/i.test(originalTitle);

  if (!isWalkaroundCapture) {
    return originalTitle;
  }

  const cleanedTitle = originalTitle
    .replace(/^WALKAROUND CAPTURE\s*-\s*/i, '')
    .replace(/\s+PRIORITY\s*-\s*(critical|high|medium|low)\b/gi, '')
    .replace(/\s+ACTION\s*-\s*.*$/i, '')
    .replace(/\s+NEEDS SENDING\s*-\s*/gi, ' · ')
    .replace(/\bEmail Draft\b/gi, 'Email draft')
    .replace(/\s*·\s*/g, ' · ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[.\s·-]+$/g, '')
    .trim();

  return cleanedTitle || originalTitle;
};

// LONG LINE DIARY / COMMUNICATION TITLE CONSISTENCY V8.9D2

// LONG LINE DIARY / COMMUNICATION CANONICAL TITLE PRIORITY V8.9D3

// LONG LINE DIARY / SHARED CANONICAL COMMUNICATION TITLE V8.9D4

const getCommunicationItemTitle = (item = {}) => safeText(
  item.binder_display_title ||
  item.title ||
  item.task_name ||
  item.name ||
  item.subject ||
  item.display_title ||
  item.note ||
  item.description ||
  item.details,
  'Communication follow-up'
);

const getCommunicationItemLabels = (item = {}) => {
  const searchable = [
    item.display_title,
    item.title,
    item.task_name,
    item.description,
    item.details,
    item.note,
    item.action_type,
    item.send_to,
  ].filter(Boolean).join(' ').toLowerCase();

  const labels = [];

  if (searchable.includes('email draft')) {
    labels.push('Email draft');
  } else if (searchable.includes('email')) {
    labels.push('Email');
  } else if (searchable.includes('call')) {
    labels.push('Call');
  } else if (searchable.includes('contact')) {
    labels.push('Contact');
  } else {
    labels.push('Communication');
  }

  if (
    searchable.includes('needs sending') ||
    searchable.includes('send to')
  ) {
    labels.push('Needs sending');
  }

  return labels.join(' · ');
};

const humaniseItemLabel = (value) => safeText(value)
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getDiaryDateNumber = (value) => {
  const dateKey = safeText(value).slice(0, 10);
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
};

const formatDiaryDueDate = (value) => {
  const dateKey = safeText(value).slice(0, 10);
  const parsed = new Date(`${dateKey}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) return dateKey;

  return parsed.toLocaleDateString('en-NZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

const getItemDueMeta = (item = {}, referenceDate = '') => {
  const dueDate = item.due_date || item.expected_complete_date;

  if (!dueDate) return null;

  const dueNumber = getDiaryDateNumber(dueDate);
  const referenceNumber = getDiaryDateNumber(referenceDate);

  if (dueNumber === null || referenceNumber === null) {
    return {
      label: `Due ${formatDiaryDueDate(dueDate)}`,
      tone: 'scheduled',
    };
  }

  const dayDifference = Math.round(
    (dueNumber - referenceNumber) / 86400000
  );

  if (dayDifference < 0) {
    const overdueDays = Math.abs(dayDifference);

    return {
      label: `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`,
      tone: 'overdue',
    };
  }

  if (dayDifference === 0) {
    return { label: 'Due today', tone: 'today' };
  }

  if (dayDifference === 1) {
    return { label: 'Due tomorrow', tone: 'soon' };
  }

  return {
    label: `Due ${formatDiaryDueDate(dueDate)}`,
    tone: dayDifference <= 7 ? 'soon' : 'scheduled',
  };
};

const getItemMetaTokens = (item = {}, referenceDate = '') => {
  const dueMeta = getItemDueMeta(item, referenceDate);
  const status = safeText(item.status).toLowerCase();

  return [
    item.priority
      ? { label: humaniseItemLabel(item.priority), tone: 'priority' }
      : null,
    item.owner
      ? { label: safeText(item.owner), tone: 'owner' }
      : null,
    dueMeta,
    status && status !== 'open'
      ? { label: humaniseItemLabel(status), tone: 'status' }
      : null,
  ].filter(Boolean);
};

const getItemKey = (item = {}) => {
  const id = safeText(item.id || item._id || item.item_id);

  if (id) {
    return `id:${id}`;
  }

  return `text:${[
    getItemTitle(item),
    item.due_date || item.expected_complete_date,
    item.owner,
  ]
    .map((value) => safeText(value).toLowerCase())
    .join('|')}`;
};

const uniqueItemsByKey = (items = []) => {
  const seen = new Set();

  return items.filter((item) => {
    const key = getItemKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const getEntryTime = (entry = {}) => {
  const raw = entry.created_at || entry.saved_at || entry.updated_at;

  if (!raw) return '';

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toLocaleTimeString('en-NZ', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const BinderRings = () => (
  <svg
    className="lld-binder-mechanism"
    viewBox="0 0 160 1000"
    preserveAspectRatio="none"
    aria-hidden="true"
    role="presentation"
    focusable="false"
    data-testid="lld-binder-larger-exposed-ring-mechanism-v8-5"
  >
    <defs>
      <linearGradient
        id="lld-spine-metal-v8"
        x1="0%"
        y1="0%"
        x2="100%"
        y2="0%"
      >
        <stop offset="0%" stopColor="#171615" />
        <stop offset="10%" stopColor="#45413d" />
        <stop offset="24%" stopColor="#8d8780" />
        <stop offset="38%" stopColor="#d8d3cc" />
        <stop offset="49%" stopColor="#fffdfa" />
        <stop offset="59%" stopColor="#c4beb7" />
        <stop offset="76%" stopColor="#69635d" />
        <stop offset="91%" stopColor="#36322f" />
        <stop offset="100%" stopColor="#151413" />
      </linearGradient>

      <linearGradient
        id="lld-ring-metal-v8"
        x1="0%"
        y1="0%"
        x2="0%"
        y2="100%"
      >
        <stop offset="0%" stopColor="#f3f0eb" />
        <stop offset="13%" stopColor="#c9c2ba" />
        <stop offset="31%" stopColor="#837b74" />
        <stop offset="53%" stopColor="#3c3834" />
        <stop offset="72%" stopColor="#171513" />
        <stop offset="86%" stopColor="#554f4a" />
        <stop offset="100%" stopColor="#aaa199" />
      </linearGradient>

      <linearGradient
        id="lld-join-metal-v8"
        x1="0%"
        y1="0%"
        x2="100%"
        y2="0%"
      >
        <stop offset="0%" stopColor="#24211f" />
        <stop offset="23%" stopColor="#69625c" />
        <stop offset="48%" stopColor="#b9b0a7" />
        <stop offset="67%" stopColor="#5b554f" />
        <stop offset="100%" stopColor="#211f1d" />
      </linearGradient>

      <filter
        id="lld-mechanism-shadow-v8"
        x="-35%"
        y="-10%"
        width="170%"
        height="120%"
      >
        <feDropShadow
          dx="0"
          dy="2.5"
          stdDeviation="2"
          floodColor="#000000"
          floodOpacity="0.42"
        />
      </filter>
    </defs>

    <g filter="url(#lld-mechanism-shadow-v8)">
      <rect
        x="63"
        y="18"
        width="34"
        height="964"
        rx="9"
        className="lld-binder-mechanism-spine"
      />

      <rect
        x="68"
        y="34"
        width="24"
        height="932"
        rx="6"
        className="lld-binder-mechanism-spine-inner"
      />

      <rect
        x="59"
        y="8"
        width="42"
        height="24"
        rx="6"
        className="lld-binder-mechanism-cap"
      />

      <rect
        x="59"
        y="968"
        width="42"
        height="24"
        rx="6"
        className="lld-binder-mechanism-cap"
      />

      {[108, 270, 432, 594, 756, 918].map((y) => (
        <g
          key={y}
          className="lld-binder-mechanism-ring-group"
          transform={`translate(0 ${y})`}
        >


          <circle
            cx="29"
            cy="24"
            r="6.9"
            className="lld-binder-mechanism-paper-hole"
          />

          <circle
            cx="131"
            cy="24"
            r="6.9"
            className="lld-binder-mechanism-paper-hole"
          />

          <circle
            cx="29"
            cy="24"
            r="5.25"
            className="lld-binder-mechanism-paper-hole-inner"
          />

          <circle
            cx="131"
            cy="24"
            r="5.25"
            className="lld-binder-mechanism-paper-hole-inner"
          />

          <path
            d="M29 24 C45 6.2 115 6.2 131 24"
            fill="none"
            stroke="url(#lld-ring-metal-v8)"
            className="lld-binder-mechanism-ring"
          />

          <path
            d="M34 21.1 C51 9.7 109 9.7 126 21.1"
            className="lld-binder-mechanism-ring-highlight"
          />


        </g>
      ))}

      {[70, 216, 378, 540, 702, 864, 946].map((y) => (
        <g
          key={y}
          className="lld-binder-mechanism-rivet"
        >
          <circle
            cx="80"
            cy={y}
            r="5.5"
          />

          <circle
            cx="78.3"
            cy={y - 1.7}
            r="1.5"
            className="lld-binder-mechanism-rivet-highlight"
          />
        </g>
      ))}
    </g>
  </svg>
);

const StatusChip = ({ children, tone = 'neutral' }) => (
  <span className={`lld-binder-chip lld-binder-chip-${tone}`}>
    {children}
  </span>
);

const getDiaryEntryDisplay = (entry = {}) => {
  const rawTitle = safeText(
    entry?.display_note ||
    entry?.raw_note ||
    entry?.note ||
    entry?.title,
    'Diary entry'
  );

  const structuredCapture = /(?:WALKAROUND CAPTURE|CAPTURE SITE ACTIVITY)\s*-/i.test(rawTitle);

  if (!structuredCapture) {
    return {
      title: rawTitle,
      entryType: safeText(entry?.entry_type || entry?.action_type, 'Diary'),
      priority: safeText(entry?.priority).toLowerCase(),
    };
  }

  const normalised = rawTitle
    .replace(/\s+(?=PRIORITY\s*-)/gi, '\n')
    .replace(/\s+(?=NEEDS SENDING\s*-)/gi, '\n')
    .replace(/\s+(?=ACTION\s*-)/gi, '\n')
    .replace(/\s+(?=SORT TO\s*-)/gi, '\n');

  const lines = normalised
    .split(/\r?\n/)
    .map((line) => String(line || '').trim())
    .filter(Boolean);

  const getLineValue = (prefix) => {
    const line = lines.find((candidate) => (
      candidate.toUpperCase().startsWith(prefix.toUpperCase())
    ));

    return line ? line.slice(prefix.length).trim() : '';
  };

  const category = (
    getLineValue('WALKAROUND CAPTURE - ') ||
    getLineValue('CAPTURE SITE ACTIVITY - ') ||
    safeText(entry?.entry_type, 'Site note')
  );

  const priority = safeText(
    entry?.priority || getLineValue('PRIORITY - ')
  ).toLowerCase();

  const sortIndex = lines.findIndex((line) => (
    line.toUpperCase().startsWith('SORT TO - ')
  ));

  const knownBucket = [
    'High Priority',
    'Needs Sending',
    'Questions / RFIs',
    'Roadblocks / Hold Ups',
    'Materials / Plant',
    'H&S',
    'To Do / Follow Up',
    'Diary Only',
  ].map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

  const bucketPrefix = new RegExp(
    `^(?:${knownBucket})(?:\\s*\\|\\s*(?:${knownBucket}))*\\s*`,
    'i'
  );

  const observationParts = [];

  if (sortIndex >= 0) {
    const sortValue = lines[sortIndex].slice('SORT TO - '.length).trim();
    const inlineObservation = sortValue.replace(bucketPrefix, '').trim();

    if (inlineObservation) {
      observationParts.push(inlineObservation);
    }

    observationParts.push(...lines.slice(sortIndex + 1));
  }

  const observation = observationParts
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title: observation || category || 'Diary entry',
    entryType: category,
    priority,
  };
};

const DiaryEntry = ({ entry }) => {
  const display = getDiaryEntryDisplay(entry);

  return (
    <article className="lld-binder-diary-entry">
      <time className="lld-binder-entry-time">{getEntryTime(entry)}</time>

      <div className="lld-binder-entry-copy">
        <strong>{display.title}</strong>

        {(entry?.owner || entry?.linked_task?.name) && (
          <p>
            {[entry?.owner ? `Owner: ${entry.owner}` : '', entry?.linked_task?.name]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        <div className="lld-binder-chip-row">
          {display.priority && (
            <StatusChip tone={display.priority === 'critical' || display.priority === 'high' ? 'danger' : 'warning'}>
              {display.priority}
            </StatusChip>
          )}

          <StatusChip tone="teal">{display.entryType}</StatusChip>

          {entry?.has_photos && (
            <StatusChip tone="blue">Evidence</StatusChip>
          )}
        </div>
      </div>
    </article>
  );
};

const BinderEditorShell = ({
  kicker,
  title,
  context,
  busy = false,
  onClose,
  children,
}) => {
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  }, [busy, onClose]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape' || busyRef.current) return;

      event.preventDefault();
      onCloseRef.current?.();
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  return (
    <section
      className="lld-binder-editor-shell"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lld-binder-editor-title"
      data-testid="lld-binder-editor-shell-v2s1"
    >
      <header className="lld-binder-editor-header">
        <div>
          <p>{kicker}</p>
          <h2 id="lld-binder-editor-title">{title}</h2>
          <span>{context}</span>
        </div>

        <button
          ref={closeButtonRef}
          type="button"
          className="lld-binder-editor-close"
          onClick={onClose}
          disabled={busy}
        >
          Back to binder
        </button>
      </header>

      <div className="lld-binder-editor-body">
        {children}
      </div>
    </section>
  );
};

const BinderDiaryEditor = ({
  projectName,
  selectedDateLabel,
  draft = {},
  draftStatus = '',
  categoryOptions = [],
  priorityOptions = [],
  sendToOptions = [],
  saving = false,
  onChange,
  onPhotoUpload,
  onSubmit,
  onClose,
}) => {
  const cameraInputRef = useRef(null);
  const uploadInputRef = useRef(null);
  const photos = Array.isArray(draft.photos) ? draft.photos : [];

  return (
    <BinderEditorShell
      kicker="Detailed diary entry"
      title="Add details & photos"
      context={`${selectedDateLabel} · ${projectName}`}
      busy={saving}
      onClose={onClose}
    >
      <form
        className="lld-binder-diary-editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.(event);
        }}
      >
        <div className="lld-binder-diary-editor-main">
          <label className="lld-binder-action-field lld-binder-action-field-wide">
            <span>What happened on site?</span>
            <textarea
              value={draft.note || ''}
              placeholder="Work completed, delays, deliveries, visitors, incidents, decisions or anything else that belongs in today's record..."
              onChange={(event) => onChange?.('note', event.target.value)}
              disabled={saving}
              rows="8"
              data-testid="lld-binder-diary-note-v2s1"
            />
          </label>

          <div className="lld-binder-diary-editor-fields">
            <label className="lld-binder-action-field">
              <span>Category</span>
              <select
                value={draft.entry_type || categoryOptions[0]?.value || ''}
                onChange={(event) => onChange?.('entry_type', event.target.value)}
                disabled={saving}
                data-testid="lld-binder-diary-category-v2s1"
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="lld-binder-action-field">
              <span>Priority</span>
              <select
                value={draft.priority || priorityOptions[0]?.value || ''}
                onChange={(event) => onChange?.('priority', event.target.value)}
                disabled={saving}
                data-testid="lld-binder-diary-priority-v2s1"
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="lld-binder-action-field">
              <span>Needs sending</span>
              <select
                value={draft.send_to || 'none'}
                onChange={(event) => onChange?.('send_to', event.target.value)}
                disabled={saving}
                data-testid="lld-binder-diary-send-to-v2s1"
              >
                {sendToOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <aside className="lld-binder-diary-editor-side">
          <div className="lld-binder-diary-editor-card">
            <Camera aria-hidden="true" />
            <div>
              <strong>Photo evidence</strong>
              <span>
                {photos.length > 0
                  ? `${photos.length} photo${photos.length === 1 ? '' : 's'} ready`
                  : 'No photos attached'}
              </span>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="lld-binder-editor-file-input"
              onChange={onPhotoUpload}
              disabled={saving}
              data-testid="lld-binder-diary-camera-input-v2s1"
            />

            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              multiple
              className="lld-binder-editor-file-input"
              onChange={onPhotoUpload}
              disabled={saving}
              data-testid="lld-binder-diary-upload-input-v2s1"
            />

            <div className="lld-binder-diary-editor-photo-actions">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={saving}
              >
                Take photo
              </button>

              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={saving}
              >
                Upload
              </button>
            </div>
          </div>

          <div className="lld-binder-diary-editor-card lld-binder-diary-editor-draft">
            <BookOpen aria-hidden="true" />
            <div>
              <strong>Draft protection</strong>
              <span>
                {draftStatus || 'Changes stay in the existing device draft until saved.'}
              </span>
            </div>
          </div>
        </aside>

        <div className="lld-binder-diary-editor-actions">
          <button
            type="submit"
            className="lld-binder-action-button lld-binder-action-button-primary"
            disabled={
              saving ||
              !safeText(draft.note) ||
              typeof onSubmit !== 'function'
            }
            data-testid="lld-binder-diary-save-v2s1"
          >
            {saving ? 'Saving diary entry...' : 'Save to diary'}
          </button>

          <button
            type="button"
            className="lld-binder-action-button lld-binder-action-button-quiet"
            onClick={onClose}
            disabled={saving}
          >
            Keep draft and go back
          </button>
        </div>
      </form>
    </BinderEditorShell>
  );
};

const WorkItem = ({
  item,
  tone = 'standard',
  onOpen,
  onComplete,
  completionDisabled = false,
  context = 'default',
  referenceDate = '',
}) => {
  const isCommunication = context === 'communications';

  const title = isCommunication
    ? getCommunicationItemTitle(item)
    : getItemDisplayTitle(item);

  const metaTokens = [
    isCommunication
      ? {
        label: getCommunicationItemLabels(item),
        tone: 'communication',
      }
      : null,
    ...getItemMetaTokens(item, referenceDate),
  ].filter((token) => token?.label);

  const canComplete = Boolean(item?.id && typeof onComplete === 'function');
  const canOpen = typeof onOpen === 'function';

  return (
    <article className={`lld-binder-work-item lld-binder-work-item-${tone}`}>
      <button
        type="button"
        className="lld-binder-checkbox"
        aria-label={`Mark ${title} complete`}
        title={canComplete ? `Mark ${title} complete` : 'Open the action item to complete it'}
        disabled={!canComplete || completionDisabled}
        onClick={(event) => {
          event.stopPropagation();

          if (canComplete) {
            onComplete(item);
          }
        }}
      >
        <span aria-hidden="true">
          <CheckCircle2 />
        </span>
      </button>

      <button
        type="button"
        className="lld-binder-work-open"
        aria-label={`Open ${title}`}
        disabled={!canOpen}
        onClick={() => onOpen?.(item)}
      >
        <span className="lld-binder-work-copy">

          <strong>{title}</strong>
          {metaTokens.length > 0 ? (
            <p className="lld-binder-work-meta">
              {metaTokens.map((token, index) => (
                <span
                  key={`${token.tone}-${token.label}-${index}`}
                  className={`lld-binder-work-meta-${token.tone}`}
                >
                  {token.label}
                </span>
              ))}
            </p>
          ) : (
            <p>Open follow-up</p>
          )}
        </span>


      </button>
    </article>
  );
};

const MATERIAL_STATUS_LABELS = {
  noted: 'Noted',
  delivered: 'On site',
  used: 'Used today',
  short: 'Short / missing',
  damaged: 'Damaged',
  removed: 'Removed',
};

const getMaterialStatus = (row = {}) => (
  safeText(row.status, 'noted').toLowerCase()
);

const getMaterialStatusLabel = (row = {}) => {
  const status = getMaterialStatus(row);

  return MATERIAL_STATUS_LABELS[status] ||
    status
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const MaterialLedgerRow = ({
  row = {},
  index = 0,
  onOpen,
}) => {
  const title = safeText(row.item, `Material ${index + 1}`);
  const quantity = safeText(row.quantity);
  const supplier = safeText(row.supplier_or_reference);
  const notes = safeText(row.notes);
  const status = getMaterialStatus(row);

  const meta = [
    quantity ? `Qty ${quantity}` : '',
    supplier,
    notes,
  ].filter(Boolean);

  const canOpen = typeof onOpen === 'function';

  return (
    <article
      className={`lld-binder-material-row lld-binder-material-row-${status}`}
      data-testid={`lld-binder-material-row-v8-9c-${index}`}
    >
      <span className="lld-binder-material-status">
        {getMaterialStatusLabel(row)}
      </span>

      <button
        type="button"
        className="lld-binder-material-open"
        onClick={() => onOpen?.(index)}
        disabled={!canOpen}
        aria-label={`Open materials workflow for ${title}`}
      >
        <strong>{title}</strong>

        {meta.length > 0 && (
          <p>{meta.join(' · ')}</p>
        )}
      </button>
    </article>
  );
};

const BinderMaterialDetail = ({
  material = {},
  materialSaving = false,
  onChange,
  onSave,
  onRemove,
  onClose,
}) => (
  <div
    className="lld-binder-action-detail lld-binder-material-detail"
    data-testid="lld-binder-material-detail-v8-9c2"
    aria-busy={materialSaving}
  >
    <div className="lld-binder-page-heading lld-binder-action-detail-heading">
      <div>
        <p>Material record</p>
        <h3>Material detail</h3>
        <span>Edit this material without leaving the register.</span>
      </div>

      <button
        type="button"
        className="lld-binder-action-back"
        onClick={onClose}
        disabled={materialSaving}
      >
        ← Materials
      </button>
    </div>

    <form
      className="lld-binder-action-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave?.();
      }}
    >
      <label className="lld-binder-action-field lld-binder-action-field-wide">
        <span>Material / item</span>
        <input
          type="text"
          value={material.item || ''}
          placeholder="Material or item"
          onChange={(event) => onChange?.('item', event.target.value)}
          disabled={materialSaving}
          data-testid="lld-binder-material-item-v8-9c2"
        />
      </label>

      <label className="lld-binder-action-field">
        <span>Quantity</span>
        <input
          type="text"
          value={material.quantity || ''}
          placeholder="Quantity"
          onChange={(event) => onChange?.('quantity', event.target.value)}
          disabled={materialSaving}
        />
      </label>

      <label className="lld-binder-action-field">
        <span>Status</span>
        <select
          value={material.status || 'noted'}
          onChange={(event) => onChange?.('status', event.target.value)}
          disabled={materialSaving}
          data-testid="lld-binder-material-status-v8-9c2"
        >
          <option value="noted">Noted</option>
          <option value="delivered">On site</option>
          <option value="used">Used today</option>
          <option value="short">Short / missing</option>
          <option value="damaged">Damaged</option>
          <option value="removed">Removed</option>
        </select>
      </label>

      <label className="lld-binder-action-field lld-binder-action-field-wide">
        <span>Supplier / reference</span>
        <input
          type="text"
          value={material.supplier_or_reference || ''}
          placeholder="Supplier, delivery, docket or reference"
          onChange={(event) => (
            onChange?.('supplier_or_reference', event.target.value)
          )}
          disabled={materialSaving}
        />
      </label>

      <label className="lld-binder-action-field lld-binder-action-field-wide">
        <span>Notes</span>
        <textarea
          value={material.notes || ''}
          placeholder="Location, condition, intended use or other site detail..."
          onChange={(event) => onChange?.('notes', event.target.value)}
          disabled={materialSaving}
          rows="3"
        />
      </label>

      <div className="lld-binder-action-controls">
        <button
          type="submit"
          className="lld-binder-action-button lld-binder-action-button-primary"
          disabled={
            materialSaving ||
            typeof onSave !== 'function'
          }
        >
          {materialSaving ? 'Saving…' : 'Save material'}
        </button>

        <button
          type="button"
          className="lld-binder-action-button lld-binder-material-remove"
          onClick={onRemove}
          disabled={
            materialSaving ||
            typeof onRemove !== 'function'
          }
        >
          Remove
        </button>

        <button
          type="button"
          className="lld-binder-action-button lld-binder-action-button-quiet"
          onClick={onClose}
          disabled={materialSaving}
        >
          Back to Materials
        </button>
      </div>
    </form>
  </div>
);

const formatRoadblockDate = (value) => {
  const raw = safeText(value);

  if (!raw) {
    return '';
  }

  const datePart = raw.slice(0, 10);
  const parsed = new Date(`${datePart}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return datePart;
  }

  return parsed.toLocaleDateString('en-NZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatRoadblockStatus = (value) => (
  safeText(value, 'Open')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
);

const RoadblockLedgerRow = ({
  item = {},
  index = 0,
  onOpen,
}) => {
  const title = safeText(
    item.name || item.title,
    `Roadblock ${index + 1}`
  );

  const requiredDate = formatRoadblockDate(
    item.required_by_date
  );

  const expectedDate = formatRoadblockDate(
    item.expected_complete_date
  );

  const metadata = [
    safeText(item.owner_party || item.owner),
    requiredDate ? `Required ${requiredDate}` : '',
    expectedDate ? `Expected ${expectedDate}` : '',
    item.is_hard_gate ? 'Hard gate' : '',
  ].filter(Boolean);

  return (
    <button
      type="button"
      className="lld-binder-focused-record lld-binder-roadblock-row"
      onClick={() => onOpen?.(item)}
      data-testid={`lld-binder-roadblock-row-v8-9e1-${index}`}
    >
      <span className="lld-binder-roadblock-status">
        {formatRoadblockStatus(item.status)}
      </span>

      <div>
        <strong>{title}</strong>

        {metadata.length > 0 && (
          <small>{metadata.join(' · ')}</small>
        )}
      </div>
    </button>
  );
};

const BinderRoadblockDetail = ({
  roadblock = {},
  onOpenWorkflow,
  onClose,
}) => {
  const title = safeText(
    roadblock.name || roadblock.title,
    'Roadblock / concern'
  );

  const requiredDate = formatRoadblockDate(
    roadblock.required_by_date
  );

  const expectedDate = formatRoadblockDate(
    roadblock.expected_complete_date
  );

  const description = safeText(
    roadblock.description,
    'No additional description or impact has been recorded.'
  );

  return (
    <div
      className="lld-binder-action-detail lld-binder-roadblock-detail"
      data-testid="lld-binder-roadblock-detail-v8-9e1"
    >
      <div className="lld-binder-page-heading lld-binder-action-detail-heading">
        <div>
          <p>Roadblock record</p>
          <h3>Roadblock detail</h3>
          <span>
            Review the issue without leaving the open binder.
          </span>
        </div>

        <button
          type="button"
          className="lld-binder-action-back"
          onClick={onClose}
        >
          ← Roadblocks
        </button>
      </div>

      <div className="lld-binder-roadblock-detail-grid">
        <div className="lld-binder-roadblock-field lld-binder-roadblock-field-wide">
          <span>Roadblock / concern</span>
          <strong>{title}</strong>
        </div>

        <div className="lld-binder-roadblock-field">
          <span>Status</span>
          <strong>
            {formatRoadblockStatus(roadblock.status)}
          </strong>
        </div>

        <div className="lld-binder-roadblock-field">
          <span>Owner</span>
          <strong>
            {safeText(
              roadblock.owner_party || roadblock.owner,
              'Not assigned'
            )}
          </strong>
        </div>

        <div className="lld-binder-roadblock-field">
          <span>Required by</span>
          <strong>{requiredDate || 'Not set'}</strong>
        </div>

        <div className="lld-binder-roadblock-field">
          <span>Expected complete</span>
          <strong>{expectedDate || 'Not set'}</strong>
        </div>

        <div className="lld-binder-roadblock-field">
          <span>Programme</span>
          <strong>
            {roadblock.linked_task_id
              ? 'Linked to programme'
              : 'Not linked'}
          </strong>
        </div>

        <div className="lld-binder-roadblock-field">
          <span>Control</span>
          <strong>
            {roadblock.is_hard_gate
              ? 'Hard gate'
              : roadblock.is_optional
                ? 'Optional'
                : 'Standard gate'}
          </strong>
        </div>

        <div className="lld-binder-roadblock-field lld-binder-roadblock-field-wide">
          <span>Description / impact</span>
          <p>{description}</p>
        </div>
      </div>

      <div className="lld-binder-roadblock-actions">
        <button
          type="button"
          className="lld-binder-action-primary"
          onClick={onOpenWorkflow}
        >
          Open full Roadblocks workflow
        </button>

        <button
          type="button"
          className="lld-binder-action-secondary"
          onClick={onClose}
        >
          Back to Roadblocks
        </button>
      </div>
    </div>
  );
};
// binder-native-roadblock-editor-v2s2f
const BinderRoadblockEditor = ({
  roadblock = null,
  saving = false,
  onSave,
  onComplete,
  onReopen,
  onClose,
}) => {
  const makeDraft = (source = {}) => ({
    name: safeText(source?.name || source?.title),
    description: safeText(source?.description),
    order: source?.order ?? 0,
    owner_party: safeText(source?.owner_party || source?.owner || 'YOU') || 'YOU',
    required_by_date: safeText(source?.required_by_date).slice(0, 10),
    expected_complete_date: safeText(source?.expected_complete_date).slice(0, 10),
    buffer_days: source?.buffer_days ?? 2,
    depends_on_gate_ids: Array.isArray(source?.depends_on_gate_ids)
      ? source.depends_on_gate_ids
      : [],
    is_hard_gate: Boolean(source?.is_hard_gate),
    is_optional: Boolean(source?.is_optional),
  });

  const [draft, setDraft] = useState(() => makeDraft(roadblock || {}));

  useEffect(() => {
    setDraft(makeDraft(roadblock || {}));
  }, [roadblock?.id]);

  const updateDraft = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const status = safeText(roadblock?.status).toUpperCase();

  const completed = [
    'COMPLETED',
    'COMPLETE',
    'CLOSED',
    'DONE',
  ].includes(status);

  const submit = async (event) => {
    event.preventDefault();

    if (!draft.name.trim()) return;

    const saved = await onSave?.(
      draft,
      roadblock?.id || null
    );

    if (saved !== false && !roadblock?.id) {
      onClose?.();
    }
  };

  return (
    <div
      className="lld-binder-action-detail lld-binder-roadblock-detail"
      data-testid="lld-binder-roadblock-editor-v2s2f"
      aria-busy={saving}
    >
      <div className="lld-binder-page-heading lld-binder-action-detail-heading">
        <div>
          <p>Roadblock record</p>
          <h3>
            {roadblock?.id
              ? 'Edit Roadblock'
              : 'Add Roadblock'}
          </h3>
          <span>
            Record the issue, impact, ownership and required dates without leaving the Diary.
          </span>
        </div>

        <button
          type="button"
          className="lld-binder-action-back"
          onClick={onClose}
          disabled={saving}
        >
          ← Roadblocks
        </button>
      </div>

      <form
        className="lld-binder-action-form"
        onSubmit={submit}
      >
        <label className="lld-binder-action-field lld-binder-action-field-wide">
          <span>Roadblock / Concern</span>
          <input
            type="text"
            value={draft.name}
            placeholder="Short description of the issue"
            onChange={(event) => updateDraft('name', event.target.value)}
            disabled={saving}
            required
          />
        </label>

        <label className="lld-binder-action-field lld-binder-action-field-wide">
          <span>Impact / details</span>
          <textarea
            value={draft.description}
            placeholder="What is blocked, what is the impact, and what needs to happen?"
            onChange={(event) => updateDraft('description', event.target.value)}
            disabled={saving}
            rows="4"
          />
        </label>

        <label className="lld-binder-action-field">
          <span>Owner</span>
          <input
            type="text"
            value={draft.owner_party}
            placeholder="YOU, contractor, client..."
            onChange={(event) => updateDraft('owner_party', event.target.value)}
            disabled={saving}
          />
        </label>

        <label className="lld-binder-action-field">
          <span>Required by</span>
          <input
            type="date"
            value={draft.required_by_date}
            onChange={(event) => updateDraft('required_by_date', event.target.value)}
            disabled={saving}
          />
        </label>

        <label className="lld-binder-action-field">
          <span>Expected complete</span>
          <input
            type="date"
            value={draft.expected_complete_date}
            onChange={(event) => updateDraft('expected_complete_date', event.target.value)}
            disabled={saving}
          />
        </label>

        <label className="lld-binder-action-field">
          <span>Risk buffer (days)</span>
          <input
            type="number"
            min="0"
            step="1"
            value={draft.buffer_days}
            onChange={(event) => updateDraft('buffer_days', event.target.value)}
            disabled={saving}
          />
        </label>

        <label className="lld-binder-action-field">
          <span>Control</span>
          <select
            value={
              draft.is_hard_gate
                ? 'hard'
                : draft.is_optional
                  ? 'optional'
                  : 'standard'
            }
            onChange={(event) => {
              const value = event.target.value;

              updateDraft(
                'is_hard_gate',
                value === 'hard'
              );

              setDraft((current) => ({
                ...current,
                is_hard_gate: value === 'hard',
                is_optional: value === 'optional',
              }));
            }}
            disabled={saving}
          >
            <option value="standard">Standard</option>
            <option value="hard">Hard gate</option>
            <option value="optional">Optional</option>
          </select>
        </label>

        {roadblock?.id && (
          <div className="lld-binder-action-field">
            <span>Status</span>
            <strong>
              {formatRoadblockStatus(roadblock.status)}
            </strong>
          </div>
        )}

        <div className="lld-binder-action-controls">
          <button
            type="submit"
            className="lld-binder-action-button lld-binder-action-button-primary"
            disabled={saving || !draft.name.trim()}
          >
            {saving
              ? 'Saving…'
              : roadblock?.id
                ? 'Save changes'
                : 'Add Roadblock'}
          </button>

          {roadblock?.id && !completed && (
            <button
              type="button"
              className="lld-binder-action-button"
              onClick={() => onComplete?.(roadblock)}
              disabled={saving || typeof onComplete !== 'function'}
            >
              Mark complete
            </button>
          )}

          {roadblock?.id && completed && (
            <button
              type="button"
              className="lld-binder-action-button"
              onClick={() => onReopen?.(roadblock)}
              disabled={saving || typeof onReopen !== 'function'}
            >
              Reopen Roadblock
            </button>
          )}

          <button
            type="button"
            className="lld-binder-action-button lld-binder-action-button-quiet"
            onClick={onClose}
            disabled={saving}
          >
            Back to Roadblocks
          </button>
        </div>
      </form>
    </div>
  );
};

const formatWalkaroundDate = (value) => {
  const raw = safeText(value);

  if (!raw) {
    return '';
  }

  const datePart = raw.slice(0, 10);
  const parsed = new Date(`${datePart}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return datePart;
  }

  return parsed.toLocaleDateString('en-NZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatWalkaroundDateTime = (value) => {
  const raw = safeText(value);

  if (!raw) {
    return '';
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  return parsed.toLocaleString('en-NZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getWalkaroundEntryDisplay = (entry = {}) => {
  const rawNote = safeText(
    entry.note,
    'Walkaround observation'
  );

  const lines = rawNote.split(/\r?\n/);

  const getLineValue = (prefix) => {
    const upperPrefix = prefix.toUpperCase();

    const line = lines
      .map((candidate) => String(candidate || '').trim())
      .find((candidate) => (
        candidate.toUpperCase().startsWith(upperPrefix)
      ));

    return line
      ? line.slice(prefix.length).trim()
      : '';
  };

  const structuredPrefixes = [
    'WALKAROUND CAPTURE - ',
    'CAPTURE SITE ACTIVITY - ',
    'PRIORITY - ',
    'NEEDS SENDING - ',
    'ACTION - ',
    'SORT TO - ',
  ];

  const observation = lines
    .map((line) => String(line || '').trim())
    .filter((line) => (
      line &&
      !structuredPrefixes.some((prefix) => (
        line.toUpperCase().startsWith(prefix)
      ))
    ))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const category = (
    getLineValue('WALKAROUND CAPTURE - ') ||
    getLineValue('CAPTURE SITE ACTIVITY - ') ||
    'Site observation'
  );

  const sendTo = getLineValue('NEEDS SENDING - ');
  const action = getLineValue('ACTION - ');
  const buckets = getLineValue('SORT TO - ');

  const priority = safeText(
    entry.priority ||
      getLineValue('PRIORITY - '),
    'medium'
  ).toLowerCase();

  return {
    observation: observation || rawNote,
    category,
    sendTo,
    action,
    buckets,
    priority,
    owner: safeText(entry.owner, 'Not assigned'),
    capturedAt: formatWalkaroundDateTime(entry.created_at),
    dueDate: formatWalkaroundDate(entry.due_date),
    expectedDate: formatWalkaroundDate(
      entry.expected_complete_date
    ),
    photos: Array.isArray(entry.photos)
      ? entry.photos.filter(Boolean)
      : [],
  };
};

const WalkaroundLedgerRow = ({
  item = {},
  index = 0,
  onOpen,
}) => {
  const display = getWalkaroundEntryDisplay(item);

  const metadata = [
    display.category,
    display.owner,
    display.capturedAt,
    display.photos.length > 0
      ? `${display.photos.length} photo${display.photos.length === 1 ? '' : 's'}`
      : '',
  ].filter(Boolean);

  const priorityLabel = (
    display.priority === 'critical'
      ? 'CRIT'
      : display.priority === 'high'
        ? 'HIGH'
        : display.priority === 'low'
          ? 'LOW'
          : 'MED'
  );

  return (
    <button
      type="button"
      className="lld-binder-focused-record lld-binder-walkaround-row"
      onClick={() => onOpen?.(item)}
      data-testid={`lld-binder-walkaround-row-v8-9f1-${index}`}
    >
      <span
        className={`lld-binder-walkaround-priority lld-binder-walkaround-priority-${display.priority}`}
      >
        {priorityLabel}
      </span>

      <div className="lld-binder-walkaround-row-copy">
        <strong>{display.observation}</strong>

        {metadata.length > 0 && (
          <small>{metadata.join(' · ')}</small>
        )}
      </div>

      {display.photos[0] ? (
        <img
          src={display.photos[0]}
          alt=""
          className="lld-binder-walkaround-thumbnail"
        />
      ) : (
        <span
          className="lld-binder-walkaround-no-photo"
          aria-label="No photo attached"
        >
          No photo
        </span>
      )}
    </button>
  );
};

const BinderWalkaroundDetail = ({
  entry = {},
  onOpenWorkflow,
  onClose,
}) => {
  const display = getWalkaroundEntryDisplay(entry);

  return (
    <div
      className="lld-binder-action-detail lld-binder-walkaround-detail"
      data-testid="lld-binder-walkaround-detail-v8-9f1"
    >
      <div className="lld-binder-page-heading lld-binder-action-detail-heading">
        <div>
          <p>Site observation</p>
          <h3>Walkaround detail</h3>
          <span>
            Review captured site evidence without leaving the binder.
          </span>
        </div>

        <button
          type="button"
          className="lld-binder-action-back"
          onClick={onClose}
        >
          ← Walkaround
        </button>
      </div>

      <div className="lld-binder-walkaround-detail-grid">
        <div className="lld-binder-walkaround-field lld-binder-walkaround-field-wide">
          <span>Observation</span>
          <strong>{display.observation}</strong>
        </div>

        <div className="lld-binder-walkaround-field">
          <span>Category</span>
          <strong>{display.category}</strong>
        </div>

        <div className="lld-binder-walkaround-field">
          <span>Priority</span>
          <strong>{display.priority.toUpperCase()}</strong>
        </div>

        <div className="lld-binder-walkaround-field">
          <span>Owner</span>
          <strong>{display.owner}</strong>
        </div>

        <div className="lld-binder-walkaround-field">
          <span>Captured</span>
          <strong>{display.capturedAt || 'Not recorded'}</strong>
        </div>

        <div className="lld-binder-walkaround-field">
          <span>Due</span>
          <strong>{display.dueDate || 'Not set'}</strong>
        </div>

        <div className="lld-binder-walkaround-field">
          <span>Expected complete</span>
          <strong>{display.expectedDate || 'Not set'}</strong>
        </div>

        <div className="lld-binder-walkaround-field">
          <span>Roadblock link</span>
          <strong>
            {entry.gate_id
              ? 'Linked to roadblock'
              : 'Not linked'}
          </strong>
        </div>

        <div className="lld-binder-walkaround-field">
          <span>Programme link</span>
          <strong>
            {entry.task_id
              ? 'Linked to programme'
              : 'Not linked'}
          </strong>
        </div>

        <div className="lld-binder-walkaround-field">
          <span>Follow-up</span>
          <strong>
            {entry.action_item_id
              ? 'Action Item created'
              : display.action || 'Diary evidence only'}
          </strong>
        </div>

        <div className="lld-binder-walkaround-field">
          <span>Needs sending</span>
          <strong>{display.sendTo || 'No'}</strong>
        </div>

        {display.buckets && (
          <div className="lld-binder-walkaround-field lld-binder-walkaround-field-wide">
            <span>Work-through categories</span>
            <p>{display.buckets}</p>
          </div>
        )}
      </div>

      {display.photos.length > 0 && (
        <div className="lld-binder-walkaround-evidence">
          <div>
            <span>Photo evidence</span>
            <strong>
              {display.photos.length} attached
            </strong>
          </div>

          <div className="lld-binder-walkaround-photo-grid">
            {display.photos.map((photo, photoIndex) => (
              <img
                key={`${entry.id || 'walkaround'}-${photoIndex}`}
                src={photo}
                alt={`Walkaround evidence ${photoIndex + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="lld-binder-walkaround-actions">
        <button
          type="button"
          className="lld-binder-action-primary"
          onClick={onOpenWorkflow}
        >
          Open full Walkaround workflow
        </button>

        <button
          type="button"
          className="lld-binder-action-secondary"
          onClick={onClose}
        >
          Back to Walkaround
        </button>
      </div>
    </div>
  );
};
// binder-native-walkaround-add-v2s2g1
const BinderWalkaroundAdd = ({ saving = false, onSave, onClose }) => {
  const [draft, setDraft] = useState({
    observation: '', category: 'general_note', priority: 'medium',
    owner: 'Me', due_date: '', send_to: 'none',
  });
  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!safeText(draft.observation)) return;
    const saved = await onSave?.(draft);
    if (saved !== false) onClose?.();
  };
  return (
    <div className="lld-binder-action-detail lld-binder-walkaround-detail" data-testid="lld-binder-walkaround-add-v2s2g1" aria-busy={saving}>
      <div className="lld-binder-page-heading lld-binder-action-detail-heading">
        <div><p>Site observation</p><h3>Add Observation</h3><span>Record what you saw without leaving the Diary.</span></div>
        <button type="button" className="lld-binder-action-back" onClick={onClose} disabled={saving}>&larr; Walkaround</button>
      </div>
      <form className="lld-binder-action-form" onSubmit={submit}>
        <label className="lld-binder-action-field lld-binder-action-field-wide"><span>Observation</span><textarea value={draft.observation} placeholder="What did you see on site?" onChange={(e) => updateDraft('observation', e.target.value)} disabled={saving} rows="5" required /></label>
        <label className="lld-binder-action-field"><span>Category</span><select value={draft.category} onChange={(e) => updateDraft('category', e.target.value)} disabled={saving}>
          <option value="progress">Progress</option><option value="labour">Labour</option><option value="materials_plant">Materials / Plant</option><option value="question_rfi">Question / RFI</option><option value="issue_defect">Issue / Defect</option><option value="clash_holdup">Clash / Hold Up</option><option value="health_safety">H&amp;S</option><option value="staff_message">Staff Message</option><option value="general_note">General Note</option>
        </select></label>
        <label className="lld-binder-action-field"><span>Priority</span><select value={draft.priority} onChange={(e) => updateDraft('priority', e.target.value)} disabled={saving}><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
        <label className="lld-binder-action-field"><span>Owner</span><input type="text" value={draft.owner} placeholder="Me, Site, MC, Subbies..." onChange={(e) => updateDraft('owner', e.target.value)} disabled={saving} /></label>
        <label className="lld-binder-action-field"><span>Due date</span><input type="date" value={draft.due_date} onChange={(e) => updateDraft('due_date', e.target.value)} disabled={saving} /></label>
        <label className="lld-binder-action-field"><span>Needs sending</span><select value={draft.send_to} onChange={(e) => updateDraft('send_to', e.target.value)} disabled={saving}><option value="none">No</option><option value="staff">Staff</option><option value="builder">Builder</option><option value="client">Client</option><option value="architect">Architect</option><option value="supplier">Supplier</option><option value="subbie">Subbie</option><option value="email_draft">Email Draft</option></select></label>
        <div className="lld-binder-action-controls"><button type="submit" className="lld-binder-action-button lld-binder-action-button-primary" disabled={saving || !safeText(draft.observation)}>{saving ? 'Saving...' : 'Add Observation'}</button><button type="button" className="lld-binder-action-button lld-binder-action-button-quiet" onClick={onClose} disabled={saving}>Back to Walkaround</button></div>
      </form>
    </div>
  );
};const formatStaffTime = (value) => {
  const text = safeText(value);

  if (!text) {
    return 'Not set';
  }

  const match = text.match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    return text;
  }

  const hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
};

const formatStaffLunch = (value) => {
  const minutes = safeText(value, '0');

  if (minutes === '0') {
    return 'No lunch';
  }

  return `${minutes} min`;
};

// staff-register-daily-attendance-v1
const STAFF_ATTENDANCE_OPTIONS = [
  { value: 'at_work', label: 'At work' },
  { value: 'sick', label: 'Sick' },
  { value: 'annual_leave', label: 'Annual leave' },
  { value: 'public_holiday', label: 'Public holiday' },
  { value: 'away_other_site', label: 'Away / other site' },
  { value: 'no_work', label: 'No work' }
];

const getStaffAttendanceLabel = (value) => (
  STAFF_ATTENDANCE_OPTIONS.find(
    (option) => option.value === value
  )?.label || 'At work'
);

const getStaffRowDisplay = (row = {}) => {
  const employeeName = safeText(row.employee_name, 'Unnamed staff member');
  const numericHours = Number(row.total_hours || 0);
  const hours = Number.isFinite(numericHours) ? numericHours : 0;
  const rawStatus = safeText(row.sync_status || row.source).toLowerCase();

  let handoffStatus = 'LLD diary row';

  if (rawStatus.includes('import')) {
    handoffStatus = 'Imported to Timesheet';
  } else if (rawStatus.includes('pending_timesheet_staff')) {
    handoffStatus = 'Site-only diary staff';
  } else if (rawStatus.includes('timesheet')) {
    handoffStatus = 'Timesheet-linked staff';
  }

  return {
    employeeName,
    initials: employeeName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'ST',
    start: formatStaffTime(row.start_time),
    finish: formatStaffTime(row.finish_time),
    lunch: formatStaffLunch(row.lunch_duration),
    hours,
    attendanceStatus: row.attendance_status || 'at_work',
    attendanceLabel: getStaffAttendanceLabel(
      row.attendance_status || 'at_work'
    ),
    jobNumber: safeText(row.job_number, 'Not set'),
    taskCode: safeText(row.task_code, 'Not set'),
    notes: safeText(row.description || row.other, 'No notes recorded'),
    source: safeText(row.source, 'LLD'),
    handoffStatus,
  };
};

const StaffLedgerRow = ({
  item = {},
  index = 0,
  onOpen,
}) => {
  const display = getStaffRowDisplay(item);

  const timeSummary =
    display.attendanceStatus !== 'at_work'
      ? display.attendanceLabel
      : display.start !== 'Not set' && display.finish !== 'Not set'
        ? `${display.start} to ${display.finish}`
        : display.start !== 'Not set'
          ? `Started ${display.start}`
          : display.finish !== 'Not set'
            ? `Finished ${display.finish}`
            : 'Time not entered'; // staff-missing-time-wording-v8-9h1-1

  const metadata = [
    timeSummary,
    display.taskCode !== 'Not set' ? display.taskCode : '',
    display.jobNumber !== 'Not set' ? display.jobNumber : '',
  ].filter(Boolean);

  return (
    <button
      type="button"
      className="lld-binder-focused-record lld-binder-staff-row"
      onClick={() => onOpen?.(item)}
      data-testid={`lld-binder-staff-row-v8-9h1-${index}`}
    >
      <span className="lld-binder-staff-initials" aria-hidden="true">
        {display.initials}
      </span>

      <div className="lld-binder-staff-row-copy">
        <strong>{display.employeeName}</strong>

        {metadata.length > 0 && (
          <small>{metadata.join(' · ')}</small>
        )}
      </div>

      <span className="lld-binder-staff-hours">
        {display.hours.toFixed(2)}h
      </span>
    </button>
  );
};

// staff-register-compact-crew-list-v1
const STAFF_STATUS_DISPLAY = {
  at_work: {
    label: 'Working',
    shortLabel: 'Work',
    className: 'is-working'
  },
  sick: {
    label: 'Sick',
    shortLabel: 'Sick',
    className: 'is-sick'
  },
  annual_leave: {
    label: 'Annual leave',
    shortLabel: 'Leave',
    className: 'is-leave'
  },
  public_holiday: {
    label: 'Public holiday',
    shortLabel: 'Holiday',
    className: 'is-holiday'
  },
  away_other_site: {
    label: 'Other site',
    shortLabel: 'Other',
    className: 'is-other-site'
  },
  no_work: {
    label: 'No work',
    shortLabel: 'No work',
    className: 'is-no-work'
  }
};

const CompactStaffCrewList = ({
  rows = [],
  selectedStaffId = null,
  selectedDateLabel = '',
  staffSaving = false,
  onSelect,
  onAddStaff,
  onSetAllNormalDay
}) => {
  const [search, setSearch] = useState('');
  const [reportJobFilter, setReportJobFilter] = useState('');
  const staffRows = Array.isArray(rows) ? rows : [];

  // staff-register-grouped-crew-list-v1
  const groupedStaff = useMemo(() => {
    const groups = new Map();

    staffRows.forEach((row, index) => {
      const employeeId = String(row.employee_id || '').trim();
      const employeeName = String(row.employee_name || '').trim();

      const groupKey = employeeId
        ? `employee:${employeeId}`
        : `name:${employeeName.toLowerCase() || `staff-${index}`}`;

      const rowId =
        row._binderStaffId ||
        `binder-staff-${row._binderStaffIndex ?? index}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          groupKey,
          employee_name: employeeName || `Staff ${index + 1}`,
          attendance_status: row.attendance_status || 'at_work',
          firstRow: row,
          allocationRows: [],
          total_hours: 0
        });
      }

      const group = groups.get(groupKey);

      group.allocationRows.push({
        ...row,
        _groupRowId: rowId
      });

      group.total_hours += Number(row.total_hours || 0);

      if (
        group.attendance_status === 'at_work' &&
        row.attendance_status &&
        row.attendance_status !== 'at_work'
      ) {
        group.attendance_status = row.attendance_status;
      }
    });

    return Array.from(groups.values()).map((group) => {
      const allocationLabels = Array.from(
        new Set(
          group.allocationRows.map((row) => {
            const job =
              String(row.job_number || '').trim() || 'No job';

            const task =
              String(row.task_code || '').trim() || 'No task';

            return `${job} · ${task}`;
          })
        )
      );

      return {
        ...group,
        allocationSummary:
          allocationLabels.join(' | ') ||
          'No job or task allocated',
        searchText: [
          group.employee_name,
          ...group.allocationRows.flatMap((row) => [
            row.job_number,
            row.task_code,
            row.description,
            row.other
          ])
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
      };
    });
  }, [staffRows]);

  // staff-register-report-exports-v1
  const reportJobOptions = Array.from(
    new Set(
      staffRows
        .map((row) => String(row.job_number || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: 'base'
  }));

  const escapeReportHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const getReportStatus = (value) => (
    STAFF_STATUS_DISPLAY[value || 'at_work']?.label ||
    STAFF_STATUS_DISPLAY.at_work.label
  );

  const openStaffReport = (reportType) => {
    const filteredRows = staffRows.filter((row) => (
      !reportJobFilter ||
      String(row.job_number || '').trim() === reportJobFilter
    ));

    if (filteredRows.length === 0) {
      window.alert('No staff rows match the selected job filter.');
      return;
    }

    const reportGroups = new Map();

    filteredRows.forEach((row, index) => {
      const employeeId = String(row.employee_id || '').trim();
      const employeeName =
        String(row.employee_name || '').trim() ||
        `Staff ${index + 1}`;

      const groupKey = employeeId
        ? `employee:${employeeId}`
        : `name:${employeeName.toLowerCase()}`;

      if (!reportGroups.has(groupKey)) {
        reportGroups.set(groupKey, {
          employeeName,
          status: row.attendance_status || 'at_work',
          rows: [],
          totalHours: 0
        });
      }

      const group = reportGroups.get(groupKey);

      group.rows.push(row);
      group.totalHours += Number(row.total_hours || 0);

      if (
        group.status === 'at_work' &&
        row.attendance_status &&
        row.attendance_status !== 'at_work'
      ) {
        group.status = row.attendance_status;
      }
    });

    const people = Array.from(reportGroups.values());

    const reportTitle =
      reportType === 'full'
        ? 'Detailed Labour Report'
        : 'Site Labour Summary';

    const jobLabel =
      reportJobFilter || 'All job numbers';

    const summaryRows = people.map((person) => {
      const jobs = Array.from(new Set(
        person.rows.map((row) => (
          String(row.job_number || '').trim() || 'Not allocated'
        ))
      )).join(', ');

      const tasks = Array.from(new Set(
        person.rows.map((row) => (
          String(row.task_code || '').trim() || 'Not allocated'
        ))
      )).join(', ');

      return `
        <tr>
          <td>${escapeReportHtml(person.employeeName)}</td>
          <td>${escapeReportHtml(jobs)}</td>
          <td>${escapeReportHtml(tasks)}</td>
          <td>${escapeReportHtml(getReportStatus(person.status))}</td>
          <td class="number">${person.totalHours.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const fullRows = filteredRows.map((row, index) => `
      <tr>
        <td>${escapeReportHtml(row.employee_name || `Staff ${index + 1}`)}</td>
        <td>${escapeReportHtml(row.job_number || 'Not allocated')}</td>
        <td>${escapeReportHtml(row.task_code || 'Not allocated')}</td>
        <td>${escapeReportHtml(getReportStatus(row.attendance_status))}</td>
        <td>${escapeReportHtml(row.start_time || '')}</td>
        <td>${escapeReportHtml(row.finish_time || '')}</td>
        <td class="number">${escapeReportHtml(row.lunch_duration || '0')}</td>
        <td class="number">${Number(row.total_hours || 0).toFixed(2)}</td>
        <td>${escapeReportHtml(row.description || row.other || '')}</td>
      </tr>
    `).join('');

    const table =
      reportType === 'full'
        ? `
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Job number</th>
                <th>Task code / task</th>
                <th>Status</th>
                <th>Start</th>
                <th>Finish</th>
                <th>Lunch</th>
                <th>Hours</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>${fullRows}</tbody>
          </table>
        `
        : `
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Job number</th>
                <th>Task code / task</th>
                <th>Status</th>
                <th>Total hours</th>
              </tr>
            </thead>
            <tbody>${summaryRows}</tbody>
          </table>
        `;

    const totalHours = filteredRows.reduce(
      (total, row) => total + Number(row.total_hours || 0),
      0
    );

    const reportWindow = window.open(
      '',
      '_blank',
      'noopener,noreferrer'
    );

    if (!reportWindow) {
      window.alert(
        'The report window was blocked. Allow pop-ups for this site and try again.'
      );
      return;
    }

    reportWindow.document.open();
    reportWindow.document.write(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${escapeReportHtml(reportTitle)}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 12mm;
            }

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              color: #111;
              background: #fff;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 10px;
              line-height: 1.35;
            }

            header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 24px;
              margin-bottom: 12px;
              border-bottom: 2px solid #111;
              padding-bottom: 8px;
            }

            h1 {
              margin: 0 0 4px;
              font-size: 20px;
            }

            header p,
            footer p {
              margin: 2px 0;
            }

            .meta {
              text-align: right;
              white-space: nowrap;
            }

            .totals {
              display: flex;
              gap: 20px;
              margin: 0 0 10px;
              border: 1px solid #bbb;
              padding: 7px 9px;
              font-size: 11px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: auto;
            }

            thead {
              display: table-header-group;
            }

            tr {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            th,
            td {
              border: 1px solid #999;
              padding: 5px 6px;
              vertical-align: top;
              text-align: left;
            }

            th {
              background: #eee;
              font-weight: 700;
            }

            td.number,
            th.number {
              text-align: right;
              white-space: nowrap;
            }

            footer {
              margin-top: 10px;
              border-top: 1px solid #999;
              padding-top: 7px;
              color: #444;
              font-size: 9px;
            }

            .screen-actions {
              display: flex;
              justify-content: flex-end;
              gap: 8px;
              margin-bottom: 10px;
            }

            .screen-actions button {
              border: 1px solid #333;
              border-radius: 4px;
              background: #fff;
              padding: 7px 12px;
              cursor: pointer;
              font-weight: 700;
            }

            @media print {
              .screen-actions {
                display: none;
              }
            }
          </style>
        </head>

        <body>
          <div class="screen-actions">
            <button type="button" onclick="window.print()">
              Print / Save PDF
            </button>
            <button type="button" onclick="window.close()">
              Close
            </button>
          </div>

          <header>
            <div>
              <h1>${escapeReportHtml(reportTitle)}</h1>
              <p>Project: ${escapeReportHtml(selectedDateLabel || 'Selected diary day')}</p>
              <p>Job filter: ${escapeReportHtml(jobLabel)}</p>
            </div>

            <div class="meta">
              <p>Date: ${escapeReportHtml(selectedDateLabel)}</p>
              <p>Generated: ${escapeReportHtml(
                new Intl.DateTimeFormat('en-NZ', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'Pacific/Auckland'
                }).format(new Date())
              )}</p>
            </div>
          </header>

          <div class="totals">
            <strong>${people.length} people</strong>
            <strong>${filteredRows.length} job/task rows</strong>
            <strong>${totalHours.toFixed(2)} total hours</strong>
          </div>

          ${table}

          <footer>
            <p>
              Information only. This report records labour attendance and work allocation
              supplied for site coordination. It is not a signed timesheet or payroll approval.
            </p>
          </footer>
        </body>
      </html>
    `);

    reportWindow.document.close();
    reportWindow.focus();
  };

  const query = search.trim().toLowerCase();

  const filteredStaff = groupedStaff.filter(
    (worker) => !query || worker.searchText.includes(query)
  );

  const totals = groupedStaff.reduce((result, worker) => {
    const status = worker.attendance_status || 'at_work';

    result.total += 1;

    if (status === 'at_work') result.working += 1;
    else if (status === 'sick') result.sick += 1;
    else if (status === 'annual_leave') result.leave += 1;
    else if (status === 'away_other_site') result.otherSite += 1;

    return result;
  }, {
    total: 0,
    working: 0,
    sick: 0,
    leave: 0,
    otherSite: 0
  });

  return (
    <section
      className="lld-staff-crew-index"
      data-testid="staff-register-compact-crew-list-v1"
      data-grouped-crew="staff-register-grouped-crew-list-v1"
      aria-label="Staff crew list"
    >
      <div className="lld-staff-crew-index-heading">
        <div>
          <p>Labour</p>
          <h3>Staff on site</h3>
          <span>{selectedDateLabel}</span>
        </div>

        <strong>{totals.total}</strong>
      </div>

      <div
        className="lld-staff-crew-totals"
        aria-label="Daily staff totals"
      >
        <span><strong>{totals.working}</strong>Working</span>
        <span><strong>{totals.sick}</strong>Sick</span>
        <span><strong>{totals.leave}</strong>Leave</span>
        <span><strong>{totals.otherSite}</strong>Other</span>
      </div>

      <div className="lld-staff-crew-actions">
        <button
          type="button"
          onClick={onAddStaff}
          disabled={staffSaving || typeof onAddStaff !== 'function'}
        >
          + Add staff
        </button>

        <button
          type="button"
          onClick={onSetAllNormalDay}
          disabled={
            staffSaving ||
            staffRows.length === 0 ||
            typeof onSetAllNormalDay !== 'function'
          }
        >
          Mark all at work
        </button>
      </div>

      <label className="lld-staff-crew-search">
        <span className="sr-only">Search staff</span>
        <input
          type="search"
          value={search}
          placeholder="Search staff, job or task..."
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <section
        className="lld-staff-report-controls"
        data-testid="staff-register-report-exports-v1"
        aria-label="Staff reports"
      >
        <label>
          <span>Report job</span>

          <select
            value={reportJobFilter}
            onChange={(event) => (
              setReportJobFilter(event.target.value)
            )}
            disabled={staffSaving || staffRows.length === 0}
          >
            <option value="">All job numbers</option>

            {reportJobOptions.map((jobNumber) => (
              <option key={jobNumber} value={jobNumber}>
                {jobNumber}
              </option>
            ))}
          </select>
        </label>

        <div>
          <button
            type="button"
            onClick={() => openStaffReport('summary')}
            disabled={staffSaving || staffRows.length === 0}
          >
            Summary Report
          </button>

          <button
            type="button"
            onClick={() => openStaffReport('full')}
            disabled={staffSaving || staffRows.length === 0}
          >
            Full Report
          </button>
        </div>

        <small>
          Plain information-only reports. No signatures or LLD branding.
        </small>
      </section>

      {groupedStaff.length === 0 ? (
        <div className="lld-staff-crew-empty">
          <strong>No staff added</strong>
          <p>Add the crew once, then update only daily exceptions.</p>

          <button
            type="button"
            onClick={onAddStaff}
            disabled={staffSaving || typeof onAddStaff !== 'function'}
          >
            Add first staff member
          </button>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="lld-staff-crew-empty lld-staff-crew-empty-search">
          <strong>No matching staff</strong>
          <p>Try a different name, job number or task code.</p>
        </div>
      ) : (
        <div className="lld-staff-crew-list">
          {filteredStaff.map((worker) => {
            const status = worker.attendance_status || 'at_work';

            const statusDisplay =
              STAFF_STATUS_DISPLAY[status] ||
              STAFF_STATUS_DISPLAY.at_work;

            const selected = worker.allocationRows.some((row) => (
              String(selectedStaffId || '') ===
              String(row._groupRowId || '')
            ));

            return (
              <button
                key={worker.groupKey}
                type="button"
                className={`lld-staff-crew-row ${
                  selected ? 'is-selected' : ''
                }`}
                data-attendance-status={status}
                data-allocation-count={worker.allocationRows.length}
                onClick={() => onSelect?.(worker.firstRow)}
                aria-pressed={selected}
              >
                <span
                  className={`lld-staff-crew-status-dot ${statusDisplay.className}`}
                  title={statusDisplay.label}
                  aria-label={statusDisplay.label}
                />

                <span className="lld-staff-crew-person">
                  <strong>{worker.employee_name}</strong>

                  <small title={worker.allocationSummary}>
                    {worker.allocationSummary}
                  </small>
                </span>

                <span className="lld-staff-crew-status">
                  {worker.allocationRows.length > 1
                    ? `${worker.allocationRows.length} tasks`
                    : statusDisplay.shortLabel}
                </span>

                <span className="lld-staff-crew-hours">
                  {Number(worker.total_hours || 0).toFixed(2)}h
                </span>
              </button>
            );
          })}
        </div>
      )}

      <footer className="lld-staff-crew-index-footer">
        <span>Select a person to open their daily timesheet.</span>

        <strong>
          {filteredStaff.length}
          {staffRows.length !== groupedStaff.length
            ? ` people · ${staffRows.length} rows`
            : ''}
        </strong>
      </footer>
    </section>
  );
};

// staff-register-compact-daily-v1
const STAFF_NON_WORKING_STATUSES = new Set([
  'sick',
  'annual_leave',
  'public_holiday',
  'no_work'
]);

const CompactDailyStaffRegister = ({
  rows = [],
  selectedDateLabel = '',
  staffSaving = false,
  staffSaveStatus = '',
  onChange,
  onOpenDetails,
  onAddStaff,
  onSetAllNormalDay
}) => {
  const staffRows = Array.isArray(rows) ? rows : [];

  const summary = staffRows.reduce((result, row) => {
    const status = row.attendance_status || 'at_work';
    const hours = Number(row.total_hours || 0);

    result.total += 1;
    result.hours += Number.isFinite(hours) ? hours : 0;

    if (status === 'at_work') result.working += 1;
    if (status === 'sick') result.sick += 1;
    if (status === 'annual_leave') result.leave += 1;
    if (status === 'away_other_site') result.otherSite += 1;
    if (status === 'public_holiday') result.publicHoliday += 1;
    if (status === 'no_work') result.noWork += 1;

    return result;
  }, {
    total: 0,
    hours: 0,
    working: 0,
    sick: 0,
    leave: 0,
    otherSite: 0,
    publicHoliday: 0,
    noWork: 0
  });

  return (
    <section
      className="lld-staff-daily-register"
      data-testid="staff-register-compact-daily-v1"
      aria-label="Daily Staff Register"
    >
      <div className="lld-staff-daily-heading">
        <div>
          <p>Today</p>
          <h3>Daily Staff Register</h3>
          <small>{selectedDateLabel}</small>
        </div>

        <div className="lld-staff-daily-heading-actions">
          <button
            type="button"
            className="lld-binder-action-button"
            onClick={onAddStaff}
            disabled={
              staffSaving ||
              typeof onAddStaff !== 'function'
            }
          >
            + Add staff
          </button>

          <button
            type="button"
            className="lld-binder-action-button lld-binder-action-button-primary"
            onClick={onSetAllNormalDay}
            disabled={
              staffSaving ||
              staffRows.length === 0 ||
              typeof onSetAllNormalDay !== 'function'
            }
          >
            Mark all at work
          </button>
        </div>
      </div>

      <div className="lld-staff-daily-summary">
        <span>
          <strong>{summary.working}</strong>
          <small>Working</small>
        </span>

        <span>
          <strong>{summary.sick}</strong>
          <small>Sick</small>
        </span>

        <span>
          <strong>{summary.leave}</strong>
          <small>Leave</small>
        </span>

        <span>
          <strong>{summary.otherSite}</strong>
          <small>Other site</small>
        </span>

        <span>
          <strong>{summary.hours.toFixed(2)}h</strong>
          <small>Total hours</small>
        </span>
      </div>

      {staffRows.length === 0 ? (
        <div className="lld-staff-daily-empty">
          <strong>No staff added for this day</strong>
          <p>
            Add staff once, then use Mark all at work and edit only
            the exceptions.
          </p>

          <button
            type="button"
            onClick={onAddStaff}
            disabled={
              staffSaving ||
              typeof onAddStaff !== 'function'
            }
          >
            Add first staff member
          </button>
        </div>
      ) : (
        <div className="lld-staff-daily-table-wrap">
          <table className="lld-staff-daily-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Status</th>
                <th>Start</th>
                <th>Finish</th>
                <th>Lunch</th>
                <th>Hours</th>
                <th>Notes</th>
                <th aria-label="Staff actions" />
              </tr>
            </thead>

            <tbody>
              {staffRows.map((row, index) => {
                const status = row.attendance_status || 'at_work';

                const timeDisabled =
                  staffSaving ||
                  STAFF_NON_WORKING_STATUSES.has(status);

                return (
                  <tr
                    key={
                      row._binderStaffId ||
                      row.id ||
                      row.employee_id ||
                      `${row.employee_name || 'staff'}-${index}`
                    }
                    data-attendance-status={status}
                  >
                    <td className="lld-staff-daily-name">
                      <strong>
                        {row.employee_name || `Staff ${index + 1}`}
                      </strong>

                      <small>
                        {row.task_code || row.job_number || 'Daily staff'}
                      </small>
                    </td>

                    <td>
                      <select
                        value={status}
                        onChange={(event) => (
                          onChange?.(
                            index,
                            'attendance_status',
                            event.target.value
                          )
                        )}
                        disabled={staffSaving}
                        aria-label={`Attendance for ${
                          row.employee_name || `staff ${index + 1}`
                        }`}
                      >
                        {STAFF_ATTENDANCE_OPTIONS.map((option) => (
                          <option
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <input
                        type="time"
                        value={row.start_time || ''}
                        onChange={(event) => (
                          onChange?.(
                            index,
                            'start_time',
                            event.target.value
                          )
                        )}
                        disabled={timeDisabled}
                        aria-label={`Start time for ${
                          row.employee_name || `staff ${index + 1}`
                        }`}
                      />
                    </td>

                    <td>
                      <input
                        type="time"
                        value={row.finish_time || ''}
                        onChange={(event) => (
                          onChange?.(
                            index,
                            'finish_time',
                            event.target.value
                          )
                        )}
                        disabled={timeDisabled}
                        aria-label={`Finish time for ${
                          row.employee_name || `staff ${index + 1}`
                        }`}
                      />
                    </td>

                    <td>
                      <select
                        value={String(row.lunch_duration ?? '30')}
                        onChange={(event) => (
                          onChange?.(
                            index,
                            'lunch_duration',
                            event.target.value
                          )
                        )}
                        disabled={timeDisabled}
                        aria-label={`Lunch for ${
                          row.employee_name || `staff ${index + 1}`
                        }`}
                      >
                        <option value="0">0</option>
                        <option value="30">30 min</option>
                        <option value="60">60 min</option>
                      </select>
                    </td>

                    <td className="lld-staff-daily-hours">
                      {Number(row.total_hours || 0).toFixed(2)}h
                    </td>

                    <td>
                      <input
                        type="text"
                        value={row.description || row.other || ''}
                        placeholder="Optional note"
                        onChange={(event) => (
                          onChange?.(
                            index,
                            'description',
                            event.target.value
                          )
                        )}
                        disabled={staffSaving}
                        aria-label={`Notes for ${
                          row.employee_name || `staff ${index + 1}`
                        }`}
                      />
                    </td>

                    <td className="lld-staff-daily-actions">
                      <button
                        type="button"
                        onClick={() => onOpenDetails?.(row, index)}
                        disabled={
                          staffSaving ||
                          typeof onOpenDetails !== 'function'
                        }
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="lld-staff-daily-footer">
        <span>
          {summary.total} staff · {summary.hours.toFixed(2)} hours
        </span>

        <span>
          {staffSaving
            ? 'Saving…'
            : staffSaveStatus || 'Changes auto-save'}
        </span>
      </div>
    </section>
  );
};

// staff-register-weekly-dashboard-v1
const WEEKLY_STAFF_DAY_LABELS = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun'
];

const WEEKLY_STAFF_STATUS_CLASSES = {
  at_work: 'is-at-work',
  sick: 'is-sick',
  annual_leave: 'is-annual-leave',
  public_holiday: 'is-public-holiday',
  away_other_site: 'is-other-site',
  no_work: 'is-no-work'
};

const formatWeeklyStaffDate = (value) => {
  if (!value) return '';

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short'
  });
};

const WeeklyStaffDashboard = ({
  weeklyLabour = {},
  loading = false,
  error = ''
}) => {
  const dates = Array.isArray(weeklyLabour?.dates)
    ? weeklyLabour.dates
    : [];

  const staff = Array.isArray(weeklyLabour?.staff)
    ? weeklyLabour.staff
    : [];

  const totals = weeklyLabour?.totals || {};

  return (
    <section
      className="lld-staff-weekly-dashboard"
      data-testid="staff-register-weekly-dashboard-v1"
      aria-label="Weekly staff summary"
    >
      <div className="lld-staff-weekly-heading">
        <div>
          <p>This week</p>
          <h3>Weekly crew summary</h3>
          <small>
            {weeklyLabour?.week_start && weeklyLabour?.week_end
              ? `${formatWeeklyStaffDate(
                  weeklyLabour.week_start
                )} to ${formatWeeklyStaffDate(
                  weeklyLabour.week_end
                )}`
              : 'Monday to Sunday'}
          </small>
        </div>

        <strong>{Number(weeklyLabour?.staff_count || 0)}</strong>
      </div>

      <div className="lld-staff-weekly-totals">
        <span>
          <strong>{Number(totals.hours || 0).toFixed(2)}h</strong>
          <small>Total hours</small>
        </span>

        <span>
          <strong>{Number(totals.at_work || 0)}</strong>
          <small>Worked</small>
        </span>

        <span>
          <strong>{Number(totals.sick || 0)}</strong>
          <small>Sick</small>
        </span>

        <span>
          <strong>{Number(totals.annual_leave || 0)}</strong>
          <small>Leave</small>
        </span>

        <span>
          <strong>{Number(totals.away_other_site || 0)}</strong>
          <small>Other site</small>
        </span>

        <span>
          <strong>{Number(totals.public_holiday || 0)}</strong>
          <small>Public holiday</small>
        </span>
      </div>

      {loading ? (
        <p className="lld-staff-weekly-message">
          Loading weekly staff summary…
        </p>
      ) : error ? (
        <p
          className="lld-staff-weekly-message is-error"
          role="alert"
        >
          {error}
        </p>
      ) : staff.length === 0 ? (
        <p className="lld-staff-weekly-message">
          No saved staff records exist for this week yet.
        </p>
      ) : (
        <>
          <div className="lld-staff-weekly-table-wrap">
            <table className="lld-staff-weekly-table">
              <thead>
                <tr>
                  <th className="lld-staff-weekly-name-cell">
                    Staff
                  </th>

                  {dates.map((date, index) => (
                    <th key={date}>
                      <span>{WEEKLY_STAFF_DAY_LABELS[index]}</span>
                      <small>{formatWeeklyStaffDate(date)}</small>
                    </th>
                  ))}

                  <th className="lld-staff-weekly-total-cell">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {staff.map((person) => (
                  <tr key={person.key || person.employee_name}>
                    <td className="lld-staff-weekly-name-cell">
                      {person.employee_name}
                    </td>

                    {dates.map((date) => {
                      const day = person.days?.[date];
                      const statusClass = day
                        ? WEEKLY_STAFF_STATUS_CLASSES[day.status] || ''
                        : 'is-missing';

                      return (
                        <td
                          key={`${person.key}-${date}`}
                          title={
                            day
                              ? `${day.status_label}${
                                  Number(day.hours || 0) > 0
                                    ? ` · ${Number(day.hours).toFixed(2)}h`
                                    : ''
                                }`
                              : 'No saved entry'
                          }
                        >
                          <span
                            className={`lld-staff-weekly-status ${statusClass}`}
                          >
                            {day?.code || '—'}
                          </span>

                          {Number(day?.hours || 0) > 0 && (
                            <small className="lld-staff-weekly-hours">
                              {Number(day.hours).toFixed(1)}h
                            </small>
                          )}
                        </td>
                      );
                    })}

                    <td className="lld-staff-weekly-total-cell">
                      {Number(person.total_hours || 0).toFixed(2)}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <small className="lld-staff-weekly-legend">
            W = worked · S = sick · AL = annual leave ·
            PH = public holiday · OS = other site · NW = no work ·
            — = no saved entry
          </small>
        </>
      )}
    </section>
  );
};

const BinderStaffAdd = ({
  employeeOptions = [],
  staffSaving = false,
  onAddEmployee,
  onAddSiteStaff,
  onClose,
}) => {
  const [employeeValue, setEmployeeValue] = useState('');
  const [siteOnlyName, setSiteOnlyName] = useState('');

  const options = Array.isArray(employeeOptions)
    ? employeeOptions
    : [];

  return (
    <div
      className="lld-binder-action-detail lld-binder-staff-detail"
      data-testid="lld-binder-staff-add-v2s2b"
    >
      <div className="lld-binder-page-heading lld-binder-action-detail-heading">
        <div>
          <p>Daily labour</p>
          <h3>Add staff member</h3>
          <small>
            Add Timesheet staff or record a site-only person without leaving the binder.
          </small>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="lld-binder-detail-back-link"
          disabled={staffSaving}
        >
          ← Staff
        </button>
      </div>

      <div className="lld-binder-action-form">
        <label className="lld-binder-action-field lld-binder-action-field-wide">
          <span>Timesheet staff</span>
          <select
            value={employeeValue}
            onChange={(event) => setEmployeeValue(event.target.value)}
            disabled={staffSaving}
            data-testid="lld-binder-staff-add-employee-v2s2b"
          >
            <option value="">Select staff member</option>

            {options.map((option, index) => (
              <option
                key={`${option.value || option.label || 'staff'}-${index}`}
                value={option.value || ''}
              >
                {option.label || option.value}
              </option>
            ))}
          </select>
        </label>

        <label className="lld-binder-action-field lld-binder-action-field-wide">
          <span>Site-only staff name</span>
          <input
            type="text"
            value={siteOnlyName}
            placeholder="Name for this diary only"
            onChange={(event) => setSiteOnlyName(event.target.value)}
            disabled={staffSaving}
            data-testid="lld-binder-staff-add-site-only-v2s2b"
          />
        </label>

        <div className="lld-binder-action-controls">
          <button
            type="button"
            className="lld-binder-action-button lld-binder-action-button-primary"
            onClick={() => onAddEmployee?.(employeeValue)}
            disabled={staffSaving || !employeeValue}
          >
            Add Timesheet staff
          </button>

          <button
            type="button"
            className="lld-binder-action-button"
            onClick={() => onAddSiteStaff?.(siteOnlyName.trim())}
            disabled={staffSaving || !siteOnlyName.trim()}
          >
            Add site-only staff
          </button>

          <button
            type="button"
            className="lld-binder-action-button lld-binder-action-button-quiet"
            onClick={onClose}
            disabled={staffSaving}
          >
            Back to Staff
          </button>
        </div>
      </div>
    </div>
  );
};

// binder-native-staff-entry-v2s2b
const BinderStaffDetail = ({
  row = {},
  rowIndex = -1,
  allocationRows = [],
  currentProject = null,
  staffSaving = false,
  staffImporting = false,
  staffSaveStatus = '',
  getEmployeeOptions,
  getJobOptions,
  getTaskOptions,
  onEmployeeChange,
  onChange,
  onSave,
  onRemove,
  onAddAllocation,
  onSelectAllocation,
  onImport,
  onClose,
}) => {
  const display = getStaffRowDisplay(row);

  // staff-register-allocation-switcher-v1
  const workerAllocations = (
    Array.isArray(allocationRows)
      ? allocationRows
      : []
  ).map((allocation, index) => {
    const allocationIndex =
      Number.isInteger(allocation?._binderStaffIndex)
        ? allocation._binderStaffIndex
        : index;

    const allocationId =
      allocation?._binderStaffId ||
      `binder-staff-${allocationIndex}`;

    const job =
      String(allocation?.job_number || '').trim() ||
      'No job';

    const task =
      String(allocation?.task_code || '').trim() ||
      'No task';

    const hours =
      Number(allocation?.total_hours || 0);

    return {
      ...allocation,
      allocationIndex,
      allocationId,
      job,
      task,
      hours
    };
  });

  const workerTotalHours = workerAllocations.reduce(
    (total, allocation) => total + allocation.hours,
    0
  );

  const employeeOptions =
    typeof getEmployeeOptions === 'function'
      ? getEmployeeOptions(row.employee_id || row.employee_name || '')
      : [];

  const jobOptions =
    typeof getJobOptions === 'function'
      ? getJobOptions(row.job_number || currentProject?.job_number || '')
      : [];

  const taskOptions =
    typeof getTaskOptions === 'function'
      ? getTaskOptions(row.task_code || '')
      : [];

  return (
    <div
      className="lld-binder-action-detail lld-binder-staff-detail"
      data-testid="lld-binder-staff-detail-v2s2b"
    >
      <div className="lld-binder-page-heading lld-binder-action-detail-heading">
        <div>
          <p>Daily labour</p>
          <h3>Staff entry</h3>
          <small>
            Attendance, hours, job allocation and diary notes stay inside the binder.
          </small>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="lld-binder-detail-back-link"
          disabled={staffSaving}
        >
          ← Staff
        </button>
      </div>

      <div className="lld-binder-staff-person">
        <span aria-hidden="true">{display.initials}</span>

        <div>
          <strong>{display.employeeName}</strong>
          <small>
            {display.handoffStatus}
            {staffSaveStatus ? ` · ${staffSaveStatus}` : ''}
          </small>
        </div>

        <b>{workerTotalHours.toFixed(2)}h</b>
      </div>

      <section
        className="lld-staff-allocation-switcher"
        data-testid="staff-register-allocation-switcher-v1"
        aria-label="Worker job and task allocations"
      >
        <div className="lld-staff-allocation-switcher-heading">
          <div>
            <span>Daily allocations</span>
            <strong>
              {workerAllocations.length}
              {' '}
              {workerAllocations.length === 1
                ? 'job / task'
                : 'jobs / tasks'}
            </strong>
          </div>

          <b>{workerTotalHours.toFixed(2)}h total</b>
        </div>

        <div className="lld-staff-allocation-switcher-list">
          {workerAllocations.map((allocation, index) => {
            const isSelected =
              allocation.allocationIndex === rowIndex;

            return (
              <button
                key={allocation.allocationId}
                type="button"
                className={`lld-staff-allocation-switcher-row ${
                  isSelected ? 'is-selected' : ''
                }`}
                onClick={() => (
                  onSelectAllocation?.(allocation)
                )}
                disabled={staffSaving}
                aria-pressed={isSelected}
              >
                <span>{index + 1}</span>

                <strong>
                  {allocation.job}
                  {' · '}
                  {allocation.task}
                </strong>

                <small>
                  {allocation.start_time || '--:--'}
                  {'–'}
                  {allocation.finish_time || '--:--'}
                </small>

                <b>{allocation.hours.toFixed(2)}h</b>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="lld-staff-allocation-add"
          onClick={() => onAddAllocation?.(rowIndex)}
          disabled={
            staffSaving ||
            typeof onAddAllocation !== 'function' ||
            !String(row.employee_name || '').trim()
          }
        >
          + Add another job / task
        </button>
      </section>

      <form
        className="lld-binder-action-form lld-binder-staff-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave?.();
        }}
      >
        <label className="lld-binder-action-field lld-binder-action-field-wide">
          <span>Timesheet staff</span>
          <select
            value={row.employee_id || row.employee_name || ''}
            onChange={(event) => (
              onEmployeeChange?.(rowIndex, event.target.value)
            )}
            disabled={staffSaving}
            data-testid="lld-binder-staff-employee-v2s2b"
          >
            <option value="">Select staff member</option>

            {(Array.isArray(employeeOptions) ? employeeOptions : []).map(
              (option, index) => (
                <option
                  key={`${option.value || option.label || 'staff'}-${index}`}
                  value={option.value || ''}
                >
                  {option.label || option.value}
                </option>
              )
            )}
          </select>
        </label>

        <label className="lld-binder-action-field lld-binder-action-field-wide">
          <span>Staff name / site-only person</span>
          <input
            type="text"
            value={row.employee_name || ''}
            placeholder="Staff member name"
            onChange={(event) => {
              onChange?.(rowIndex, 'employee_id', '');
              onChange?.(rowIndex, 'employee_name', event.target.value);
            }}
            disabled={staffSaving}
          />
        </label>

        <label className="lld-binder-action-field lld-binder-action-field-wide">
          <span>Attendance</span>
          <select
            value={row.attendance_status || 'at_work'}
            onChange={(event) => (
              onChange?.(
                rowIndex,
                'attendance_status',
                event.target.value
              )
            )}
            disabled={staffSaving}
            data-testid="lld-staff-attendance-status-v1"
          >
            {STAFF_ATTENDANCE_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="lld-binder-action-field">
          <span>Start</span>
          <input
            type="time"
            step="60"
            value={row.start_time || ''}
            onChange={(event) => (
              onChange?.(rowIndex, 'start_time', event.target.value)
            )}
            disabled={
              staffSaving ||
              ['sick', 'annual_leave', 'public_holiday', 'no_work'].includes(
                row.attendance_status
              )
            }
          />
        </label>

        <label className="lld-binder-action-field">
          <span>Finish</span>
          <input
            type="time"
            step="60"
            value={row.finish_time || ''}
            onChange={(event) => (
              onChange?.(rowIndex, 'finish_time', event.target.value)
            )}
            disabled={
              staffSaving ||
              ['sick', 'annual_leave', 'public_holiday', 'no_work'].includes(
                row.attendance_status
              )
            }
          />
        </label>

        <label className="lld-binder-action-field">
          <span>Lunch</span>
          <select
            value={String(row.lunch_duration ?? '30')}
            onChange={(event) => (
              onChange?.(rowIndex, 'lunch_duration', event.target.value)
            )}
            disabled={staffSaving}
          >
            <option value="0">No lunch</option>
            <option value="30">30 minutes</option>
            <option value="60">60 minutes</option>
          </select>
        </label>

        <label className="lld-binder-action-field">
          <span>Total hours</span>
          <input
            type="text"
            value={`${(Number.parseFloat(row.total_hours) || 0).toFixed(2)} h`}
            readOnly
            aria-readonly="true"
          />
        </label>

        <label className="lld-binder-action-field">
          <span>Job #</span>
          <input
            type="text"
            list={`lld-staff-job-options-${rowIndex}`}
            value={row.job_number || ''}
            placeholder={currentProject?.job_number || 'Enter job number'}
            onChange={(event) => (
              onChange?.(rowIndex, 'job_number', event.target.value)
            )}
            disabled={staffSaving}
            autoComplete="off"
            data-testid="staff-manual-job-number-entry-v1"
          />

          <datalist id={`lld-staff-job-options-${rowIndex}`}>
            {(Array.isArray(jobOptions) ? jobOptions : []).map(
              (option, index) => (
                <option
                  key={`${option.value || option.label || 'job'}-${index}`}
                  value={option.value || ''}
                >
                  {option.label || option.value || ''}
                </option>
              )
            )}
          </datalist>
        </label>

        <label className="lld-binder-action-field">
          <span>Task code</span>
          <select
            value={row.task_code || ''}
            onChange={(event) => (
              onChange?.(rowIndex, 'task_code', event.target.value)
            )}
            disabled={staffSaving}
          >
            <option value="">Task code</option>

            {(Array.isArray(taskOptions) ? taskOptions : []).map(
              (option, index) => (
                <option
                  key={`${option.value || option.label || 'task'}-${index}`}
                  value={option.value || ''}
                >
                  {option.label || option.value}
                </option>
              )
            )}
          </select>
        </label>

        <label className="lld-binder-action-field lld-binder-action-field-wide">
          <span>Staff notes</span>
          <textarea
            value={row.description || row.other || ''}
            placeholder="Location, early finish, induction or other diary details..."
            onChange={(event) => (
              onChange?.(rowIndex, 'description', event.target.value)
            )}
            disabled={staffSaving}
            rows="3"
          />
        </label>

        <div
          className="lld-binder-action-controls"
          data-testid="staff-register-multiple-task-button-v1"
        >

          <button
            type="submit"
            className="lld-binder-action-button lld-binder-action-button-primary"
            disabled={staffSaving || typeof onSave !== 'function'}
          >
            {staffSaving ? 'Saving…' : 'Save staff'}
          </button>

          <button
            type="button"
            className="lld-binder-action-button"
            onClick={onImport}
            disabled={
              staffSaving ||
              staffImporting ||
              typeof onImport !== 'function'
            }
          >
            {staffImporting
              ? 'Importing…'
              : 'Import saved rows to Timesheet'}
          </button>

          <button
            type="button"
            className="lld-binder-action-button lld-binder-material-remove"
            onClick={() => {
              onRemove?.(rowIndex);
              onClose?.();
            }}
            disabled={staffSaving || typeof onRemove !== 'function'}
          >
            Remove
          </button>

          <button
            type="button"
            className="lld-binder-action-button lld-binder-action-button-quiet"
            onClick={onClose}
            disabled={staffSaving}
          >
            Back to Staff
          </button>
        </div>
      </form>
    </div>
  );
};
const PhotoEvidenceRow = ({
  item = {},
  index = 0,
  onOpen,
}) => {
  const entry = item.entry || {};
  const display = getWalkaroundEntryDisplay(entry);

  const metadata = [
    display.category,
    display.owner,
    display.capturedAt,
  ].filter(Boolean);

  return (
    <button
      type="button"
      className="lld-binder-focused-record lld-binder-photo-row"
      onClick={() => onOpen?.(item)}
      data-testid={`lld-binder-photo-row-v8-9g1-${index}`}
    >
      <img
        src={item.photo}
        alt=""
        className="lld-binder-photo-thumbnail"
      />

      <div className="lld-binder-photo-row-copy">
        <strong>{display.observation}</strong>

        {metadata.length > 0 && (
          <small>{metadata.join(' · ')}</small>
        )}
      </div>

      <span className="lld-binder-photo-number">
        {String(index + 1).padStart(2, '0')}
      </span>
    </button>
  );
};

const BinderPhotoDetail = ({
  evidence = {},
  onOpenWorkflow,
  onClose,
}) => {
  const entry = evidence.entry || {};
  const display = getWalkaroundEntryDisplay(entry);

  return (
    <div
      className="lld-binder-action-detail lld-binder-photo-detail"
      data-testid="lld-binder-photo-detail-v8-9g1"
    >
      <div className="lld-binder-page-heading lld-binder-action-detail-heading">
        <div>
          <p>Site evidence</p>
          <h3>Photo detail</h3>
          <span>
            Review the captured image and its source record inside the binder.
          </span>
        </div>

        <button
          type="button"
          className="lld-binder-action-back"
          onClick={onClose}
        >
          ← Photos
        </button>
      </div>

      <div className="lld-binder-photo-detail-layout">
        <div className="lld-binder-photo-detail-image-wrap">
          <img
            src={evidence.photo}
            alt={display.observation}
            className="lld-binder-photo-detail-image"
          />

          <span>
            Photo {(evidence.photoIndex || 0) + 1} of {evidence.photoCount || 1}
          </span>
        </div>

        <div className="lld-binder-photo-detail-fields">
          <div className="lld-binder-photo-field">
            <span>Observation</span>
            <strong>{display.observation}</strong>
          </div>

          <div className="lld-binder-photo-field">
            <span>Category</span>
            <strong>{display.category}</strong>
          </div>

          <div className="lld-binder-photo-field">
            <span>Priority</span>
            <strong>{display.priority.toUpperCase()}</strong>
          </div>

          <div className="lld-binder-photo-field">
            <span>Owner</span>
            <strong>{display.owner}</strong>
          </div>

          <div className="lld-binder-photo-field">
            <span>Captured</span>
            <strong>{display.capturedAt || 'Not recorded'}</strong>
          </div>

          <div className="lld-binder-photo-field">
            <span>Follow-up</span>
            <strong>
              {entry.action_item_id
                ? 'Action Item created'
                : display.action || 'Diary evidence only'}
            </strong>
          </div>
        </div>
      </div>

      <div className="lld-binder-photo-actions">
        <button
          type="button"
          className="lld-binder-action-primary"
          onClick={onOpenWorkflow}
        >
          Open source Walkaround workflow
        </button>

        <button
          type="button"
          className="lld-binder-action-secondary"
          onClick={onClose}
        >
          Back to Photos
        </button>
      </div>
    </div>
  );
};
// binder-native-communication-editor-v2s2e
const BinderCommunicationAdd = ({
  saving = false,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState({
    type: 'Email',
    contact: '',
    subject: '',
    notes: '',
    follow_up_required: false,
    owner: '',
    due_date: '',
  });

  const updateDraft = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!draft.subject.trim()) return;

    const saved = await onSave?.(draft);

    if (saved !== false) {
      onClose?.();
    }
  };

  return (
    <div
      className="lld-binder-action-detail lld-binder-communication-add"
      data-testid="lld-binder-communication-add-v2s2e"
      aria-busy={saving}
    >
      <div className="lld-binder-page-heading lld-binder-action-detail-heading">
        <div>
          <p>Communication record</p>
          <h3>Add communication</h3>
          <span>
            Record the email, call or conversation without leaving the Diary.
          </span>
        </div>

        <button
          type="button"
          className="lld-binder-action-back"
          onClick={onClose}
          disabled={saving}
        >
          ← Emails / Calls
        </button>
      </div>

      <form
        className="lld-binder-action-form"
        onSubmit={submit}
      >
        <label className="lld-binder-action-field">
          <span>Type</span>
          <select
            value={draft.type}
            onChange={(event) => updateDraft('type', event.target.value)}
            disabled={saving}
          >
            <option value="Email">Email</option>
            <option value="Call">Call</option>
            <option value="Meeting">Meeting</option>
            <option value="Other">Other</option>
          </select>
        </label>

        <label className="lld-binder-action-field">
          <span>Who with</span>
          <input
            type="text"
            value={draft.contact}
            placeholder="Person, company or team"
            onChange={(event) => updateDraft('contact', event.target.value)}
            disabled={saving}
          />
        </label>

        <label className="lld-binder-action-field lld-binder-action-field-wide">
          <span>Subject</span>
          <input
            type="text"
            value={draft.subject}
            placeholder="What was it about?"
            onChange={(event) => updateDraft('subject', event.target.value)}
            disabled={saving}
            required
          />
        </label>

        <label className="lld-binder-action-field lld-binder-action-field-wide">
          <span>Notes / outcome</span>
          <textarea
            value={draft.notes}
            placeholder="What was discussed, agreed, sent or decided?"
            onChange={(event) => updateDraft('notes', event.target.value)}
            disabled={saving}
            rows="4"
          />
        </label>

        <label className="lld-binder-action-field">
          <span>Follow-up required?</span>
          <select
            value={draft.follow_up_required ? 'yes' : 'no'}
            onChange={(event) => updateDraft(
              'follow_up_required',
              event.target.value === 'yes'
            )}
            disabled={saving}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>

        {draft.follow_up_required && (
          <>
            <label className="lld-binder-action-field">
              <span>Owner</span>
              <input
                type="text"
                value={draft.owner}
                placeholder="Who needs to follow up?"
                onChange={(event) => updateDraft('owner', event.target.value)}
                disabled={saving}
                required
              />
            </label>

            <label className="lld-binder-action-field">
              <span>Due date</span>
              <input
                type="date"
                value={draft.due_date}
                onChange={(event) => updateDraft('due_date', event.target.value)}
                disabled={saving}
                required
              />
            </label>
          </>
        )}

        <div className="lld-binder-action-controls">
          <button
            type="submit"
            className="lld-binder-action-button lld-binder-action-button-primary"
            disabled={saving || !draft.subject.trim()}
          >
            {saving ? 'Saving…' : 'Save communication'}
          </button>

          <button
            type="button"
            className="lld-binder-action-button lld-binder-action-button-quiet"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

const BinderTasksActionDetail = ({
  selectedTask,
  selectedTaskDraft,
  taskDetailSaving = false,
  taskCompletionPending = false,
  onTaskDraftChange,
  onSaveTask,
  onCompleteSelectedTask,
  onReopenSelectedTask,
  onCloseTask,
  detailContext = 'tasks',
}) => {
  const selectedTaskIsComplete = [
    'complete',
    'completed',
    'closed',
    'done',
  ].includes(
    String(
      selectedTaskDraft?.status ||
      selectedTask?.status ||
      ''
    ).toLowerCase()
  );

  return (
    <div
      className="lld-binder-action-detail"
      data-testid="lld-binder-tasks-action-detail-v8-9b2"
      data-communications-detail={
        detailContext === 'emails'
          ? 'lld-binder-communications-detail-v8-9d1'
          : undefined
      }
      aria-busy={taskDetailSaving}
    >
      <div className="lld-binder-page-heading lld-binder-action-detail-heading">
        <div>
          <p>
            {detailContext === 'emails'
              ? 'Communication follow-up'
              : 'Action record'}
          </p>

          <h3>
            {detailContext === 'emails'
              ? 'Communication detail'
              : 'Action detail'}
          </h3>

          <span>
            {detailContext === 'emails'
              ? 'Edit this follow-up without leaving Emails / Calls.'
              : 'Edit this action without leaving the Tasks ledger.'}
          </span>
        </div>

        <button
          type="button"
          className="lld-binder-action-back"
          onClick={onCloseTask}
          disabled={taskDetailSaving}
        >
          {detailContext === 'emails'
            ? '← Emails / Calls'
            : '← Tasks'}
        </button>
      </div>

      <form
        className="lld-binder-action-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSaveTask?.();
        }}
      >
        <label className="lld-binder-action-field lld-binder-action-field-wide">
          <span>Title</span>
          <input
            type="text"
            value={selectedTaskDraft.title || ''}
            onChange={(event) => (
              onTaskDraftChange?.('title', event.target.value)
            )}
            disabled={taskDetailSaving}
          />
        </label>

        <label className="lld-binder-action-field">
          <span>Owner</span>
          <input
            type="text"
            value={selectedTaskDraft.owner || ''}
            placeholder="Responsible person"
            onChange={(event) => (
              onTaskDraftChange?.('owner', event.target.value)
            )}
            disabled={taskDetailSaving}
          />
        </label>

        <label className="lld-binder-action-field">
          <span>Priority</span>
          <select
            value={selectedTaskDraft.priority || 'medium'}
            onChange={(event) => (
              onTaskDraftChange?.('priority', event.target.value)
            )}
            disabled={taskDetailSaving}
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="deferred">Deferred</option>
          </select>
        </label>

        <label className="lld-binder-action-field">
          <span>Status</span>
          <select
            value={selectedTaskDraft.status || 'open'}
            onChange={(event) => (
              onTaskDraftChange?.('status', event.target.value)
            )}
            disabled={taskDetailSaving || selectedTaskIsComplete}
          >
            <option value="open">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>

            {selectedTaskIsComplete && (
              <option value="completed">Complete</option>
            )}
          </select>
        </label>

        <label className="lld-binder-action-field">
          <span>Due</span>
          <input
            type="date"
            value={selectedTaskDraft.due_date || ''}
            onChange={(event) => (
              onTaskDraftChange?.('due_date', event.target.value)
            )}
            disabled={taskDetailSaving}
          />
        </label>

        <label className="lld-binder-action-field">
          <span>Expected complete</span>
          <input
            type="date"
            value={selectedTaskDraft.expected_complete_date || ''}
            onChange={(event) => (
              onTaskDraftChange?.(
                'expected_complete_date',
                event.target.value
              )
            )}
            disabled={taskDetailSaving}
          />
        </label>

        <label className="lld-binder-action-field lld-binder-action-field-wide">
          <span>Details</span>
          <textarea
            value={selectedTaskDraft.description || ''}
            placeholder="Notes, instruction, required response, or site detail..."
            onChange={(event) => (
              onTaskDraftChange?.('description', event.target.value)
            )}
            disabled={taskDetailSaving}
            rows="3"
          />
        </label>

        <div className="lld-binder-action-controls">
          <button
            type="submit"
            className="lld-binder-action-button lld-binder-action-button-primary"
            disabled={
              taskDetailSaving ||
              typeof onSaveTask !== 'function'
            }
          >
            {taskDetailSaving ? 'Saving…' : 'Save follow-up'}
          </button>

          {selectedTaskIsComplete ? (
            <button
              type="button"
              className="lld-binder-action-button"
              onClick={onReopenSelectedTask}
              disabled={
                taskDetailSaving ||
                typeof onReopenSelectedTask !== 'function'
              }
            >
              Reopen
            </button>
          ) : (
            <button
              type="button"
              className="lld-binder-action-button"
              onClick={onCompleteSelectedTask}
              disabled={
                taskDetailSaving ||
                taskCompletionPending ||
                typeof onCompleteSelectedTask !== 'function'
              }
            >
              Mark complete
            </button>
          )}

          <button
            type="button"
            className="lld-binder-action-button lld-binder-action-button-quiet"
            onClick={onCloseTask}
            disabled={taskDetailSaving}
          >
            {detailContext === 'emails'
              ? 'Back to Emails / Calls'
              : 'Back to Tasks'}
          </button>
        </div>
      </form>
    </div>
  );
};
const DigitalJobBinder = ({
  currentProject,
  selectedDateLabel,
  selectedDate,
  today,
  draftStatus,
  diaryEntries = [],
  urgentItems = [],
  taskItems = [],
  materials = [],
  labourCount = 0,
  labourRows = [],
  staffSaving = false,
  staffImporting = false,
  staffSaveStatus = '',
  weeklyLabour = {},
  weeklyLabourLoading = false,
  weeklyLabourError = '',
  getStaffEmployeeOptions,
  getStaffJobOptions,
  getStaffTaskOptions,
  onAddStaffEmployee,
  onAddSiteStaff,
  onStaffEmployeeChange,
  onStaffChange,
  onSetAllStaffNormalDay,
  onSaveStaff,
  onRemoveStaff,
  onAddStaffAllocation,
  onImportStaff,
  quickNote = '',
  diaryDraft = {},
  diaryCategoryOptions = [],
  diaryPriorityOptions = [],
  diarySendToOptions = [],
  submitting = false,
  onQuickNoteChange,
  onDiaryDraftChange,
  onDiaryPhotoUpload,
  onQuickSubmit,
  onChangeDate,
  onSelectDate,
  onOpenTasks,
  onOpenTask,
  onCompleteTask,
  taskCompletionPending = false,
  selectedTask = null,
  selectedTaskDraft = null,
  taskDetailSaving = false,
  onTaskDraftChange,
  onSaveTask,
  onCompleteSelectedTask,
  onReopenSelectedTask,
  onCloseTask,
  onOpenMaterials,
  selectedMaterial = null,
  materialSaving = false,
  onOpenMaterial,
  onAddMaterial,
  onMaterialChange,
  onSaveMaterial,
  onRemoveMaterial,
  onCloseMaterial,
  communicationItems = [],
  communicationSaving = false,
  onAddCommunication,
  onOpenEmails,
  roadblocks = [],
  selectedRoadblock = null,
  roadblockSaving = false,
  onOpenRoadblock,
  onCloseRoadblock,
  onSaveRoadblock,
  onCompleteRoadblock,
  onReopenRoadblock,
  onOpenRoadblocks,
  walkaroundSaving = false,
  onSaveWalkaround,
  onOpenWalkaround,
  onOpenPhotos,
  dayReview = null,
  reviewSaving = false,
  onMarkDayReviewed,
  onReopenDayReview,
  onCloseDay,
  onPrintDiary,
  projects = [],
  selectedProject = '',
  onSelectProject,
}) => {
  const [activeTab, setActiveTab] = useState(getRequestedBinderTab);
  const [mobileTodayPage, setMobileTodayPage] = useState('my-day');
  const [diaryEditorOpen, setDiaryEditorOpen] = useState(false);
  const [staffAddOpen, setStaffAddOpen] = useState(false); // binder-native-staff-entry-v2s2b
  const [communicationAddOpen, setCommunicationAddOpen] = useState(false);
  const [roadblockAddOpen, setRoadblockAddOpen] = useState(false); // binder-native-roadblocks-v2s2f
  const [walkaroundAddOpen, setWalkaroundAddOpen] = useState(false); // binder-native-walkaround-add-v2s2g1
  const mobileTabsRef = useRef(null);
  const diaryEditorReturnFocusRef = useRef(null);
  const diarySaveWasPendingRef = useRef(false);

  const restoreDiaryEditorFocus = () => {
    window.requestAnimationFrame(() => {
      diaryEditorReturnFocusRef.current?.focus?.({ preventScroll: true });
    });
  };

  const closeDiaryEditor = () => {
    if (submitting) return;

    setDiaryEditorOpen(false);
    restoreDiaryEditorFocus();
  };

  const openDiaryEditor = (triggerElement = null) => {
    if (selectedDate !== today) return;

    diaryEditorReturnFocusRef.current = triggerElement || document.activeElement;
    setDiaryEditorOpen(true);
  };

  useEffect(() => {
    const saveWasPending = diarySaveWasPendingRef.current;

    diarySaveWasPendingRef.current = submitting;

    if (
      diaryEditorOpen &&
      saveWasPending &&
      !submitting &&
      !safeText(diaryDraft?.note)
    ) {
      setDiaryEditorOpen(false);
      restoreDiaryEditorFocus();
    }
  }, [diaryDraft?.note, diaryEditorOpen, submitting]);

  useEffect(() => {
    setDiaryEditorOpen(false);
    setCommunicationAddOpen(false);
    setRoadblockAddOpen(false);
    setWalkaroundAddOpen(false);
  }, [selectedDate, selectedProject]);

  useEffect(() => {
    const syncActiveTabFromUrl = () => {
      const requestedTab = getRequestedBinderTab();

      setActiveTab((currentTab) => (
        currentTab === requestedTab ? currentTab : requestedTab
      ));
    };

    syncActiveTabFromUrl();

    window.addEventListener('popstate', syncActiveTabFromUrl);
    window.addEventListener('lld-binder-url-change', syncActiveTabFromUrl);

    return () => {
      window.removeEventListener('popstate', syncActiveTabFromUrl);
      window.removeEventListener('lld-binder-url-change', syncActiveTabFromUrl);
    };
  }, []); // binder-url-tab-sync-v8-9j4-2
  useEffect(() => {
    let frame = null;

    const centreActiveMobileTab = () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }

      frame = window.requestAnimationFrame(() => {
        frame = null;

        const mobileTabs = mobileTabsRef.current;

        if (!mobileTabs || window.innerWidth > 1280) return;

        const activeButton = mobileTabs.querySelector(
          `[data-binder-tab="${activeTab}"]`
        );

        if (!activeButton) return;

        const containerRect = mobileTabs.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();

        const maxScrollLeft = Math.max(
          0,
          mobileTabs.scrollWidth - mobileTabs.clientWidth
        );

        const targetLeft = Math.min(
          maxScrollLeft,
          Math.max(
            0,
            mobileTabs.scrollLeft
              + (buttonRect.left - containerRect.left)
              - ((containerRect.width - buttonRect.width) / 2)
          )
        );

        const prefersReducedMotion = window.matchMedia(
          '(prefers-reduced-motion: reduce)'
        ).matches;

        mobileTabs.scrollTo({
          left: targetLeft,
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
        });
      });
    };

    centreActiveMobileTab();

    window.addEventListener('resize', centreActiveMobileTab);
    window.visualViewport?.addEventListener(
      'resize',
      centreActiveMobileTab
    );

    return () => {
      window.removeEventListener('resize', centreActiveMobileTab);
      window.visualViewport?.removeEventListener(
        'resize',
        centreActiveMobileTab
      );

      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [activeTab]); // active-mobile-tab-visibility-resize-v8-9j5-1

  const projectName = currentProject
    ? `${currentProject.job_number ? `${currentProject.job_number} — ` : ''}${currentProject.name}`
    : 'No project selected';

  const entries = useMemo(
    () => (Array.isArray(diaryEntries) ? diaryEntries.slice(0, 6) : []),
    [diaryEntries]
  );

  const walkaroundItems = useMemo(
    () => (Array.isArray(diaryEntries) ? [...diaryEntries] : [])
      .sort((a, b) => (
        safeText(b?.created_at).localeCompare(
          safeText(a?.created_at)
        )
      )),
    [diaryEntries]
  );

  const [selectedWalkaroundId, setSelectedWalkaroundId] = useState(null);

  const selectedWalkaround = walkaroundItems.find((item) => (
    String(item?.id || '') === String(selectedWalkaroundId || '')
  )) || null;

  const urgent = useMemo(
    () => (Array.isArray(urgentItems) ? urgentItems.slice(0, 3) : []),
    [urgentItems]
  );

  const tasks = useMemo(
    () => uniqueItemsByKey(Array.isArray(taskItems) ? taskItems : []),
    [taskItems]
  );

  const taskDateSummary = useMemo(() => {
    const summary = {
      overdue: 0,
      dueToday: 0,
      noDate: 0,
    };

    tasks.forEach((item) => {
      const dueDate = safeText(
        item?.due_date || item?.expected_complete_date,
        ''
      ).slice(0, 10);

      if (!dueDate) {
        summary.noDate += 1;
      } else if (dueDate < selectedDate) {
        summary.overdue += 1;
      } else if (dueDate === selectedDate) {
        summary.dueToday += 1;
      }
    });

    return summary;
  }, [tasks, selectedDate]); // task-date-summary-v2r-1

  const allUrgentItems = useMemo(
    () => uniqueItemsByKey(Array.isArray(urgentItems) ? urgentItems : []),
    [urgentItems]
  );

  const allTaskItems = useMemo(
    () => uniqueItemsByKey(Array.isArray(taskItems) ? taskItems : []),
    [taskItems]
  );

  const urgentItemKeys = useMemo(
    () => new Set(allUrgentItems.map((item) => getItemKey(item))),
    [allUrgentItems]
  );

  const outstandingItems = useMemo(
    () => uniqueItemsByKey([...allUrgentItems, ...allTaskItems]),
    [allUrgentItems, allTaskItems]
  );

  const materialRows = useMemo(
    () => (Array.isArray(materials) ? materials : [])
      .filter((row) => safeText(row?.item)),
    [materials]
  );

  const materialAttentionCount = useMemo(
    () => materialRows.filter((row) => (
      ['short', 'damaged'].includes(getMaterialStatus(row))
    )).length,
    [materialRows]
  );

  const materialOnSiteCount = useMemo(
    () => materialRows.filter((row) => (
      ['delivered', 'used'].includes(getMaterialStatus(row))
    )).length,
    [materialRows]
  );

  const materialNotedCount = useMemo(
    () => materialRows.filter((row) => (
      getMaterialStatus(row) === 'noted'
    )).length,
    [materialRows]
  );

  const selectedTaskIsComplete = [
    'complete',
    'completed',
    'closed',
    'done',
  ].includes(
    String(
      selectedTaskDraft?.status ||
      selectedTask?.status ||
      ''
    ).toLowerCase()
  );

  const actions = {
    today: null,
    diary: openDiaryEditor,
    tasks: onOpenTasks,
    materials: onAddMaterial || onOpenMaterials,
    emails: onOpenEmails,
    roadblocks: onOpenRoadblocks,
    walkaround: onOpenWalkaround,
    photos: onOpenPhotos,
    staff: null,
    closeout: onCloseDay,
  };

  const handleTab = (tabId) => {
    if (!BINDER_TABS.some((tab) => tab.id === tabId)) return;

    // diary-editor-tab-release-v2s2a
    if (diaryEditorOpen) {
      if (submitting) return;
      setDiaryEditorOpen(false);
    }

    if (tabId !== activeTab) {
      onCloseTask?.();
    }

    if (tabId !== 'materials') {
      onCloseMaterial?.();
    }

    if (tabId !== 'roadblocks') {
      onCloseRoadblock?.();
    }

    if (tabId !== 'walkaround') {
      setSelectedWalkaroundId(null);
      setWalkaroundAddOpen(false);
    }

    if (tabId !== 'photos') {
      setSelectedPhotoId(null);
    }

    if (tabId !== 'staff') {
      setSelectedStaffId(null);
      setStaffAddOpen(false);
    }

    if (tabId !== 'emails') {
      setCommunicationAddOpen(false);
    }

    if (tabId !== 'roadblocks') {
      setRoadblockAddOpen(false);
    }

    setActiveTab(tabId);

    const params = new URLSearchParams(window.location.search);

    if (tabId === 'today') {
      params.delete('tab');
    } else {
      params.set('tab', tabId);
    }

    window.history.pushState(
      {},
      '',
      `/diary${params.toString() ? `?${params.toString()}` : ''}`
    );

    window.dispatchEvent(new Event('lld-binder-url-change'));
  };

  const openActiveWorkflow = () => {
    if (activeTab === 'staff') {
      setSelectedStaffId(null);
      setStaffAddOpen(true);
      return;
    }

    if (activeTab === 'emails') {
      onCloseTask?.();
      setCommunicationAddOpen(true);
      return;
    }

    if (activeTab === 'roadblocks') {
      onCloseRoadblock?.();
      setRoadblockAddOpen(true);
      return;
    }

    if (activeTab === 'walkaround') {
      setSelectedWalkaroundId(null);
      setWalkaroundAddOpen(true);
      return;
    }

    const action = actions[activeTab];

    if (typeof action === 'function') {
      action();
    }
  };

  const activeTabConfig =
    BINDER_TABS.find((tab) => tab.id === activeTab) || BINDER_TABS[0];

  const photoEvidenceItems = useMemo(
    () => (Array.isArray(diaryEntries) ? diaryEntries : [])
      .flatMap((entry, entryIndex) => {
        const photos = Array.isArray(entry?.photos)
          ? entry.photos.filter(Boolean)
          : [];

        return photos.map((photo, photoIndex) => ({
          id: `${entry?.id || entry?.created_at || entryIndex}-${photoIndex}`,
          photo,
          photoIndex,
          photoCount: photos.length,
          entry,
        }));
      })
      .sort((a, b) => (
        safeText(b?.entry?.created_at).localeCompare(
          safeText(a?.entry?.created_at)
        )
      )),
    [diaryEntries]
  );

  const [selectedPhotoId, setSelectedPhotoId] = useState(null);

  const selectedPhoto = photoEvidenceItems.find((item) => (
    String(item.id) === String(selectedPhotoId || '')
  )) || null;

  const completedCommunicationItems = useMemo(
    () => (Array.isArray(communicationItems) ? communicationItems : [])
      .filter((item) => {
        const status = safeText(item?.status).toLowerCase();

        if (![
          'complete',
          'completed',
          'closed',
          'done',
        ].includes(status)) {
          return false;
        }

        const dateKeys = [
          item?.completed_at,
          item?.due_date,
          item?.expected_complete_date,
          item?.created_at,
        ]
          .map((value) => safeText(value).slice(0, 10))
          .filter(Boolean);

        return dateKeys.includes(selectedDate);
      }),
    [communicationItems, selectedDate]
  );

  const emailItems = useMemo(
    () => uniqueItemsByKey([
      ...outstandingItems,
      ...completedCommunicationItems,
    ]).filter((item) => {
      const searchable = [
        item?.title,
        item?.task_name,
        item?.name,
        item?.description,
        item?.details,
        item?.note,
        item?.action_type,
        item?.send_to,
      ].filter(Boolean).join(' ').toLowerCase();

      return [
        'email',
        'call',
        'contact',
        'needs sending',
        'send to',
        'reply',
        'respond',
        'communication',
        'meeting',
      ].some((term) => searchable.includes(term));
    }),
    [outstandingItems, completedCommunicationItems]
  );

  const roadblockItems = useMemo(
    () => (Array.isArray(roadblocks) ? roadblocks : [])
      .filter((item) => ![
        'COMPLETED',
        'COMPLETE',
        'CLOSED',
        'DONE',
      ].includes(
        safeText(item?.status).toUpperCase()
      ))
      .sort((a, b) => (
        safeText(a?.required_by_date).localeCompare(
          safeText(b?.required_by_date)
        )
      )),
    [roadblocks]
  );

  const staffLedgerItems = useMemo(
    () => (Array.isArray(labourRows) ? labourRows : [])
      .map((row, index) => ({
        ...row,
        _binderStaffIndex: index,
        _binderStaffId: `binder-staff-${index}`,
      }))
      .filter((row) => [
        row?.employee_name,
        row?.start_time,
        row?.finish_time,
        row?.job_number,
        row?.task_code,
        row?.description,
        row?.other,
      ].some((value) => safeText(value))),
    [labourRows]
  );

  const [selectedStaffId, setSelectedStaffId] = useState(null);

  const selectedStaff = staffLedgerItems.find((row) => (
    String(row._binderStaffId) === String(selectedStaffId || '')
  )) || null;
  const closeoutStaffHours = (
    Array.isArray(labourRows) ? labourRows : []
  ).reduce(
    (sum, row) => sum + (Number.parseFloat(row?.total_hours) || 0),
    0
  );

  const closeoutDailyCount = walkaroundItems.length;
  const closeoutStaffCount = staffLedgerItems.length;
  const closeoutRoadblockCount = roadblockItems.length;
  const closeoutPhotoCount = photoEvidenceItems.length;
  const closeoutMaterialCount = materialRows.length;

  const getCloseoutDueDateKey = (item = {}) => safeText(
    item?.due_date || item?.expected_complete_date,
    ''
  ).slice(0, 10);

  const closeoutOverdueCount = allUrgentItems.filter((item) => {
    const dueDate = getCloseoutDueDateKey(item);
    return dueDate && dueDate < selectedDate;
  }).length;

  const closeoutDueThisDayCount = allUrgentItems.filter((item) => (
    getCloseoutDueDateKey(item) === selectedDate
  )).length;

  const closeoutMissingCount =
    (closeoutDailyCount > 0 ? 0 : 1) +
    (closeoutStaffCount > 0 ? 0 : 1);

  const closeoutAttentionCount =
    closeoutMissingCount +
    closeoutOverdueCount +
    closeoutDueThisDayCount +
    closeoutRoadblockCount;

  const closeoutReady = closeoutAttentionCount === 0;

  const closeoutMissingMessages = [
    closeoutDailyCount === 0 ? 'Add a diary note.' : null,
    closeoutStaffCount === 0 ? 'Check staff on site.' : null,
  ].filter(Boolean);

  const closeoutReviewLabels = [
    closeoutOverdueCount > 0
      ? `${closeoutOverdueCount} overdue follow-up${closeoutOverdueCount === 1 ? '' : 's'}`
      : null,
    closeoutDueThisDayCount > 0
      ? `${closeoutDueThisDayCount} due-this-day follow-up${closeoutDueThisDayCount === 1 ? '' : 's'}`
      : null,
    closeoutRoadblockCount > 0
      ? `${closeoutRoadblockCount} roadblock${closeoutRoadblockCount === 1 ? '' : 's'}`
      : null,
  ].filter(Boolean);

  const closeoutStatusMessage = closeoutReady
    ? 'Required diary items are complete.'
    : [
        ...closeoutMissingMessages,
        closeoutReviewLabels.length > 0
          ? `Review ${closeoutReviewLabels.join(' and ')}.`
          : null,
      ].filter(Boolean).join(' ');
  // closeout-count-definitions-v8-9j2
  // closeout-status-message-v8-9j2-1

  const dayReviewIsReviewed = dayReview?.status === 'reviewed';
  const dayReviewNeedsChecking = dayReviewIsReviewed && !closeoutReady;

  const dayReviewTimestamp = safeText(dayReview?.reviewed_at, '');

  const dayReviewTimestampLabel = useMemo(() => {
    if (!dayReviewTimestamp) return '';

    const reviewedDate = new Date(dayReviewTimestamp);

    if (Number.isNaN(reviewedDate.getTime())) return '';

    return new Intl.DateTimeFormat('en-NZ', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Pacific/Auckland',
    }).format(reviewedDate);
  }, [dayReviewTimestamp]);

  const dayReviewReviewer = safeText(
    dayReview?.reviewed_by_name,
    'Authenticated user'
  );

  const dayReviewActionAvailable = dayReviewIsReviewed
    ? typeof onReopenDayReview === 'function'
    : typeof onMarkDayReviewed === 'function';

  const closeoutStatusClass = dayReviewNeedsChecking
    ? 'needs-attention'
    : dayReviewIsReviewed || closeoutReady
      ? 'is-ready'
      : 'needs-attention';

  const closeoutStatusTitle = dayReviewNeedsChecking
    ? 'Review needs checking'
    : dayReviewIsReviewed
      ? 'Day reviewed'
      : closeoutReady
        ? 'Ready to review'
        : closeoutAttentionCount === 1
          ? '1 item to check'
          : `${closeoutAttentionCount} items to check`;
  // day-review-status-language-v8-9k1

  const diaryRecordCount = Array.isArray(diaryEntries)
    ? diaryEntries.length
    : 0;

  const diaryRecordSummary = [
    `${diaryRecordCount} diary ${diaryRecordCount === 1 ? 'record' : 'records'}`,
    `${photoEvidenceItems.length} ${photoEvidenceItems.length === 1 ? 'photo' : 'photos'}`,
  ].join(' · ');

  const myDaySummary = [
    `${outstandingItems.length} ${outstandingItems.length === 1 ? 'action' : 'actions'} open`,
    dayReviewIsReviewed
      ? 'Day reviewed'
      : closeoutReady
        ? 'Ready to review'
        : `${closeoutAttentionCount} to check`,
  ].join(' · ');

  const closeoutDisplayedMessage = dayReviewNeedsChecking
    ? 'A review was recorded, but attention is now present. Reopen the review and check this day again.'
    : dayReviewIsReviewed
      ? `Reviewed by ${dayReviewReviewer}${dayReviewTimestampLabel ? ` on ${dayReviewTimestampLabel}` : ''}.`
      : closeoutStatusMessage;
  // persisted-day-review-ui-v8-9j8-3

  const closeoutChecklist = [
    {
      id: 'closeout-daily-record',
      targetTab: 'diary',
      title: 'Daily record',
      priority: closeoutDailyCount > 0 ? 'RECORDED' : 'MISSING',
      status: closeoutDailyCount > 0
        ? `${closeoutDailyCount} site record${closeoutDailyCount === 1 ? '' : 's'} captured`
        : 'Add a diary note or site observation',
    },
    {
      id: 'closeout-staff-on-site',
      targetTab: 'staff',
      title: 'Staff on site',
      priority: closeoutStaffCount > 0 ? 'RECORDED' : 'MISSING',
      status: closeoutStaffCount > 0
        ? `${closeoutStaffCount} staff · ${closeoutStaffHours.toFixed(2)} h checked`
        : 'Complete the Staff diary check',
    },
    {
      id: 'closeout-followups',
      targetTab: 'tasks',
      title: 'Follow-ups',
      priority:
        closeoutOverdueCount + closeoutDueThisDayCount > 0
          ? 'REVIEW'
          : 'CLEAR',
      status:
        closeoutOverdueCount + closeoutDueThisDayCount > 0
          ? `${closeoutOverdueCount} overdue | ${closeoutDueThisDayCount} due this day`
          : 'No overdue or due-this-day follow-ups',
    },
    {
      id: 'closeout-roadblocks',
      targetTab: 'roadblocks',
      title: 'Roadblocks',
      priority: closeoutRoadblockCount > 0 ? 'REVIEW' : 'CLEAR',
      status: closeoutRoadblockCount > 0
        ? `${closeoutRoadblockCount} current roadblock${closeoutRoadblockCount === 1 ? '' : 's'}`
        : 'No current roadblocks',
    },
    {
      id: 'closeout-photo-evidence',
      targetTab: 'photos',
      title: 'Photo evidence',
      priority: closeoutPhotoCount > 0 ? 'RECORDED' : 'OPTIONAL',
      status: closeoutPhotoCount > 0
        ? `${closeoutPhotoCount} evidence photo${closeoutPhotoCount === 1 ? '' : 's'}`
        : 'No photo evidence attached',
    },
    {
      id: 'closeout-materials',
      targetTab: 'materials',
      title: 'Materials',
      priority: closeoutMaterialCount > 0 ? 'RECORDED' : 'NONE',
      status: closeoutMaterialCount > 0
        ? `${closeoutMaterialCount} material record${closeoutMaterialCount === 1 ? '' : 's'}`
        : 'No materials recorded for this day',
    },
  ]; // real-closeout-readiness-v8-9j1
  // actionable-closeout-readiness-v8-9j6-1
  const focusedItemsByTab = {
    diary: entries,
    tasks,
    materials: materialRows,
    emails: emailItems,
    roadblocks: roadblockItems,
    walkaround: walkaroundItems,
    photos: photoEvidenceItems,
    staff: staffLedgerItems,
    closeout: closeoutChecklist,
  };

  const focusedItems = focusedItemsByTab[activeTab] || [];

  const focusedCounts = {
    diary: entries.length,
    tasks: tasks.length,
    materials: materialRows.length,
    emails: emailItems.length,
    roadblocks: roadblockItems.length,
    walkaround: walkaroundItems.length,
    photos: photoEvidenceItems.length,
    staff: staffLedgerItems.length,
    closeout: closeoutAttentionCount,
  };

  const focusedCount =
    focusedCounts[activeTab] ?? focusedItems.length;

  const focusedEmptyCopy = {
    diary: 'No timestamped diary records have been captured for this day.',
    tasks: 'No open actions or checks are waiting for review.',
    materials: 'No materials have been recorded for this diary day.',
    emails: 'No emails, calls, meetings or other communications are recorded for this day.',
    roadblocks: 'No current roadblocks were identified for this diary day.',
    walkaround: 'No walkaround observations have been recorded for this day.',
    photos: 'No photographic evidence has been attached for this day.',
    staff: 'No staff or labour rows have been recorded for this day.',
    closeout: 'Review the current day before opening the full Diary readiness section.',
  };

  const getFocusedItemTitle = (item = {}, index = 0) => (
    item?.title ||
    item?.task_name ||
    item?.name ||
    item?.note ||
    item?.description ||
    item?.item ||
    `Record ${index + 1}`
  );

  const getFocusedItemMeta = (item = {}) => [
    item?.priority,
    item?.owner,
    item?.status,
    item?.due_date
      ? `Due ${String(item.due_date).slice(0, 10)}`
      : '',
    item?.quantity,
    item?.supplier,
  ].filter(Boolean).join(' · ');

  const focusedRegisterCopy =
    BINDER_REGISTER_COPY[activeTab] || {
      listTitle: activeTabConfig.label,
      detailTitle: `${activeTabConfig.label} desk`,
      unit: 'record',
      emptyAction: `Open ${activeTabConfig.label}`,
      selection: `Select a ${activeTabConfig.label.toLowerCase()} record to review it.`,
    };

  const focusedHasDetail = Boolean(
    (
      ['tasks', 'emails'].includes(activeTab) &&
      selectedTask &&
      selectedTaskDraft
    ) || (
      activeTab === 'materials' &&
      selectedMaterial
    ) || (
      activeTab === 'roadblocks' &&
      (selectedRoadblock || roadblockAddOpen)
    ) || (
      activeTab === 'walkaround' &&
      (selectedWalkaround || walkaroundAddOpen)
    ) || (
      activeTab === 'photos' &&
      selectedPhoto
    ) || (
      activeTab === 'staff' &&
      (selectedStaff || staffAddOpen)
    )
  );

  const focusedRegisterSummary = [
    `${focusedItems.length} ${focusedRegisterCopy.unit}${
      focusedItems.length === 1 ? '' : 's'
    }`,
    selectedDateLabel,
  ].join(' · ');


  return (
    <section
      className={`lld-digital-job-binder lld-binder-active-${activeTab} lld-binder-mobile-page-${mobileTodayPage}`}
      data-testid="lld-digital-job-binder-v1"
      data-commercial-readiness="lld-digital-job-binder-v1"
    >
      <header
        className={`lld-binder-capture-panel${
          selectedDate === today
            ? ''
            : ' lld-binder-capture-panel-history'
        }`}
        data-capture-mode={selectedDate === today ? 'today' : 'history'}
      >
        <div className="lld-binder-capture-heading">
          <div className="lld-binder-capture-title">
            <p>{selectedDate === today ? 'Digital Job Binder' : 'Diary archive'}</p>
            <h2>{selectedDate === today ? 'Write it down' : 'Past diary day'}</h2>
            <span>
              {selectedDate === today
                ? 'LLD timestamps the entry and keeps important work visible.'
                : 'Review the recorded day without changing today\'s working diary.'}
            </span>
          </div>

          <label className="lld-binder-project-picker">
            <BookOpen aria-hidden="true" />
            <span>Project</span>
            <select
              value={selectedProject}
              onChange={(event) => onSelectProject?.(event.target.value)}
              disabled={projects.length === 0}
              aria-label="Choose diary project"
              data-testid="lld-binder-project-select-v9-0"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.job_number
                    ? `${project.job_number} — ${project.name}`
                    : project.name}
                </option>
              ))}
            </select>
          </label>

          <div
            className="lld-binder-date-controls"
            data-testid="lld-binder-date-controls-v8-9i1"
          >
            <button
              type="button"
              onClick={() => onChangeDate?.(-1)}
              aria-label="Previous diary day"
            >
              <ChevronLeft />
            </button>

            <label
              className="lld-binder-date-picker"
              title="Choose diary date"
              data-testid="lld-binder-date-picker-v8-9i1"
            >
              <CalendarDays aria-hidden="true" />
              <strong>
                {new Intl.DateTimeFormat('en-NZ', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }).format(new Date(`${selectedDate}T12:00:00`))}
              </strong>
              <input
                type="date"
                value={selectedDate}
                max={today}
                onChange={(event) => onSelectDate?.(event.target.value)}
                aria-label="Choose diary date"
              />
            </label>

            <button
              type="button"
              onClick={() => onChangeDate?.(1)}
              disabled={selectedDate >= today}
              aria-label="Next diary day"
            >
              <ChevronRight />
            </button>

            {selectedDate !== today && (
              <button
                type="button"
                className="lld-binder-date-today"
                onClick={() => onSelectDate?.(today)}
                data-testid="lld-binder-date-today-v8-9i1"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {selectedDate === today ? (
          <form
            className="lld-binder-quick-form"
            onSubmit={onQuickSubmit}
          >
            <textarea
              value={quickNote}
              onChange={(event) => onQuickNoteChange?.(event.target.value)}
              placeholder="Write anything you need to remember, do, order, email, check, chase or record..."
              rows={1}
              data-testid="lld-binder-quick-note-v1"
            />

            <div
              className="lld-binder-quick-actions"
              aria-label="Diary note actions"
              data-testid="lld-binder-unified-capture-v2s2"
            >
              <button
                type="submit"
                className="lld-binder-quick-save"
                disabled={submitting || !safeText(quickNote)}
                data-testid="lld-binder-quick-save-v1"
              >
                <Plus />
                {submitting ? 'Saving...' : 'Add to diary'}
              </button>

              <button
                type="button"
                className="lld-binder-quick-details"
                onClick={(event) => openDiaryEditor(event.currentTarget)}
                disabled={submitting}
                data-testid="lld-binder-quick-details-v2s2"
              >
                <Camera aria-hidden="true" />
                Add details & photos
              </button>
            </div>
          </form>
        ) : (
          <div
            className="lld-binder-history-message"
            data-testid="lld-binder-history-status-v1l"
          >
            <CalendarDays aria-hidden="true" />
            <strong>Historical record</strong>
            <span>Use Today to return to live capture.</span>
          </div>
        )}

        {selectedDate === today && (
          <div className="lld-binder-project-strip">
            <span>Today</span>

            <span>
              {draftStatus || projectName}
            </span>
          </div>
        )}
      </header>

      <nav
        className="lld-binder-today-mobile-switch"
        aria-label="Choose Today diary page"
        data-testid="lld-binder-mobile-page-switch-v1h"
      >
        <button
          type="button"
          className={mobileTodayPage === 'diary' ? 'active' : ''}
          aria-pressed={mobileTodayPage === 'diary'}
          aria-controls="lld-binder-diary-page"
          onClick={() => setMobileTodayPage('diary')}
        >
          <BookOpen aria-hidden="true" />
          <span>
            <strong>Diary</strong>
            <small>{diaryRecordCount} {diaryRecordCount === 1 ? 'record' : 'records'}</small>
          </span>
        </button>

        <button
          type="button"
          className={mobileTodayPage === 'my-day' ? 'active' : ''}
          aria-pressed={mobileTodayPage === 'my-day'}
          aria-controls="lld-binder-my-day-page"
          onClick={() => setMobileTodayPage('my-day')}
        >
          <ClipboardCheck aria-hidden="true" />
          <span>
            <strong>My Day</strong>
            <small>{outstandingItems.length} {outstandingItems.length === 1 ? 'action' : 'actions'}</small>
          </span>
        </button>
      </nav>

      <div className="lld-binder-stage">
        <div className="lld-binder-cover">
          <div className="lld-binder-pages">
            <BinderRings />

            <section
              id="lld-binder-diary-page"
              className="lld-binder-page lld-binder-page-left"
            >
                            <div
                className="lld-binder-page-heading lld-binder-diary-date-heading"
                data-testid="lld-binder-diary-date-navigation-v2q-6"
              >
                <button
                  type="button"
                  className="lld-binder-page-day-nav lld-binder-page-day-nav-previous"
                  onClick={() => onChangeDate?.(-1)}
                  aria-label="Previous diary day"
                  title="Previous day"
                >
                  <ChevronLeft aria-hidden="true" />
                  <span>Previous day</span>
                </button>

                <div className="lld-binder-diary-date-title">
                  <p>
                    {new Intl.DateTimeFormat('en-NZ', {
                      weekday: 'long',
                    }).format(new Date(`${selectedDate}T12:00:00`))}
                  </p>

                  <h3>
                    {new Intl.DateTimeFormat('en-NZ', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }).format(new Date(`${selectedDate}T12:00:00`))}
                  </h3>

                  <span>{projectName}</span>
                </div>

                <button
                  type="button"
                  className="lld-binder-page-day-nav lld-binder-page-day-nav-next"
                  onClick={() => onChangeDate?.(1)}
                  disabled={selectedDate >= today}
                  aria-label="Next diary day"
                  title={
                    selectedDate >= today
                      ? 'This is the latest diary day'
                      : 'Next day'
                  }
                >
                  <span>Next day</span>
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>

              <div className="lld-binder-diary-list">
                {entries.length > 0 ? (
                  entries.map((entry, index) => (
                    <DiaryEntry
                      key={entry?.id || entry?.saved_at || entry?.created_at || index}
                      entry={entry}
                    />
                  ))
                ) : (
                  <div className="lld-binder-empty">
                    No timestamped diary entries have been recorded for this day yet.
                  </div>
                )}
              </div>

              <footer
                className="lld-binder-page-footer"
                aria-label={`Diary page summary: ${diaryRecordSummary}`}
                data-testid="lld-binder-diary-page-footer-v1g"
              >
                <span>{diaryRecordSummary}</span>
                <span className="lld-binder-page-signature">Long Line Diary</span>
                <strong aria-label="Page 1">01</strong>
              </footer>
            </section>

            <section
              id="lld-binder-my-day-page"
              className={`lld-binder-page lld-binder-page-right${
                selectedTask && selectedTaskDraft
                  ? ' lld-binder-action-detail-page'
                  : ''
              }`}
            >
              {selectedTask && selectedTaskDraft ? (
                <div
                  className="lld-binder-action-detail"
                  data-testid="lld-binder-native-action-detail-v8-9a6"
                  aria-busy={taskDetailSaving}
                >
                  <div className="lld-binder-page-heading lld-binder-action-detail-heading">
                    <div>
                      <p>Action record</p>
                      <h3>Action detail</h3>
                      <span>
                        Edit this follow-up without leaving the open diary.
                      </span>
                    </div>

                    <button
                      type="button"
                      className="lld-binder-action-back"
                      onClick={onCloseTask}
                      disabled={taskDetailSaving}
                    >
                      ← My Day
                    </button>
                  </div>

                  <form
                    className="lld-binder-action-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      onSaveTask?.();
                    }}
                  >
                    <label className="lld-binder-action-field lld-binder-action-field-wide">
                      <span>Title</span>
                      <input
                        type="text"
                        value={selectedTaskDraft.title || ''}
                        onChange={(event) => (
                          onTaskDraftChange?.('title', event.target.value)
                        )}
                        disabled={taskDetailSaving}
                        data-testid="lld-binder-action-title-input-v8-9a6"
                      />
                    </label>

                    <label className="lld-binder-action-field">
                      <span>Owner</span>
                      <input
                        type="text"
                        value={selectedTaskDraft.owner || ''}
                        placeholder="Responsible person"
                        onChange={(event) => (
                          onTaskDraftChange?.('owner', event.target.value)
                        )}
                        disabled={taskDetailSaving}
                      />
                    </label>

                    <label className="lld-binder-action-field">
                      <span>Priority</span>
                      <select
                        value={selectedTaskDraft.priority || 'medium'}
                        onChange={(event) => (
                          onTaskDraftChange?.('priority', event.target.value)
                        )}
                        disabled={taskDetailSaving}
                      >
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                        <option value="deferred">Deferred</option>
                      </select>
                    </label>

                    <label className="lld-binder-action-field">
                      <span>Status</span>
                      <select
                        value={selectedTaskDraft.status || 'open'}
                        onChange={(event) => (
                          onTaskDraftChange?.('status', event.target.value)
                        )}
                        disabled={taskDetailSaving || selectedTaskIsComplete}
                      >
                        <option value="open">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="blocked">Blocked</option>
                        {selectedTaskIsComplete && (
                          <option value="completed">Complete</option>
                        )}
                      </select>
                    </label>

                    <label className="lld-binder-action-field">
                      <span>Due</span>
                      <input
                        type="date"
                        value={selectedTaskDraft.due_date || ''}
                        onChange={(event) => (
                          onTaskDraftChange?.('due_date', event.target.value)
                        )}
                        disabled={taskDetailSaving}
                      />
                    </label>

                    <label className="lld-binder-action-field">
                      <span>Expected complete</span>
                      <input
                        type="date"
                        value={selectedTaskDraft.expected_complete_date || ''}
                        onChange={(event) => (
                          onTaskDraftChange?.(
                            'expected_complete_date',
                            event.target.value
                          )
                        )}
                        disabled={taskDetailSaving}
                      />
                    </label>

                    <label className="lld-binder-action-field lld-binder-action-field-wide">
                      <span>Details</span>
                      <textarea
                        value={selectedTaskDraft.description || ''}
                        placeholder="Notes, instruction, required response, or site detail..."
                        onChange={(event) => (
                          onTaskDraftChange?.(
                            'description',
                            event.target.value
                          )
                        )}
                        disabled={taskDetailSaving}
                        rows="3"
                      />
                    </label>

                    <div className="lld-binder-action-controls">
                      <button
                        type="submit"
                        className="lld-binder-action-button lld-binder-action-button-primary"
                        disabled={taskDetailSaving || typeof onSaveTask !== 'function'}
                      >
                        {taskDetailSaving ? 'Saving…' : 'Save follow-up'}
                      </button>

                      {selectedTaskIsComplete ? (
                        <button
                          type="button"
                          className="lld-binder-action-button"
                          onClick={onReopenSelectedTask}
                          disabled={
                            taskDetailSaving ||
                            typeof onReopenSelectedTask !== 'function'
                          }
                        >
                          Reopen
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="lld-binder-action-button"
                          onClick={onCompleteSelectedTask}
                          disabled={
                            taskDetailSaving ||
                            taskCompletionPending ||
                            typeof onCompleteSelectedTask !== 'function'
                          }
                        >
                          Mark complete
                        </button>
                      )}

                      <button
                        type="button"
                        className="lld-binder-action-button lld-binder-action-button-quiet"
                        onClick={onCloseTask}
                        disabled={taskDetailSaving}
                      >
                        Back to My Day
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <>
                  <div className="lld-binder-page-heading">
                <div>
                  <p>
                    {new Date(`${selectedDate}T12:00:00`).getDay() === 0
                      ? 'Non-working day'
                      : 'Working day'}
                  </p>
                  <h3>My Day</h3>
                  <span>Important items remain visible until dealt with.</span>
                </div>

                <ClipboardCheck />
              </div>

              <div className="lld-binder-attention-box lld-binder-outstanding-ledger">
                <div className="lld-binder-section-title">
                  <span>
                    <AlertTriangle />
                    Outstanding actions
                  </span>

                  <strong>{outstandingItems.length}</strong>
                </div>

                {outstandingItems.length > 0 ? (
                  outstandingItems.slice(0, 6).map((item) => (
                    <WorkItem
                      key={getItemKey(item)}
                      item={item}
                      tone={urgentItemKeys.has(getItemKey(item)) ? 'urgent' : 'standard'}
                      onOpen={onOpenTask || onOpenTasks}
                      onComplete={onCompleteTask}
                      completionDisabled={taskCompletionPending}
                      referenceDate={selectedDate}
                    />
                  ))
                ) : (
                  <div className="lld-binder-empty lld-binder-empty-compact">
                    No outstanding actions or checks.
                  </div>
                )}
              </div>

              <div
                className="lld-binder-summary-strip"
                aria-label="Daily totals"
              >
                <button
                  type="button"
                  onClick={() => handleTab('materials')}
                >
                  <Package />
                  <strong>{materialRows.length}</strong>
                  <span>Materials</span>
                </button>

                <button type="button" onClick={() => handleTab('staff')}>
                  <Users />
                  <strong>{staffLedgerItems.length}</strong>
                  <span>Staff</span>
                </button>

                <button type="button" onClick={onOpenPhotos}>
                  <Camera />
                  <strong>{photoEvidenceItems.length}</strong>
                  <span>Evidence</span>
                </button>
              </div>
                </>
              )}

              {!(selectedTask && selectedTaskDraft) && (
                <footer
                  className="lld-binder-page-footer"
                  aria-label={`My Day page summary: ${myDaySummary}`}
                  data-testid="lld-binder-my-day-page-footer-v1g"
                >
                  <span>{myDaySummary}</span>
                  <span className="lld-binder-page-signature">My Day</span>
                  <strong aria-label="Page 2">02</strong>
                </footer>
              )}
            </section>

        {activeTab === 'diary' && (
          <section
            key="diary"
            className="lld-binder-focused-spread lld-binder-diary-focused-spread"
            data-testid="lld-binder-diary-spread-v2q-7"
          >
            <article className="lld-binder-focused-page lld-binder-diary-focused-page lld-binder-diary-focused-page-left">
              <div className="lld-binder-page-heading lld-binder-diary-date-heading">
                <button
                  type="button"
                  className="lld-binder-page-day-nav lld-binder-page-day-nav-previous"
                  onClick={() => onChangeDate?.(-1)}
                  aria-label="Previous diary day"
                  title="Previous day"
                >
                  <ChevronLeft aria-hidden="true" />
                  <span>Previous day</span>
                </button>

                <div className="lld-binder-diary-date-title">
                  <p>
                    {new Intl.DateTimeFormat('en-NZ', {
                      weekday: 'long',
                    }).format(new Date(`${selectedDate}T12:00:00`))}
                  </p>

                  <h3>
                    {new Intl.DateTimeFormat('en-NZ', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }).format(new Date(`${selectedDate}T12:00:00`))}
                  </h3>

                  <span>{projectName}</span>
                </div>

                <button
                  type="button"
                  className="lld-binder-page-day-nav lld-binder-page-day-nav-next"
                  onClick={() => onChangeDate?.(1)}
                  disabled={selectedDate >= today}
                  aria-label="Next diary day"
                  title={
                    selectedDate >= today
                      ? 'This is the latest diary day'
                      : 'Next day'
                  }
                >
                  <span>Next day</span>
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>

              <div className="lld-binder-focused-rule" />

              <div className="lld-binder-diary-focused-list">
                {entries.length > 0 ? (
                  entries
                    .slice(0, Math.max(1, Math.ceil(entries.length / 2)))
                    .map((entry, index) => (
                      <DiaryEntry
                        key={entry?.id || entry?.saved_at || entry?.created_at || index}
                        entry={entry}
                      />
                    ))
                ) : (
                  <div className="lld-binder-diary-focused-empty">
                    <BookOpen aria-hidden="true" />
                    <strong>No entries recorded</strong>
                    <p>This diary page is ready for the first site record of the day.</p>
                  </div>
                )}
              </div>

              <footer
                className="lld-binder-page-footer"
                aria-label={`Diary page summary: ${diaryRecordSummary}`}
              >
                <span>{diaryRecordSummary}</span>
                <span className="lld-binder-page-signature">Diary</span>
                <strong aria-label="Page 3">
                  {getBinderPageNumber('diary')}
                </strong>
              </footer>
            </article>

            <article className="lld-binder-focused-page lld-binder-diary-focused-page lld-binder-diary-focused-page-right">
              <header className="lld-binder-page-heading lld-binder-diary-continuation-heading">
                <div>
                  <p>Daily record</p>
                  <h3>
                    {entries.length > 1 ? 'Continued' : 'Supporting notes'}
                  </h3>
                  {/* diary-supporting-notes-v2r-1 */}
                  <span>{projectName}</span>
                </div>

                <BookOpen aria-hidden="true" />
              </header>

              <div className="lld-binder-focused-rule" />

              <div className="lld-binder-diary-focused-list">
                {entries.length > 1 ? (
                  entries
                    .slice(Math.max(1, Math.ceil(entries.length / 2)))
                    .map((entry, index) => (
                      <DiaryEntry
                        key={entry?.id || entry?.saved_at || entry?.created_at || index}
                        entry={entry}
                      />
                    ))
                ) : (
                  <div className="lld-binder-diary-continuation-empty">
                    <BookOpen aria-hidden="true" />
                    <p>Additional entries and supporting details will continue here.</p>
                  </div>
                )}
              </div>

              <footer
                className="lld-binder-page-footer"
                aria-label={`Supporting evidence: ${photoEvidenceItems.length} photos`}
              >
                <span>
                  {photoEvidenceItems.length}{' '}
                  {photoEvidenceItems.length === 1 ? 'photo' : 'photos'}
                </span>
                <span className="lld-binder-page-signature">Long Line Diary</span>
                <strong aria-label="Page 4">
                  {getBinderPageNumber('diary', 1)}
                </strong>
              </footer>
            </article>
          </section>
        )}

        {activeTab !== 'today' && activeTab !== 'diary' && (
          <section
            key={activeTab}
            className={`lld-binder-focused-spread lld-binder-register-spread${
              activeTab === 'tasks'
                ? ' lld-binder-tasks-ledger-spread'
                : activeTab === 'materials'
                  ? ' lld-binder-materials-ledger-spread'
                  : activeTab === 'emails'
                    ? ' lld-binder-tasks-ledger-spread lld-binder-communications-ledger-spread'
                    : activeTab === 'staff'
                      ? ' lld-binder-active-staff'
                      : ''
            }`}
            data-staff-workspace={
              activeTab === 'staff'
                ? 'staff-workspace-active-class-v1'
                : undefined
            }
            data-testid={`lld-binder-focused-page-${activeTab}`}
          >
            <article className="lld-binder-focused-page lld-binder-focused-page-left lld-binder-register-index-page">
              <header className="lld-binder-page-heading lld-binder-register-index-heading">
                <div>
                  <p>{activeTabConfig.description}</p>
                  <h3>{activeTabConfig.label}</h3>
                  <span>
                    {selectedDateLabel}
                    {activeTab === 'closeout' ? '' : ` · ${projectName}`}
                  </span>
                </div>
                {activeTab === 'closeout' && (
                  <span
                    className="lld-binder-closeout-project-v8-9j4-1"
                    data-testid="lld-binder-closeout-project-v8-9j4-1"
                  >
                    {projectName}
                  </span>
                )}
                {/* closeout-project-context-v8-9j4-1 */}
              </header>

              <div className="lld-binder-focused-rule" />

              {activeTab === 'staff' && (
                <CompactStaffCrewList
                  rows={staffLedgerItems}
                  selectedStaffId={selectedStaffId}
                  selectedDateLabel={selectedDateLabel}
                  staffSaving={staffSaving}
                  onAddStaff={() => {
                    setSelectedStaffId(null);
                    setStaffAddOpen(true);
                  }}
                  onSetAllNormalDay={onSetAllStaffNormalDay}
                  onSelect={(row) => {
                    setStaffAddOpen(false);
                    setSelectedStaffId(row?._binderStaffId || null);
                  }}
                />
              )}

              {activeTab === 'closeout' && (
                <div
                  className={`lld-binder-closeout-status ${closeoutStatusClass}`}
                  data-testid="lld-binder-closeout-status-v8-9j1"
                  data-review-status={dayReviewIsReviewed ? 'reviewed' : 'needs-review'}
                >
                  {closeoutStatusClass === 'is-ready'
                    ? <CheckCircle2 />
                    : <AlertTriangle />}

                  <div>
                    <strong>
                      {closeoutStatusTitle}
                    </strong>
                    <span>
                      {closeoutDisplayedMessage}
                    </span>
                  </div>
                </div>
              )}

              <div className="lld-binder-focused-count">
                <strong>{focusedCount}</strong>
                <span>
                  {activeTab === 'tasks'
                    ? focusedCount === 1
                      ? 'open action'
                      : 'open actions'
                    : activeTab === 'materials'
                      ? focusedCount === 1
                        ? 'material record'
                        : 'material records'
                      : activeTab === 'emails'
                        ? focusedCount === 1
                          ? 'communication record'
                          : 'communication records'
                        : activeTab === 'roadblocks'
                          ? focusedCount === 1
                            ? 'active roadblock'
                            : 'active roadblocks'
                          : activeTab === 'walkaround'
                            ? focusedCount === 1
                              ? 'site observation'
                              : 'site observations'
                            : activeTab === 'photos'
                              ? focusedCount === 1
                                ? 'evidence photo'
                                : 'evidence photos'
                              : activeTab === 'staff'
                                ? focusedCount === 1
                                  ? 'staff member'
                                  : 'staff members'
                                : activeTab === 'closeout'
                                  ? focusedCount === 1
                                    ? 'attention point'
                                    : 'attention points'
                                  : focusedCount === 1
                                    ? 'record for this day'
                                    : 'records for this day'}
                </span>
              </div>

              {activeTab === 'tasks' && (
                <div
                  className="lld-binder-register-tally lld-binder-task-tally"
                  aria-label="Open action date totals"
                >
                  <span
                    className={
                      taskDateSummary.overdue > 0
                        ? 'lld-binder-register-tally-attention'
                        : ''
                    }
                  >
                    <strong>{taskDateSummary.overdue}</strong>
                    Overdue
                  </span>

                  <span>
                    <strong>{taskDateSummary.dueToday}</strong>
                    Due today
                  </span>

                  <span>
                    <strong>{taskDateSummary.noDate}</strong>
                    No due date
                  </span>
                </div>
              )} {/* register-tally-v2r-1 */}

              {activeTab === 'materials' && (
                <div
                  className="lld-binder-material-tally lld-binder-register-tally"
                  aria-label="Materials status totals"
                >
                  <span>
                    <strong>{materialNotedCount}</strong>
                    Noted
                  </span>

                  <span>
                    <strong>{materialOnSiteCount}</strong>
                    On site / used
                  </span>

                  <span
                    className={
                      materialAttentionCount > 0
                        ? 'lld-binder-material-tally-attention lld-binder-register-tally-attention'
                        : ''
                    }
                  >
                    <strong>{materialAttentionCount}</strong>
                    Attention
                  </span>
                </div>
              )}

              <button
                type="button"
                className="lld-binder-focused-workflow-button"
                onClick={
                  activeTab === 'closeout'
                    ? dayReviewIsReviewed
                      ? onReopenDayReview
                      : onMarkDayReviewed
                    : openActiveWorkflow
                }
                disabled={
                  activeTab === 'closeout' && (
                    reviewSaving ||
                    !dayReviewActionAvailable ||
                    (!dayReviewIsReviewed && !closeoutReady)
                  )
                }
                aria-busy={
                  activeTab === 'closeout' && reviewSaving
                    ? 'true'
                    : undefined
                }
                data-testid={
                  activeTab === 'closeout'
                    ? 'lld-binder-day-review-action-v8-9j8-3'
                    : undefined
                }
              >
                {activeTab === 'materials'
                  ? 'Add / edit materials'
                  : activeTab === 'emails'
                    ? '+ Add communication'
                    : activeTab === 'photos'
                      ? 'Capture photo evidence'
                      : activeTab === 'staff'
                        ? 'Add staff member'
                        : activeTab === 'roadblocks'
                          ? '+ Add Roadblock' // binder-roadblock-primary-action-label-v2s2f1
                          : activeTab === 'walkaround'
                            ? '+ Add Observation'
                            : activeTab === 'closeout'
                          ? reviewSaving
                            ? dayReviewIsReviewed
                              ? 'Reopening review...'
                              : 'Saving review...'
                            : dayReviewIsReviewed
                              ? 'Reopen review'
                              : closeoutReady
                                ? 'Mark day reviewed'
                                : 'Complete required items first'
                          : `Open full ${activeTabConfig.label} workflow`}
              </button>

              {activeTab === 'closeout' && (
                <button
                  type="button"
                  className="lld-binder-closeout-print-button"
                  onClick={onPrintDiary}
                  disabled={typeof onPrintDiary !== 'function'}
                  data-testid="lld-binder-day-review-print-v1m"
                >
                  <Printer aria-hidden="true" />
                  <span>Print / Save PDF</span>
                </button>
              )}

              <footer
                className="lld-binder-page-footer"
                aria-label={`${activeTabConfig.label} section summary: ${focusedRegisterSummary}`}
              >
                <span>{focusedRegisterSummary}</span>
                <span className="lld-binder-page-signature">
                  {activeTabConfig.label}
                </span>
                <strong
                  aria-label={`Page ${getBinderPageNumber(activeTab)}`}
                >
                  {getBinderPageNumber(activeTab)}
                </strong>
              </footer>
            </article>

            <article
              className={`lld-binder-focused-page lld-binder-focused-page-right lld-binder-register-list-page${
                (
                  ['tasks', 'emails'].includes(activeTab) &&
                  selectedTask &&
                  selectedTaskDraft
                ) || (
                  activeTab === 'materials' &&
                  selectedMaterial
                ) || (
                  activeTab === 'roadblocks' &&
                  (selectedRoadblock || roadblockAddOpen)
                ) || (
                  activeTab === 'walkaround' &&
                  (selectedWalkaround || walkaroundAddOpen)
                ) || (
                  activeTab === 'photos' &&
                  selectedPhoto
                ) || (
                  activeTab === 'emails' &&
                  communicationAddOpen
                ) || (
                  activeTab === 'staff' &&
                  (selectedStaff || staffAddOpen)
                )
                  ? ' lld-binder-action-detail-page'
                  : ''
              }`}
            >
              <div className="lld-binder-register-page-body">
              {activeTab === 'staff' &&
              staffAddOpen ? (
                <BinderStaffAdd
                  employeeOptions={
                    typeof getStaffEmployeeOptions === 'function'
                      ? getStaffEmployeeOptions('')
                      : []
                  }
                  staffSaving={staffSaving}
                  onAddEmployee={(value) => {
                    const nextIndex = labourRows.length;
                    onAddStaffEmployee?.(value);
                    setStaffAddOpen(false);
                    setSelectedStaffId(`binder-staff-${nextIndex}`);
                  }}
                  onAddSiteStaff={(name) => {
                    const nextIndex = labourRows.length;
                    onAddSiteStaff?.(name);
                    setStaffAddOpen(false);
                    setSelectedStaffId(`binder-staff-${nextIndex}`);
                  }}
                  onClose={() => setStaffAddOpen(false)}
                />
              ) : activeTab === 'staff' &&
              selectedStaff ? (
                <BinderStaffDetail
                  row={selectedStaff}
                  rowIndex={selectedStaff._binderStaffIndex}
                  allocationRows={staffLedgerItems.filter((item) => {
                    const selectedEmployeeId =
                      String(selectedStaff.employee_id || '').trim();

                    const itemEmployeeId =
                      String(item.employee_id || '').trim();

                    if (selectedEmployeeId) {
                      return itemEmployeeId === selectedEmployeeId;
                    }

                    return (
                      String(item.employee_name || '')
                        .trim()
                        .toLowerCase() ===
                      String(selectedStaff.employee_name || '')
                        .trim()
                        .toLowerCase()
                    );
                  })}
                  currentProject={currentProject}
                  staffSaving={staffSaving}
                  staffImporting={staffImporting}
                  staffSaveStatus={staffSaveStatus}
                  getEmployeeOptions={getStaffEmployeeOptions}
                  getJobOptions={getStaffJobOptions}
                  getTaskOptions={getStaffTaskOptions}
                  onEmployeeChange={onStaffEmployeeChange}
                  onChange={onStaffChange}
                  onSave={onSaveStaff}
                  onRemove={onRemoveStaff}
                  onAddAllocation={(sourceIndex) => {
                    const nextIndex =
                      onAddStaffAllocation?.(sourceIndex);

                    if (
                      Number.isInteger(nextIndex) &&
                      nextIndex >= 0
                    ) {
                      setSelectedStaffId(
                        `binder-staff-${nextIndex}`
                      );
                    }
                  }}
                  onSelectAllocation={(allocation) => {
                    setSelectedStaffId(
                      allocation?._binderStaffId ||
                      `binder-staff-${allocation?._binderStaffIndex}`
                    );
                  }}
                  onImport={onImportStaff}
                  onClose={() => setSelectedStaffId(null)}
                />
              ) : activeTab === 'photos' &&
              selectedPhoto ? (
                <BinderPhotoDetail
                  evidence={selectedPhoto}
                  onOpenWorkflow={onOpenPhotos}
                  onClose={() => setSelectedPhotoId(null)}
                />
              ) : activeTab === 'walkaround' &&
              walkaroundAddOpen ? (
                <BinderWalkaroundAdd saving={walkaroundSaving} onSave={onSaveWalkaround} onClose={() => setWalkaroundAddOpen(false)} />
              ) : activeTab === 'walkaround' &&
              selectedWalkaround ? (
                <BinderWalkaroundDetail
                  entry={selectedWalkaround}
                  onOpenWorkflow={onOpenWalkaround}
                  onClose={() => setSelectedWalkaroundId(null)}
                />
              ) : activeTab === 'roadblocks' &&
              roadblockAddOpen ? (
                <BinderRoadblockEditor
                  saving={roadblockSaving}
                  onSave={onSaveRoadblock}
                  onComplete={onCompleteRoadblock}
                  onReopen={onReopenRoadblock}
                  onClose={() => setRoadblockAddOpen(false)}
                />
              ) : activeTab === 'roadblocks' &&
              selectedRoadblock ? (
                <BinderRoadblockEditor
                  roadblock={selectedRoadblock}
                  saving={roadblockSaving}
                  onSave={onSaveRoadblock}
                  onComplete={onCompleteRoadblock}
                  onReopen={onReopenRoadblock}
                  onClose={onCloseRoadblock}
                />
              ) : activeTab === 'emails' &&
              communicationAddOpen ? (
                <BinderCommunicationAdd
                  saving={communicationSaving}
                  onSave={onAddCommunication}
                  onClose={() => setCommunicationAddOpen(false)}
                />
              ) : ['tasks', 'emails'].includes(activeTab) &&
              selectedTask &&
              selectedTaskDraft ? (
                <BinderTasksActionDetail
                  selectedTask={selectedTask}
                  selectedTaskDraft={selectedTaskDraft}
                  detailContext={activeTab}
                  taskDetailSaving={taskDetailSaving}
                  taskCompletionPending={taskCompletionPending}
                  onTaskDraftChange={onTaskDraftChange}
                  onSaveTask={onSaveTask}
                  onCompleteSelectedTask={onCompleteSelectedTask}
                  onReopenSelectedTask={onReopenSelectedTask}
                  onCloseTask={onCloseTask}
                />
              ) : activeTab === 'materials' &&
                selectedMaterial ? (
                <BinderMaterialDetail
                  material={selectedMaterial}
                  materialSaving={materialSaving}
                  onChange={onMaterialChange}
                  onSave={onSaveMaterial}
                  onRemove={onRemoveMaterial}
                  onClose={onCloseMaterial}
                />
              ) : (
                <>
              <header className="lld-binder-page-heading lld-binder-focused-list-heading">
                <div>
                  <p>Daily register</p>
                  <h3>
                  {activeTab === 'tasks'
                    ? 'Open actions'
                    : activeTab === 'materials'
                      ? 'Materials register'
                      : activeTab === 'emails'
                        ? 'Communications log'
                        : activeTab === 'roadblocks'
                          ? 'Active roadblocks'
                          : activeTab === 'walkaround'
                            ? 'Site observations'
                            : activeTab === 'photos'
                              ? 'Photo evidence'
                              : activeTab === 'staff'
                                ? 'Staff on site'
                                : activeTab === 'closeout'
                                  ? 'Day readiness'
                                  : 'Daily records'}
                  </h3>
                  <span>{selectedDateLabel}</span>
                </div>
                <strong>
                  {activeTab === 'closeout'
                    ? focusedItems.length
                    : focusedCount}
                </strong>
              </header>

              {activeTab === 'staff' && (
                <>
                  <CompactDailyStaffRegister
                    rows={labourRows}
                    selectedDateLabel={selectedDateLabel}
                    staffSaving={staffSaving}
                    staffSaveStatus={staffSaveStatus}
                    onChange={onStaffChange}
                    onSetAllNormalDay={onSetAllStaffNormalDay}
                    onAddStaff={() => setStaffAddOpen(true)}
                    // staff-details-raw-row-index-fix-v2s2c
                    onOpenDetails={(row, rowIndex) => {
                      setStaffAddOpen(false);
                      setSelectedStaffId(
                        row?._binderStaffId ||
                        `binder-staff-${rowIndex}`
                      );
                    }}
                  />

                  <WeeklyStaffDashboard
                    weeklyLabour={weeklyLabour}
                    loading={weeklyLabourLoading}
                    error={weeklyLabourError}
                  />
                </>
              )}

              {activeTab !== 'staff' && focusedItems.length > 0 ? (
                <div className="lld-binder-focused-list">
                  {(
                    activeTab === 'tasks' ||
                    activeTab === 'materials' ||
                    activeTab === 'emails' ||
                    activeTab === 'roadblocks' ||
                    activeTab === 'walkaround' ||
                    activeTab === 'photos' ||
                    activeTab === 'staff'
                      ? focusedItems
                      : focusedItems.slice(0, 8)
                  ).map((item, index) => (
                    activeTab === 'staff' ? (
                      <StaffLedgerRow
                        key={item._binderStaffId}
                        item={item}
                        index={index}
                        onOpen={(staffRow) => (
                          setSelectedStaffId(staffRow?._binderStaffId || null)
                        )}
                      />
                    ) : activeTab === 'photos' ? (
                      <PhotoEvidenceRow
                        key={item.id}
                        item={item}
                        index={index}
                        onOpen={(evidence) => (
                          setSelectedPhotoId(evidence?.id || null)
                        )}
                      />
                    ) : activeTab === 'walkaround' ? (
                      <WalkaroundLedgerRow
                        key={
                          item?.id ||
                          `${item?.note || 'walkaround'}-${index}`
                        }
                        item={item}
                        index={index}
                        onOpen={(entry) => (
                          setSelectedWalkaroundId(entry?.id || null)
                        )}
                      />
                    ) : activeTab === 'roadblocks' ? (
                      <RoadblockLedgerRow
                        key={
                          item?.id ||
                          `${item?.name || 'roadblock'}-${index}`
                        }
                        item={item}
                        index={index}
                        onOpen={onOpenRoadblock}
                      />
                    ) : activeTab === 'tasks' ||
                    activeTab === 'emails' ? (
                      <WorkItem
                        key={getItemKey(item)}
                        item={item}
                        tone={
                          urgentItemKeys.has(getItemKey(item))
                            ? 'urgent'
                            : 'standard'
                        }
                        context={
                          activeTab === 'emails'
                            ? 'communications'
                            : 'default'
                        }
                        onOpen={onOpenTask || onOpenTasks}
                        onComplete={onCompleteTask}
                        completionDisabled={taskCompletionPending}
                        referenceDate={selectedDate}
                      />
                    ) : activeTab === 'materials' ? (
                      <MaterialLedgerRow
                        key={
                          item?.id ||
                          `${item?.item || 'material'}-${index}`
                        }
                        row={item}
                        index={index}
                        onOpen={onOpenMaterial}
                      />
                    ) : activeTab === 'closeout' ? (
                      <button
                        key={item?.id || `closeout-${index}`}
                        type="button"
                        className="lld-binder-focused-record lld-binder-readiness-link"
                        onClick={() => handleTab(item.targetTab)}
                        aria-label={`Open ${item.title} in the Digital Job Binder`}
                        data-testid={`lld-binder-closeout-readiness-link-v8-9j6-1-${item.targetTab}`}
                      >
                        <span className="lld-binder-readiness-index">
                          {String(index + 1).padStart(2, '0')}
                        </span>

                        <div>
                          <strong>
                            {getFocusedItemTitle(item, index)}
                          </strong>

                          {getFocusedItemMeta(item) && (
                            <small>
                              {getFocusedItemMeta(item)}
                            </small>
                          )}
                        </div>

                        <span
                          className="lld-binder-readiness-arrow"
                          aria-hidden="true"
                        >
                          &rarr;
                        </span>
                      </button>
                    ) : (
                      <div
                        key={item?.id || `${activeTab}-${index}`}
                        className="lld-binder-focused-record"
                      >
                        <span>
                          {String(index + 1).padStart(2, '0')}
                        </span>

                        <div>
                          <strong>
                            {getFocusedItemTitle(item, index)}
                          </strong>

                          {getFocusedItemMeta(item) && (
                            <small>
                              {getFocusedItemMeta(item)}
                            </small>
                          )}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              ) : activeTab === 'materials' ? (
                <div
                  className="lld-binder-material-empty"
                  data-testid="lld-binder-material-empty-v8-9c1"
                >
                  <span className="lld-binder-material-empty-kicker">
                    Materials register
                  </span>

                  <strong>No materials recorded</strong>

                  <p>
                    Add materials when they are required, received,
                    used, short, damaged or removed.
                  </p>

                  <button
                    type="button"
                    onClick={openActiveWorkflow}
                  >
                    + Add first material
                  </button>
                </div>
              ) : (
                <div className="lld-binder-focused-empty">
                  <strong>{activeTabConfig.label}</strong>
                  <p>{focusedEmptyCopy[activeTab]}</p>

                  <button
                    type="button"
                    onClick={openActiveWorkflow}
                  >
                    {activeTab === 'photos' ? 'Add photo evidence' : `Open ${activeTabConfig.label}`}
                  </button>
                </div>
              )}
                </>
              )}
              </div>

              <footer
                className="lld-binder-page-footer"
                aria-label={`${focusedRegisterCopy.detailTitle}: ${focusedRegisterSummary}`}
              >
                <span>
                  {focusedHasDetail
                    ? `${focusedRegisterCopy.detailTitle} open`
                    : focusedRegisterCopy.selection}
                </span>
                <span className="lld-binder-page-signature">
                  Long Line Diary
                </span>
                <strong
                  aria-label={`Page ${getBinderPageNumber(activeTab, 1)}`}
                >
                  {getBinderPageNumber(activeTab, 1)}
                </strong>
              </footer>
            </article>
          </section>
        )}

        {diaryEditorOpen && (
          <BinderDiaryEditor
            projectName={projectName}
            selectedDateLabel={selectedDateLabel}
            draft={diaryDraft}
            draftStatus={draftStatus}
            categoryOptions={diaryCategoryOptions}
            priorityOptions={diaryPriorityOptions}
            sendToOptions={diarySendToOptions}
            saving={submitting}
            onChange={onDiaryDraftChange}
            onPhotoUpload={onDiaryPhotoUpload}
            onSubmit={onQuickSubmit}
            onClose={closeDiaryEditor}
          />
        )}
          </div>
        </div>

        <nav
          className="lld-binder-folder-tabs"
          aria-label="Digital job binder sections"
        >
          {BINDER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`lld-binder-folder-tab lld-binder-tab-${tab.color} ${
                activeTab === tab.id ? 'active' : ''
              }`}
              onClick={() => handleTab(tab.id)}
            >
              <strong>{tab.label}</strong>
              <span>{tab.description}</span>
            </button>
          ))}
        </nav>
      </div>

      <nav
        ref={mobileTabsRef}
        className="lld-binder-mobile-tabs"
        aria-label="Mobile digital job binder sections"
      >
        {BINDER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-binder-tab={tab.id}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => handleTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </section>
  );
};

export default DigitalJobBinder;
