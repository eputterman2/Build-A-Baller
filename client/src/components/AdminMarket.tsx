import { useEffect, useMemo, useState } from 'react';
import { api, type MarketDrawingRequest } from '../api';

const ADMIN_SECRET_KEY = 'baller_admin_secret';

const statusOptions = [
  { value: 'paid', label: 'In review' },
  { value: 'in_review', label: 'In review' },
  { value: 'in_progress', label: 'Drawing in progress' },
  { value: 'rejected', label: 'Rejected' },
];

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

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
  const [requests, setRequests] = useState<MarketDrawingRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finalName, setFinalName] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [minOverall, setMinOverall] = useState(0);
  const [maxOverall, setMaxOverall] = useState(99);
  const [buildHint, setBuildHint] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [drawingDataUrl, setDrawingDataUrl] = useState('');

  const selected = useMemo(
    () => requests.find(request => request.id === selectedId) ?? requests[0] ?? null,
    [requests, selectedId],
  );

  const refresh = async (activeSecret = secret) => {
    if (!activeSecret) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminDrawingRequests(activeSecret);
      setRequests(data);
      setSelectedId(current => current && data.some(request => request.id === current)
        ? current
        : data[0]?.id ?? null);
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

  useEffect(() => {
    if (!selected) return;
    setFinalName(selected.finalName || selected.subject);
    setVisibility(selected.type === 'pro-player' ? 'public' : selected.visibility);
    setMinOverall(selected.minOverall ?? 0);
    setMaxOverall(selected.maxOverall ?? 99);
    setBuildHint(selected.buildHint || (selected.type === 'pro-player'
      ? 'Public custom player drawing'
      : 'Private photo custom drawing'));
    setAdminNote(selected.adminNote || '');
    setDrawingDataUrl('');
  }, [selected]);

  const saveSecret = () => {
    const value = draftSecret.trim();
    setSecret(value);
    if (value) localStorage.setItem(ADMIN_SECRET_KEY, value);
    else localStorage.removeItem(ADMIN_SECRET_KEY);
  };

  const updateRequest = (updated: MarketDrawingRequest) => {
    setRequests(current => current.map(request => request.id === updated.id ? updated : request));
    setSelectedId(updated.id);
  };

  const updateStatus = async (status: string) => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.adminUpdateDrawingRequestStatus(secret, selected.id, status, adminNote);
      updateRequest(updated);
      setMessage('Request status updated.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const chooseDrawing = async (file?: File) => {
    if (!file) return;
    setDrawingDataUrl(await fileToDataUrl(file));
  };

  const fulfill = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.adminFulfillDrawingRequest(secret, selected.id, {
        finalName,
        finalDrawingDataUrl: drawingDataUrl || '',
        visibility,
        minOverall,
        maxOverall,
        buildHint,
        adminNote,
      });
      updateRequest(updated);
      setMessage('Drawing is now live.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-market-page">
      <div className="collection-subpage-head">
        <h2 className="results-title">Market Admin</h2>
        <p>Review paid drawing requests and publish completed art.</p>
      </div>

      <section className="admin-secret-panel">
        <label>
          Admin code
          <input
            value={draftSecret}
            onChange={event => setDraftSecret(event.target.value)}
            placeholder="Enter ADMIN_SECRET"
            type="password"
          />
        </label>
        <button className="btn btn-primary" onClick={saveSecret} type="button">Open Queue</button>
      </section>

      {error && <div className="notice error">{error}</div>}
      {message && <div className="notice">{message}</div>}
      {loading && <div className="notice">Loading requests...</div>}

      {!loading && secret && (
        <div className="admin-market-layout">
          <section className="admin-request-list" aria-label="Drawing request queue">
            {requests.length === 0 ? (
              <div className="notice">No drawing requests yet.</div>
            ) : requests.map(request => (
              <button
                className={`admin-request-row${selected?.id === request.id ? ' selected' : ''}`}
                key={request.id}
                onClick={() => setSelectedId(request.id)}
                type="button"
              >
                <span>
                  <b>{request.subject}</b>
                  <small>@{request.username} · {request.type === 'pro-player' ? 'Pro player' : 'Photo'} · {dollars(request.priceCents)}</small>
                </span>
                <em>{request.statusLabel}</em>
              </button>
            ))}
          </section>

          {selected && (
            <section className="admin-request-detail">
              <div className="admin-request-title">
                <div>
                  <span>{selected.type === 'pro-player' ? 'Pro Player Request' : 'Photo Drawing Request'}</span>
                  <h3>{selected.subject}</h3>
                  <p>@{selected.username} · paid {formatDate(selected.paidAt)} · created {formatDate(selected.createdAt)}</p>
                </div>
                {selected.finalDrawingSrc && (
                  <img className="admin-final-thumb" src={selected.finalDrawingSrc} alt="" />
                )}
              </div>

              {selected.photoDataUrl && (
                <div className="admin-photo-preview">
                  <img src={selected.photoDataUrl} alt="Submitted request" />
                </div>
              )}

              <div className="admin-form-grid">
                <label>
                  Final drawing name
                  <input value={finalName} onChange={event => setFinalName(event.target.value)} />
                </label>
                <label>
                  Visibility
                  <select value={visibility} onChange={event => setVisibility(event.target.value as 'public' | 'private')}>
                    <option value="public">Public drawing</option>
                    <option value="private">Buyer only</option>
                  </select>
                </label>
                <label>
                  Min overall
                  <input
                    min={0}
                    max={99}
                    type="number"
                    value={minOverall}
                    onChange={event => setMinOverall(Number(event.target.value))}
                  />
                </label>
                <label>
                  Max overall
                  <input
                    min={0}
                    max={99}
                    type="number"
                    value={maxOverall}
                    onChange={event => setMaxOverall(Number(event.target.value))}
                  />
                </label>
              </div>

              <label className="admin-wide-field">
                Build hint
                <input value={buildHint} onChange={event => setBuildHint(event.target.value)} />
              </label>
              <label className="admin-wide-field">
                Admin note
                <textarea value={adminNote} onChange={event => setAdminNote(event.target.value)} rows={3} />
              </label>
              <label className="admin-upload-field">
                Finished transparent drawing
                <input
                  accept="image/png,image/jpeg,image/webp"
                  onChange={event => void chooseDrawing(event.target.files?.[0])}
                  type="file"
                />
              </label>

              {drawingDataUrl && (
                <div className="admin-drawing-preview">
                  <img src={drawingDataUrl} alt="Finished drawing preview" />
                </div>
              )}

              <div className="admin-actions">
                {statusOptions.map(option => (
                  <button
                    className="btn btn-ghost"
                    disabled={busy}
                    key={option.value}
                    onClick={() => void updateStatus(option.value)}
                    type="button"
                  >
                    Mark {option.label}
                  </button>
                ))}
                <button className="btn btn-primary" disabled={busy} onClick={() => void fulfill()} type="button">
                  Publish Drawing
                </button>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
