import { useEffect, useState } from 'react';
import {
  CUSTOM_DRAWING_BUILD_TYPES,
  customDrawingBuildHint,
  parseCustomDrawingBuildHint,
  type AdminDrawingPrizeCompletion,
  type AdminPlayerDrawingPoll,
} from '@shared/index';
import { api, type AdminAnalytics, type MarketDrawingRequest } from '../api';

const ADMIN_SECRET_KEY = 'baller_admin_secret';

type AdminConfirmation = 'publish' | 'dismiss' | 'delete' | null;

function formatDate(value?: string | null): string {
  if (!value) return 'Not yet';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export function AdminMarket() {
  const [secret, setSecret] = useState(() => localStorage.getItem(ADMIN_SECRET_KEY) || '');
  const [draftSecret, setDraftSecret] = useState(secret);
  const [drawings, setDrawings] = useState<MarketDrawingRequest[]>([]);
  const [prizeCompletions, setPrizeCompletions] = useState<AdminDrawingPrizeCompletion[]>([]);
  const [playerDrawingPoll, setPlayerDrawingPoll] = useState<AdminPlayerDrawingPoll | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [pollOptionNames, setPollOptionNames] = useState(['', '', '']);
  const [pollResetConfirmation, setPollResetConfirmation] = useState(false);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finalName, setFinalName] = useState('');
  const [minOverall, setMinOverall] = useState(0);
  const [maxOverall, setMaxOverall] = useState(99);
  const [buildTypeIds, setBuildTypeIds] = useState<string[]>(['any']);
  const [drawingDataUrl, setDrawingDataUrl] = useState('');
  const [confirmation, setConfirmation] = useState<AdminConfirmation>(null);

  const selectedDrawing = drawings.find(drawing => drawing.id === selectedDrawingId) ?? null;
  const isEditing = Boolean(selectedDrawing);
  const pollNamesChanged = Boolean(playerDrawingPoll)
    && pollOptionNames.some((name, index) => name.trim() !== playerDrawingPoll?.options[index]?.label);

  const refresh = async (activeSecret = secret) => {
    if (!activeSecret) return;
    setLoading(true);
    setError(null);
    try {
      const [publishedDrawings, completions] = await Promise.all([
        api.adminPublishedDrawings(activeSecret),
        api.adminDrawingPrizeCompletions(activeSecret),
      ]);
      const [poll, currentAnalytics] = await Promise.all([
        api.adminPlayerDrawingPoll(activeSecret),
        api.adminAnalytics(activeSecret),
      ]);
      setDrawings(publishedDrawings);
      setPrizeCompletions(completions);
      setPlayerDrawingPoll(poll);
      setAnalytics(currentAnalytics);
      setPollOptionNames(poll.options.map(option => option.label));
      setPollResetConfirmation(false);
      setSelectedDrawingId(current => current && publishedDrawings.some(drawing => drawing.id === current)
        ? current
        : null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secret]);

  const saveSecret = () => {
    const value = draftSecret.trim();
    setSecret(value);
    if (value) localStorage.setItem(ADMIN_SECRET_KEY, value);
    else localStorage.removeItem(ADMIN_SECRET_KEY);
  };

  const resetForm = () => {
    setSelectedDrawingId(null);
    setFinalName('');
    setMinOverall(0);
    setMaxOverall(99);
    setBuildTypeIds(['any']);
    setDrawingDataUrl('');
    setConfirmation(null);
    setMessage(null);
    setError(null);
  };

  const editDrawing = (drawing: MarketDrawingRequest) => {
    setSelectedDrawingId(drawing.id);
    setFinalName(drawing.finalName || drawing.subject);
    setMinOverall(drawing.minOverall ?? 0);
    setMaxOverall(drawing.maxOverall ?? 99);
    setBuildTypeIds(parseCustomDrawingBuildHint(drawing.buildHint));
    setDrawingDataUrl('');
    setConfirmation(null);
    setMessage(null);
    setError(null);
  };

  const chooseDrawing = async (file?: File) => {
    if (!file) return;
    setDrawingDataUrl(await fileToDataUrl(file));
    setConfirmation(null);
  };

  const toggleBuildType = (id: string) => {
    setBuildTypeIds(current => {
      if (id === 'any') return ['any'];
      const withoutAny = current.filter(typeId => typeId !== 'any');
      const next = withoutAny.includes(id)
        ? withoutAny.filter(typeId => typeId !== id)
        : [...withoutAny, id];
      return next.length ? next : ['any'];
    });
  };

  const updatePollOptionName = (index: number, value: string) => {
    setPollOptionNames(current => current.map((name, optionIndex) => optionIndex === index ? value : name));
    setPollResetConfirmation(false);
  };

  const savePollOptions = async (resetVotes = false) => {
    if (pollNamesChanged && !resetVotes) {
      setPollResetConfirmation(true);
      setMessage(null);
      setError(null);
      return;
    }
    setBusy(true);
    setPollResetConfirmation(false);
    setError(null);
    setMessage(null);
    try {
      const poll = await api.adminUpdatePlayerDrawingPoll(secret, pollOptionNames, resetVotes);
      setPlayerDrawingPoll(poll);
      setPollOptionNames(poll.options.map(option => option.label));
      setMessage(resetVotes ? 'Home page drawing vote reset.' : 'Home page drawing vote updated.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitDrawing = async () => {
    setBusy(true);
    setConfirmation(null);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        finalName,
        finalDrawingDataUrl: drawingDataUrl || undefined,
        minOverall,
        maxOverall,
        buildHint: customDrawingBuildHint(buildTypeIds),
      };
      const saved = selectedDrawing
        ? await api.adminUpdateDrawing(secret, selectedDrawing.id, payload)
        : await api.adminCreateDrawing(secret, payload);
      setDrawings(current => {
        const next = current.some(drawing => drawing.id === saved.id)
          ? current.map(drawing => drawing.id === saved.id ? saved : drawing)
          : [saved, ...current];
        return next;
      });
      setSelectedDrawingId(saved.id);
      setFinalName(saved.finalName || saved.subject);
      setMinOverall(saved.minOverall ?? 0);
      setMaxOverall(saved.maxOverall ?? 99);
      setBuildTypeIds(parseCustomDrawingBuildHint(saved.buildHint));
      setDrawingDataUrl('');
      setMessage(isEditing ? 'Drawing information saved.' : 'Drawing submitted to the game.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeDrawing = async () => {
    if (!selectedDrawing) return;
    setBusy(true);
    setConfirmation(null);
    setError(null);
    setMessage(null);
    try {
      await api.adminRemoveDrawing(secret, selectedDrawing.id);
      setDrawings(current => current.filter(drawing => drawing.id !== selectedDrawing.id));
      resetForm();
      setMessage('Drawing removed from the game.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmationTitle =
    confirmation === 'publish'
      ? (isEditing ? 'Publish Changes?' : 'Publish Drawing?')
      : confirmation === 'dismiss'
        ? 'Dismiss Changes?'
        : 'Delete Drawing?';

  const confirmationText =
    confirmation === 'publish'
      ? 'This drawing information will be saved and available in the game.'
      : confirmation === 'dismiss'
        ? 'Any unsaved changes here will be removed, and the form will return to a new drawing.'
        : 'This drawing will be removed from the game.';

  const confirmAction = () => {
    if (confirmation === 'publish') {
      void submitDrawing();
      return;
    }
    if (confirmation === 'dismiss') {
      resetForm();
      return;
    }
    if (confirmation === 'delete') {
      void removeDrawing();
    }
  };

  return (
    <div className="admin-market-page">
      <div className="collection-subpage-head">
        <h2 className="results-title">Admin Drawing Hub</h2>
        <p>Add new player drawings, publish completed art, and track prize follow-ups.</p>
      </div>

      <section className="admin-secret-panel">
        <label>
          Admin password
          <input
            value={draftSecret}
            onChange={event => setDraftSecret(event.target.value)}
            placeholder="Enter admin password"
            type="password"
          />
        </label>
        <button className="btn btn-primary" onClick={saveSecret} type="button">Open Hub</button>
      </section>

      {error && <div className="notice error">{error}</div>}
      {message && <div className="notice">{message}</div>}
      {loading && <div className="notice">Loading admin tools...</div>}

      {!loading && secret && (
        <div className="admin-hub-stack">
          {analytics && (
            <section className="admin-analytics-panel">
              <div className="admin-section-title">
                <div>
                  <span>Site Analytics</span>
                  <h3>Visitor Overview</h3>
                </div>
                <button className="btn btn-ghost" disabled={loading} onClick={() => void refresh()} type="button">
                  Refresh
                </button>
              </div>

              <div className="admin-analytics-grid" aria-label="Site visitor statistics">
                <div className="admin-analytics-stat">
                  <small>Returning users · day</small>
                  <b>{analytics.visitors.day.returning.toLocaleString()}</b>
                </div>
                <div className="admin-analytics-stat">
                  <small>Returning users · week</small>
                  <b>{analytics.visitors.week.returning.toLocaleString()}</b>
                </div>
                <div className="admin-analytics-stat">
                  <small>Returning users · month</small>
                  <b>{analytics.visitors.month.returning.toLocaleString()}</b>
                </div>
                <div className="admin-analytics-stat">
                  <small>Total visitors · day</small>
                  <b>{analytics.visitors.day.total.toLocaleString()}</b>
                </div>
                <div className="admin-analytics-stat">
                  <small>Total visitors · week</small>
                  <b>{analytics.visitors.week.total.toLocaleString()}</b>
                </div>
                <div className="admin-analytics-stat">
                  <small>Total visitors · month</small>
                  <b>{analytics.visitors.month.total.toLocaleString()}</b>
                </div>
              </div>

              <div className="admin-analytics-account-count">
                <span>Accounts created</span>
                <b>{analytics.totalAccounts.toLocaleString()}</b>
              </div>

              <div className="admin-analytics-issues">
                <div className="admin-analytics-issues-head">
                  <div>
                    <span>Technical Issues</span>
                    <h4>{analytics.issuesWindow}</h4>
                  </div>
                  <small>Grouped by message and page</small>
                </div>
                {analytics.issues.length === 0 ? (
                  <div className="admin-empty-card">No technical issues have been reported this week.</div>
                ) : (
                  <div className="admin-analytics-issue-list">
                    {analytics.issues.map(issue => (
                      <div className="admin-analytics-issue" key={`${issue.type}-${issue.path}-${issue.message}`}>
                        <span>
                          <b>{issue.message}</b>
                          <small>{issue.path} · {issue.type}</small>
                        </span>
                        <span>
                          <b>{issue.occurrences}×</b>
                          <small>last seen {formatDate(issue.lastSeenAt)}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="admin-prize-panel">
            <div className="admin-section-title">
              <div>
                <span>Prize Follow-Up</span>
                <h3>Get Drawn In Completions</h3>
              </div>
            </div>
            <p>
              Users listed here have collected every available player drawing. Use their email to reach out with next steps.
            </p>
            {prizeCompletions.length === 0 ? (
              <div className="admin-empty-card">No users have completed this prize yet.</div>
            ) : (
              <div className="admin-completion-list" aria-label="Completed drawing collection prize users">
                {prizeCompletions.map(completion => (
                  <div className="admin-completion-row" key={completion.userId}>
                    <span>
                      <b>@{completion.username}</b>
                      <small>{completion.email || 'No email on file'}</small>
                    </span>
                    <span>
                      <b>{completion.collectedDrawings}/{completion.availableDrawings}</b>
                      <small>completed {formatDate(completion.completedAt)}</small>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="admin-home-poll-panel">
            <div className="admin-section-title">
              <div>
                <span>Home Page Drawing Vote</span>
                <h3>Current Vote Names</h3>
              </div>
            </div>
            <div className="admin-current-poll-options" aria-label="Currently visible home page drawing vote names">
              {(playerDrawingPoll?.options ?? []).map((option, index) => (
                <div className="admin-current-poll-option" key={option.id}>
                  <span>#{index + 1}</span>
                  <b>{option.label}</b>
                  <small>{option.votes} vote{option.votes === 1 ? '' : 's'}</small>
                </div>
              ))}
            </div>
            <div className="admin-poll-edit-grid">
              {pollOptionNames.map((name, index) => (
                <label key={index}>
                  Option {index + 1}
                  <input value={name} onChange={event => updatePollOptionName(index, event.target.value)} />
                </label>
              ))}
            </div>
            <div className="admin-actions admin-submit-only-actions">
              <button className="btn btn-success" disabled={busy} onClick={() => void savePollOptions()} type="button">
                Save Vote Names
              </button>
            </div>

            {pollResetConfirmation && (
              <div className="admin-confirm-layer" role="presentation">
                <div
                  aria-labelledby="admin-poll-reset-title"
                  aria-modal="true"
                  className="modal admin-confirm-modal"
                  role="dialog"
                >
                  <h2 id="admin-poll-reset-title">Reset Poll?</h2>
                  <p className="modal-intro">
                    Changing these names will reset the home page drawing vote and remove all current votes.
                  </p>
                  <div className="admin-confirm-actions">
                    <button
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => setPollResetConfirmation(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-danger"
                      disabled={busy}
                      onClick={() => void savePollOptions(true)}
                      type="button"
                    >
                      Reset Poll
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="admin-drawing-submit-panel">
            <div className="admin-request-title">
              <div>
                <span>Player Drawing Submit</span>
                <h3>Player Drawing Submit</h3>
              </div>
            </div>

            <div className="admin-form-grid">
              <label>
                Drawing name
                <input value={finalName} onChange={event => setFinalName(event.target.value)} />
              </label>
              <label>
                Overall range
                <span className="admin-overall-range">
                  <input
                    aria-label="Minimum overall"
                    min={0}
                    max={99}
                    type="number"
                    value={minOverall}
                    onChange={event => setMinOverall(Number(event.target.value))}
                  />
                  <input
                    aria-label="Maximum overall"
                    min={0}
                    max={99}
                    type="number"
                    value={maxOverall}
                    onChange={event => setMaxOverall(Number(event.target.value))}
                  />
                </span>
              </label>
            </div>

            <div className="admin-wide-field">
              <span>Build types</span>
              <div className="admin-build-type-grid">
                {CUSTOM_DRAWING_BUILD_TYPES.map(type => (
                  <button
                    className={`admin-build-type-chip${buildTypeIds.includes(type.id) ? ' selected' : ''}`}
                    key={type.id}
                    onClick={() => toggleBuildType(type.id)}
                    type="button"
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="admin-upload-field">
              Finished transparent drawing
              <input
                accept="image/png,image/jpeg,image/webp"
                onChange={event => void chooseDrawing(event.target.files?.[0])}
                type="file"
              />
            </label>

            {(drawingDataUrl || selectedDrawing?.finalDrawingSrc) && (
              <div className="admin-drawing-preview">
                <img
                  src={drawingDataUrl || `${selectedDrawing!.finalDrawingSrc}?admin=${encodeURIComponent(selectedDrawing!.fulfilledAt || selectedDrawing!.id)}`}
                  alt="Finished drawing preview"
                />
              </div>
            )}

            <div className="admin-actions admin-drawing-actions">
              <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirmation('dismiss')} type="button">
                Dismiss
              </button>
              {isEditing && (
                <button className="btn btn-danger" disabled={busy} onClick={() => setConfirmation('delete')} type="button">
                  Delete Drawing
                </button>
              )}
              <button className="btn btn-success" disabled={busy} onClick={() => setConfirmation('publish')} type="button">
                Publish
              </button>
            </div>

            {confirmation && (
              <div className="admin-confirm-layer" role="presentation">
                <div
                  aria-labelledby="admin-confirm-title"
                  aria-modal="true"
                  className="modal admin-confirm-modal"
                  role="dialog"
                >
                  <h2 id="admin-confirm-title">{confirmationTitle}</h2>
                  <p className="modal-intro">{confirmationText}</p>
                  <div className="admin-confirm-actions">
                    <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirmation(null)} type="button">
                      Cancel
                    </button>
                    <button
                      className={`btn ${confirmation === 'delete' ? 'btn-danger' : confirmation === 'dismiss' ? 'btn-ghost' : 'btn-success'}`}
                      disabled={busy}
                      onClick={confirmAction}
                      type="button"
                    >
                      {confirmation === 'publish' ? 'Publish' : confirmation === 'dismiss' ? 'Dismiss' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="admin-submitted-drawings">
            <div className="admin-section-title">
              <div>
                <span>Live Drawings</span>
                <h3>Submitted Drawings</h3>
              </div>
              <button className="btn btn-ghost admin-new-drawing-button" onClick={resetForm} type="button">New Drawing</button>
            </div>
            {drawings.length === 0 ? (
              <div className="admin-empty-card">No player drawings have been submitted yet.</div>
            ) : (
              <div className="admin-drawing-bubble-grid">
                {drawings.map(drawing => (
                  <button
                    className={`admin-drawing-bubble${selectedDrawingId === drawing.id ? ' selected' : ''}`}
                    key={drawing.id}
                    onClick={() => editDrawing(drawing)}
                    type="button"
                  >
                    <span className="admin-drawing-bubble-art">
                      <img src={`${drawing.finalDrawingSrc}?admin=${encodeURIComponent(drawing.fulfilledAt || drawing.id)}`} alt="" />
                    </span>
                    <span>
                      <b>{drawing.finalName || drawing.subject}</b>
                      <small>{drawing.minOverall}-{drawing.maxOverall} overall · {drawing.buildHint || 'Any build'}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
