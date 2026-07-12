import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Mail,
  Package,
  Plus,
  Route,
  Users,
} from 'lucide-react';
import './DigitalJobBinder.css';

const BINDER_TABS = [
  { id: 'today', label: 'Today', description: 'Diary + My Day', color: 'coral' },
  { id: 'diary', label: 'Diary', description: 'Daily records', color: 'orange' },
  { id: 'tasks', label: 'Tasks', description: 'Actions & checks', color: 'yellow' },
  { id: 'materials', label: 'Materials', description: 'Needed & ordered', color: 'green' },
  { id: 'emails', label: 'Emails / Calls', description: 'Communications', color: 'teal' },
  { id: 'roadblocks', label: 'Roadblocks', description: 'Issues & impact', color: 'blue' },
  { id: 'walkaround', label: 'Walkaround', description: 'Site capture', color: 'indigo' },
  { id: 'photos', label: 'Photos', description: 'Evidence', color: 'purple' },
  { id: 'staff', label: 'Staff', description: 'Labour', color: 'pink' },
  { id: 'closeout', label: 'Closeout', description: 'Finish the day', color: 'slate' },
];

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

const getItemMeta = (item = {}) => {
  const parts = [
    item.priority,
    item.owner,
    item.due_date ? `Due ${String(item.due_date).slice(0, 10)}` : '',
    item.status,
  ].filter(Boolean);

  return parts.join(' · ');
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
  <div className="lld-binder-spine" aria-hidden="true">
    {[8, 24, 40, 60, 76, 92].map((top) => (
      <span
        key={top}
        className="lld-binder-ring-row"
        style={{ top: `${top}%` }}
      >
        <span className="lld-binder-page-hole lld-binder-page-hole-left" />
        <span className="lld-binder-metal-ring" />
        <span className="lld-binder-page-hole lld-binder-page-hole-right" />
      </span>
    ))}
  </div>
);

const StatusChip = ({ children, tone = 'neutral' }) => (
  <span className={`lld-binder-chip lld-binder-chip-${tone}`}>
    {children}
  </span>
);

