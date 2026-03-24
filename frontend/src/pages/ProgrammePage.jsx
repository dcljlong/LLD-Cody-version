import React, { useEffect, useMemo, useState } from 'react';
import { projectsApi, programmesApi } from '../lib/api';

const OWNER_OPTIONS = ['UNASSIGNED', 'OURS', 'MC', 'SUBBIES', 'COUNCIL', 'WATCH'];

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #334155',
  borderRadius: 6,
  background: '#0f172a',
  color: '#e2e8f0'
};

const cardStyle = {
  border: '1px solid #334155',
  borderRadius: 10,
  padding: 14,
  background: '#0f172a'
};

const mutedText = {
  color: '#94a3b8'
};

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

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingProgrammes, setLoadingProgrammes] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoadingProjects(true);
        setError('');
        const res = await projectsApi.getAll();
        const items = normaliseItems(res);
        setProjects(items);
        if (items.length > 0) {
          setSelectedProjectId(items[0].id);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load projects');
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
        setError('');
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
        setError('Failed to load programmes');
        setProgrammes([]);
        setSelectedProgrammeId('');
        setTasks([]);
        setDrafts({});
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
        setError('');
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
        setError('Failed to load programme tasks');
        setTasks([]);
        setDrafts({});
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
    return {
      total: tasks.length,
      tracked: trackedCount,
      tagged: ownedCount
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
      setError('Select a project first');
      return;
    }

    if (!file) {
      setError('Choose a PDF first');
      return;
    }

    try {
      setUploading(true);
      setError('');
      setMessage('');

      const pdfBase64 = await toBase64(file);

      const payload = {
        project_id: selectedProjectId,
        pdf_base64: pdfBase64,
        filename: file.name
      };

      const res = await programmesApi.upload(payload);
      const uploadedProgramme = res.data?.programme;
      const uploadedTasks = res.data?.tasks || [];

      setMessage(res.data?.message || 'Programme uploaded');
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
      setError(err?.response?.data?.detail || 'Programme upload failed');
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
      setError('');
      setMessage('');

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

      setMessage(`Saved: ${task.task_name}`);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || 'Failed to save programme row');
    } finally {
      setSavingTaskId('');
    }
  };

  return (
    <div style={{ padding: 20, display: 'grid', gap: 16 }}>
      <div>
        <h2 style={{ margin: 0 }}>Programme</h2>
        <p style={{ marginTop: 8, ...mutedText }}>
          Upload a programme PDF, review parsed tasks, edit dates, assign owner tags, and confirm tracked rows.
        </p>
      </div>

      {loadingProjects ? (
        <div>Loading projects...</div>
      ) : (
        <div style={{ display: 'grid', gap: 12, maxWidth: 860 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6 }}>Project</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name || project.job_name || 'Untitled Project'}
                  </option>
                ))}
              </select>
            </div>

            <div style={cardStyle}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Upload Programme PDF</div>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />

              {file && (
                <div style={{ marginTop: 8, fontSize: 13, ...mutedText }}>
                  Selected: <b style={{ color: '#e2e8f0' }}>{file.name}</b>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={uploading || !selectedProjectId || !file}
                style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  borderRadius: 6,
                  border: '1px solid #475569',
                  background: uploading || !selectedProjectId || !file ? '#1e293b' : '#2563eb',
                  color: '#fff',
                  cursor: uploading || !selectedProjectId || !file ? 'not-allowed' : 'pointer'
                }}
              >
                {uploading ? 'Uploading / Parsing...' : 'Upload and Parse'}
              </button>
            </div>
          </div>

          {selectedProject && (
            <div style={{ fontSize: 14, ...mutedText }}>
              Current project: <b style={{ color: '#e2e8f0' }}>{selectedProject.name || selectedProject.job_name}</b>
            </div>
          )}

          {message && (
            <div style={{ padding: 10, border: '1px solid #166534', background: '#052e16', borderRadius: 8, color: '#dcfce7' }}>
              {message}
            </div>
          )}

          {error && (
            <div style={{ padding: 10, border: '1px solid #991b1b', background: '#450a0a', borderRadius: 8, color: '#fecaca' }}>
              {error}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 16 }}>
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Programmes</h3>

          {loadingProgrammes ? (
            <div>Loading programmes...</div>
          ) : programmes.length === 0 ? (
            <div style={mutedText}>No programmes uploaded for this project.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {programmes.map((programme) => (
                <button
                  key={programme.id}
                  onClick={() => setSelectedProgrammeId(programme.id)}
                  style={{
                    textAlign: 'left',
                    padding: 10,
                    border: programme.id === selectedProgrammeId ? '1px solid #60a5fa' : '1px solid #334155',
                    borderRadius: 8,
                    background: programme.id === selectedProgrammeId ? '#172554' : '#111827',
                    color: '#e5e7eb',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{programme.filename}</div>
                  <div style={{ fontSize: 12, marginTop: 4, ...mutedText }}>
                    Tasks: {programme.task_count ?? 0}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>Programme Review Table</h3>
              <div style={{ marginTop: 6, fontSize: 13, ...mutedText }}>
                {selectedProgramme ? selectedProgramme.filename : 'No programme selected'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ padding: '6px 10px', border: '1px solid #334155', borderRadius: 999, fontSize: 12, color: '#e2e8f0' }}>
                Total: {taskSummary.total}
              </div>
              <div style={{ padding: '6px 10px', border: '1px solid #334155', borderRadius: 999, fontSize: 12, color: '#e2e8f0' }}>
                Tagged: {taskSummary.tagged}
              </div>
              <div style={{ padding: '6px 10px', border: '1px solid #334155', borderRadius: 999, fontSize: 12, color: '#e2e8f0' }}>
                Tracked: {taskSummary.tracked}
              </div>
            </div>
          </div>

          {loadingTasks ? (
            <div>Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div style={mutedText}>No parsed tasks loaded.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155' }}>
                    <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 12, color: '#94a3b8' }}>Task</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 12, color: '#94a3b8' }}>Dependencies</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 12, color: '#94a3b8' }}>Start</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 12, color: '#94a3b8' }}>End</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 12, color: '#94a3b8' }}>Days</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 12, color: '#94a3b8' }}>Owner</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 12, color: '#94a3b8' }}>Tracked</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 12, color: '#94a3b8' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => {
                    const draft = drafts[task.id] || {
                      owner_tag: task.owner_tag || 'UNASSIGNED',
                      is_tracked: !!task.is_tracked,
                      programme_start_date: formatDateCell(task.programme_start_date),
                      end_date: formatDateCell(task.end_date),
                      duration_days:
                        task.duration_days === null || task.duration_days === undefined ? '' : String(task.duration_days)
                    };
                    const dirty = isRowDirty(task);
                    const saving = savingTaskId === task.id;

                    return (
                      <tr key={task.id} style={{ borderBottom: '1px solid #1e293b', background: dirty ? '#0b2447' : 'transparent' }}>
                        <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 700, color: '#e2e8f0' }}>{task.task_name}</div>
                          <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
                            Source ID: {task.source_task_id || task.id}
                          </div>
                        </td>

                        <td style={{ padding: '10px 8px', verticalAlign: 'top', fontSize: 13, color: '#cbd5e1', maxWidth: 260 }}>
                          {Array.isArray(task.dependencies) && task.dependencies.length > 0 ? task.dependencies.join(', ') : '-'}
                        </td>

                        <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                          <input
                            type="date"
                            value={draft.programme_start_date || ''}
                            disabled={saving}
                            onChange={(e) => updateDraft(task.id, 'programme_start_date', e.target.value)}
                            style={inputStyle}
                          />
                        </td>

                        <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                          <input
                            type="date"
                            value={draft.end_date || ''}
                            disabled={saving}
                            onChange={(e) => updateDraft(task.id, 'end_date', e.target.value)}
                            style={inputStyle}
                          />
                        </td>

                        <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft.duration_days}
                            disabled={saving}
                            onChange={(e) => updateDraft(task.id, 'duration_days', e.target.value)}
                            style={inputStyle}
                          />
                        </td>

                        <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                          <select
                            value={draft.owner_tag || 'UNASSIGNED'}
                            disabled={saving}
                            onChange={(e) => updateDraft(task.id, 'owner_tag', e.target.value)}
                            style={inputStyle}
                          >
                            {OWNER_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 38, color: '#cbd5e1' }}>
                            <input
                              type="checkbox"
                              checked={!!draft.is_tracked}
                              disabled={saving}
                              onChange={(e) => updateDraft(task.id, 'is_tracked', e.target.checked)}
                            />
                            {draft.is_tracked ? 'Yes' : 'No'}
                          </label>
                        </td>

                        <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                          <button
                            onClick={() => handleSaveRow(task)}
                            disabled={!dirty || saving}
                            style={{
                              padding: '9px 12px',
                              borderRadius: 6,
                              border: '1px solid #475569',
                              background: !dirty || saving ? '#1e293b' : '#2563eb',
                              color: '#fff',
                              cursor: !dirty || saving ? 'not-allowed' : 'pointer',
                              minWidth: 88
                            }}
                          >
                            {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