const DiaryEntry = ({ entry }) => {
  const priority = safeText(entry?.priority).toLowerCase();
  const entryType = safeText(entry?.entry_type || entry?.action_type || 'Diary');
  const title = safeText(
    entry?.display_note ||
    entry?.raw_note ||
    entry?.note ||
    entry?.title,
    'Diary entry'
  );

  return (
    <article className="lld-binder-diary-entry">
      <time className="lld-binder-entry-time">{getEntryTime(entry)}</time>

      <div className="lld-binder-entry-copy">
        <strong>{title}</strong>

        {(entry?.owner || entry?.linked_task?.name) && (
          <p>
            {[entry?.owner ? `Owner: ${entry.owner}` : '', entry?.linked_task?.name]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        <div className="lld-binder-chip-row">
          {priority && (
            <StatusChip tone={priority === 'critical' || priority === 'high' ? 'danger' : 'warning'}>
              {priority}
            </StatusChip>
          )}

          <StatusChip tone="teal">{entryType}</StatusChip>

          {entry?.has_photos && (
            <StatusChip tone="blue">Evidence</StatusChip>
          )}
        </div>
      </div>
    </article>
  );
};

const WorkItem = ({ item, tone = 'standard', onOpen }) => (
  <article className={`lld-binder-work-item lld-binder-work-item-${tone}`}>
    <span className="lld-binder-checkbox" aria-hidden="true" />

    <div className="lld-binder-work-copy">
      <strong>{getItemTitle(item)}</strong>
      <p>{getItemMeta(item) || 'Open follow-up'}</p>

      <div className="lld-binder-chip-row">
        {item?.priority && (
          <StatusChip tone={
            String(item.priority).toLowerCase() === 'critical' ||
            String(item.priority).toLowerCase() === 'high'
              ? 'danger'
              : 'warning'
          }>
            {item.priority}
          </StatusChip>
        )}

        {item?.status && (
          <StatusChip tone="blue">{item.status}</StatusChip>
        )}
      </div>
    </div>

    <button
      type="button"
      className="lld-binder-mini-button"
      onClick={onOpen}
    >
      Open
    </button>
  </article>
);

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
  quickNote = '',
  submitting = false,
  onQuickNoteChange,
  onQuickSubmit,
  onChangeDate,
  onOpenDiary,
  onOpenTasks,
  onOpenMaterials,
  onOpenEmails,
  onOpenRoadblocks,
  onOpenWalkaround,
  onOpenPhotos,
  onOpenStaff,
  onCloseDay,
}) => {
  const [activeTab, setActiveTab] = useState('today');

  const projectName = currentProject
    ? `${currentProject.job_number ? `${currentProject.job_number} — ` : ''}${currentProject.name}`
    : 'No project selected';

  const entries = useMemo(
    () => (Array.isArray(diaryEntries) ? diaryEntries.slice(0, 6) : []),
    [diaryEntries]
  );

  const urgent = useMemo(
    () => (Array.isArray(urgentItems) ? urgentItems.slice(0, 3) : []),
    [urgentItems]
  );

  const tasks = useMemo(
    () => (Array.isArray(taskItems) ? taskItems.slice(0, 3) : []),
    [taskItems]
  );

  const materialRows = Array.isArray(materials) ? materials : [];

  const handleTab = (tabId) => {
    setActiveTab(tabId);

    const actions = {
      today: null,
      diary: onOpenDiary,
      tasks: onOpenTasks,
      materials: onOpenMaterials,
      emails: onOpenEmails,
      roadblocks: onOpenRoadblocks,
      walkaround: onOpenWalkaround,
      photos: onOpenPhotos,
      staff: onOpenStaff,
      closeout: onCloseDay,
    };

    const action = actions[tabId];

    if (typeof action === 'function') {
      action();
    }
  };

  return (
    <section
      className="lld-digital-job-binder"
      data-testid="lld-digital-job-binder-v1"
      data-commercial-readiness="lld-digital-job-binder-v1"
    >
      <header className="lld-binder-capture-panel">
        <div className="lld-binder-capture-heading">
          <div>
            <p>Digital Job Binder</p>
            <h2>Write it down</h2>
            <span>
              LLD timestamps the entry and keeps important work visible.
            </span>
          </div>

          <div className="lld-binder-date-controls">
            <button
              type="button"
              onClick={() => onChangeDate?.(-1)}
              aria-label="Previous diary day"
            >
              <ChevronLeft />
            </button>

            <strong>{selectedDateLabel}</strong>

            <button
              type="button"
              onClick={() => onChangeDate?.(1)}
              aria-label="Next diary day"
            >
              <ChevronRight />
            </button>
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
              rows={2}
              data-testid="lld-binder-quick-note-v1"
            />

            <button
              type="submit"
              disabled={submitting || !safeText(quickNote)}
              data-testid="lld-binder-quick-save-v1"
            >
              <Plus />
              {submitting ? 'Saving...' : 'Add to diary'}
            </button>
          </form>
        ) : (
          <div className="lld-binder-history-message">
            Historical diary view — use Today to add a new entry.
          </div>
        )}

        <div className="lld-binder-project-strip">
          <span>
            <BookOpen />
            {projectName}
          </span>

          <span>
            {selectedDate === today ? 'Today' : selectedDateLabel}
            {draftStatus ? ` · ${draftStatus}` : ''}
          </span>
        </div>
      </header>

      <div className="lld-binder-stage">
        <div className="lld-binder-cover">
          <div className="lld-binder-pages">
            <BinderRings />

            <section className="lld-binder-page lld-binder-page-left">
              <div className="lld-binder-page-heading">
                <div>
                  <p>Site diary</p>
                  <h3>{selectedDateLabel}</h3>
                  <span>{projectName}</span>
                </div>

                <BookOpen />
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

              <button
                type="button"
                className="lld-binder-page-action"
                onClick={onOpenDiary}
              >
                <FileText />
                Open full diary record
              </button>
            </section>

            <section className="lld-binder-page lld-binder-page-right">
              <div className="lld-binder-page-heading">
                <div>
                  <p>Working day</p>
                  <h3>My Day</h3>
                  <span>Important items remain visible until dealt with.</span>
                </div>

                <ClipboardCheck />
              </div>

              <div className="lld-binder-attention-box">
                <div className="lld-binder-section-title">
                  <span>
                    <AlertTriangle />
                    Needs attention now
                  </span>

                  <strong>{urgent.length}</strong>
                </div>

                {urgent.length > 0 ? (
                  urgent.map((item, index) => (
                    <WorkItem
                      key={item?.id || index}
                      item={item}
                      tone="urgent"
                      onOpen={onOpenTasks}
                    />
                  ))
                ) : (
                  <div className="lld-binder-empty lld-binder-empty-compact">
                    No urgent or overdue items.
                  </div>
                )}
              </div>

              <div className="lld-binder-tasks-box">
                <div className="lld-binder-section-title">
                  <span>
                    <CheckCircle2 />
                    Tasks and checks
                  </span>

                  <strong>{tasks.length}</strong>
                </div>

                {tasks.length > 0 ? (
                  tasks.map((item, index) => (
                    <WorkItem
                      key={item?.id || index}
                      item={item}
                      onOpen={onOpenTasks}
                    />
                  ))
                ) : (
                  <div className="lld-binder-empty lld-binder-empty-compact">
                    No open carry-forward tasks.
                  </div>
                )}
              </div>

              <div className="lld-binder-summary-grid">
                <button type="button" onClick={onOpenMaterials}>
                  <Package />
                  <strong>{materialRows.length}</strong>
                  <span>Materials</span>
                </button>

                <button type="button" onClick={onOpenStaff}>
                  <Users />
                  <strong>{labourCount}</strong>
                  <span>Staff</span>
                </button>

                <button type="button" onClick={onOpenPhotos}>
                  <Camera />
                  <strong>{entries.filter((entry) => entry?.has_photos).length}</strong>
                  <span>Evidence</span>
                </button>
              </div>
            </section>
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
        className="lld-binder-mobile-tabs"
        aria-label="Mobile digital job binder sections"
      >
        {BINDER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
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