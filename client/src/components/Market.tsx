import { useEffect, useState } from 'react';
import {
  ACCESSORIES_BY_ID, ARCHETYPE_CHARACTER_RULES, accessoriesForBundle, type MarketBundle,
} from '@shared/index';
import { api } from '../api';
import { useAuth } from '../auth';
import { AuthModal } from './AuthModal';

const dollars = (cents: number) => `$${(cents / 100).toFixed(0)}`;
const marketItemOrder = { userIcon: 0, cardBanner: 1, cardFrame: 2 };
const BUNDLE_SUCCESS_MESSAGE = 'Thank you for your purchase! All Golden State Bundle items are now available in Accessories.';
const DRAWING_SUCCESS_MESSAGE = 'Thank you for your purchase! A placeholder is now in Drawings Collected and will automatically update when your drawing is available.';
type MarketPreviewItem = {
  id: string;
  name: string;
  src: string;
  type: 'userIcon' | 'cardBanner' | 'cardFrame' | 'drawing';
};

type DrawingRequestType = 'pro-player' | 'photo-player';
type MarketDisclaimer =
  | { type: 'bundle'; bundle: MarketBundle }
  | { type: DrawingRequestType };

function readImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read that photo.'));
    reader.readAsDataURL(file);
  });
}

export function Market() {
  const { user } = useAuth();
  const [bundles, setBundles] = useState<MarketBundle[]>([]);
  const [ownedBundleIds, setOwnedBundleIds] = useState<string[]>([]);
  const [showAuth, setShowAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<MarketPreviewItem | null>(null);
  const [proPlayerName, setProPlayerName] = useState('');
  const [photoSubject, setPhotoSubject] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [photoFileName, setPhotoFileName] = useState('');
  const [requestBusyId, setRequestBusyId] = useState<DrawingRequestType | null>(null);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<MarketDisclaimer | null>(null);

  useEffect(() => {
    const checkout = new URLSearchParams(window.location.search).get('checkout');
    if (checkout === 'bundle-success') {
      setMessage(BUNDLE_SUCCESS_MESSAGE);
    }
    if (checkout === 'drawing-success') {
      setRequestMessage(DRAWING_SUCCESS_MESSAGE);
    }
    if (checkout === 'success') {
      setMessage('Thank you for your purchase! Your market item will be available shortly.');
    }
    if (checkout === 'cancelled') {
      setError('Checkout was cancelled.');
    }
  }, []);

  const refresh = () => {
    setLoading(true);
    setError(null);
    api.marketBundles()
      .then(data => {
        setBundles(data.bundles);
        setOwnedBundleIds(data.ownedBundleIds);
      })
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, [user]);

  const openBundleDisclaimer = (bundle: MarketBundle) => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    setDisclaimer({ type: 'bundle', bundle });
  };

  const buy = async (bundle: MarketBundle) => {
    setBusyId(bundle.id);
    setMessage(null);
    setError(null);
    try {
      const result = await api.purchaseBundle(bundle.id);
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      setOwnedBundleIds(result.ownedBundleIds);
      setMessage(BUNDLE_SUCCESS_MESSAGE);
      setDisclaimer(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const choosePhoto = async (file?: File) => {
    setRequestError(null);
    setRequestMessage(null);
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setPhotoDataUrl('');
      setPhotoFileName('');
      setRequestError('Upload a PNG, JPG, or WEBP photo.');
      return;
    }
    if (file.size > 4_000_000) {
      setPhotoDataUrl('');
      setPhotoFileName('');
      setRequestError('Keep the photo under 4 MB.');
      return;
    }
    try {
      setPhotoDataUrl(await readImageDataUrl(file));
      setPhotoFileName(file.name);
    } catch (err) {
      setRequestError((err as Error).message);
    }
  };

  const openDrawingRequestDisclaimer = (type: DrawingRequestType) => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    const subject = (type === 'pro-player' ? proPlayerName : photoSubject).trim();
    if (subject.length < 2) {
      setRequestError(type === 'pro-player' ? 'Add the player name.' : 'Add who is in the photo.');
      return;
    }
    if (type === 'photo-player' && !photoDataUrl) {
      setRequestError('Upload the photo you want drawn.');
      return;
    }
    setRequestError(null);
    setRequestMessage(null);
    setDisclaimer({ type });
  };

  const submitDrawingRequest = async (type: DrawingRequestType) => {
    const subject = (type === 'pro-player' ? proPlayerName : photoSubject).trim();
    setRequestBusyId(type);
    setRequestMessage(null);
    setRequestError(null);
    try {
      const result = await api.submitDrawingRequest({
        type,
        subject,
        photoDataUrl: type === 'photo-player' ? photoDataUrl : undefined,
      });
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      setRequestMessage(DRAWING_SUCCESS_MESSAGE);
      if (type === 'pro-player') setProPlayerName('');
      else {
        setPhotoSubject('');
        setPhotoDataUrl('');
        setPhotoFileName('');
      }
      setDisclaimer(null);
    } catch (err) {
      setRequestError((err as Error).message);
    } finally {
      setRequestBusyId(null);
    }
  };

  if (loading) return <div className="notice">Loading market…</div>;
  if (error && bundles.length === 0) return <div className="notice error">Couldn’t load market: {error}</div>;

  return (
    <div className="market-page">
      <h2 className="results-title">Market</h2>
      <div className="market-grid">
        {bundles.map(bundle => {
          const owned = ownedBundleIds.includes(bundle.id);
          const bundleAccessories = accessoriesForBundle(bundle.id)
            .slice()
            .sort((a, b) => marketItemOrder[a.type] - marketItemOrder[b.type]);
          const drawing = ARCHETYPE_CHARACTER_RULES.find(rule => rule.id === bundle.drawingId);
          return (
            <section className="market-bundle" key={bundle.id}>
              <div className="market-bundle-art">
                <img src={bundle.previewSrc} alt="" />
              </div>
              <div className="market-bundle-info">
                <h3>{bundle.name}</h3>
                <p>{bundle.description}</p>
                <div className="market-bundle-items">
                  {bundleAccessories.map(accessory => (
                    <button
                      className="market-bundle-item"
                      key={accessory.id}
                      type="button"
                      onClick={() => setPreviewItem({
                        id: accessory.id,
                        name: ACCESSORIES_BY_ID[accessory.id]?.name ?? accessory.name,
                        src: accessory.src,
                        type: accessory.type,
                      })}
                    >
                      <img src={accessory.src} alt="" />
                      <small>{ACCESSORIES_BY_ID[accessory.id]?.name ?? accessory.name}</small>
                    </button>
                  ))}
                  {drawing && (
                    <button
                      className="market-bundle-item"
                      key={drawing.id}
                      type="button"
                      onClick={() => setPreviewItem({
                        id: drawing.id,
                        name: `${drawing.name} Drawing`,
                        src: drawing.src,
                        type: 'drawing',
                      })}
                    >
                      <img src={drawing.src} alt="" />
                      <small>{drawing.name} Drawing</small>
                    </button>
                  )}
                </div>
                {error && <div className="form-error">{error}</div>}
                {message && <div className="form-success">{message}</div>}
                <button
                  className="btn btn-primary"
                  onClick={() => openBundleDisclaimer(bundle)}
                  disabled={owned || busyId === bundle.id}
                >
                  {owned ? 'Owned' : busyId === bundle.id ? 'Unlocking…' : `${dollars(bundle.priceCents)} Bundle`}
                </button>
              </div>
            </section>
          );
        })}
      </div>
      <section className="market-request-section" aria-label="Custom drawing requests">
        <div className="market-request-card market-request-card-pro">
          <div className="market-request-header">
            <span className="market-request-kicker">Custom Drawing</span>
            <strong>$5</strong>
          </div>
          <h3>Pro Player Request</h3>
          <p>Submit any professional basketball player to be drawn into the game.</p>
          <label>
            <span>Player name</span>
            <input
              value={proPlayerName}
              maxLength={80}
              onChange={event => setProPlayerName(event.target.value)}
              placeholder="A'ja Wilson"
            />
          </label>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => openDrawingRequestDisclaimer('pro-player')}
            disabled={requestBusyId === 'pro-player'}
          >
            {requestBusyId === 'pro-player' ? 'Submitting...' : '$5 Submit'}
          </button>
          <div className="pro-player-request-art" aria-hidden="true">
            <img src="/market/pro-player/request-drawing.png" alt="" />
          </div>
        </div>
        <div className="market-request-card market-request-card-photo">
          <div className="market-request-header">
            <span className="market-request-kicker">Custom Drawing</span>
            <strong>$10</strong>
          </div>
          <h3>Photo Drawing Request</h3>
          <p>Submit a photo of yourself or a friend to be drawn into the game.</p>
          <div className="photo-request-example" aria-label="Photo drawing example">
            <figure>
              <img src="/market/photo-request/example-photo.jpg" alt="Example real photo" />
            </figure>
            <div className="photo-request-arrow" aria-hidden="true" />
            <figure>
              <img src="/market/photo-request/example-drawing-trimmed.png" alt="Example finished drawing" />
            </figure>
          </div>
          <label>
            <span>Name</span>
            <input
              value={photoSubject}
              maxLength={80}
              onChange={event => setPhotoSubject(event.target.value)}
              placeholder="My friend Jordan"
            />
          </label>
          <label className="market-file-picker">
            <span>Photo</span>
            <span className="market-file-control">
              <span className="market-file-button">Choose photo</span>
              <span className="market-file-name">{photoFileName || 'No photo selected'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={event => choosePhoto(event.target.files?.[0])}
              />
            </span>
          </label>
          {photoDataUrl && (
            <div className="market-photo-preview">
              <img src={photoDataUrl} alt="" />
              <small>{photoFileName}</small>
            </div>
          )}
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => openDrawingRequestDisclaimer('photo-player')}
            disabled={requestBusyId === 'photo-player'}
          >
            {requestBusyId === 'photo-player' ? 'Submitting...' : '$10 Submit'}
          </button>
        </div>
      </section>
      {(requestError || requestMessage) && (
        <div className="market-request-status">
          {requestError && <div className="form-error">{requestError}</div>}
          {requestMessage && <div className="form-success">{requestMessage}</div>}
        </div>
      )}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          intro="Log in to use the market."
        />
      )}
      {previewItem && (
        <div className="modal-backdrop" onClick={() => setPreviewItem(null)} role="presentation">
          <div className="modal market-preview-modal" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="market-preview-title">
            <button className="modal-close" onClick={() => setPreviewItem(null)} aria-label="Close">×</button>
            <div className={`market-preview-art market-preview-art-${previewItem.type}`}>
              <img src={previewItem.src} alt="" />
            </div>
            <h2 id="market-preview-title">{previewItem.name}</h2>
          </div>
        </div>
      )}
      {disclaimer && (
        <div className="modal-backdrop" onClick={() => setDisclaimer(null)} role="presentation">
          <div className="modal market-disclaimer-modal" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="market-disclaimer-title">
            <button className="modal-close" onClick={() => setDisclaimer(null)} aria-label="Close">×</button>
            {disclaimer.type === 'bundle' ? (
              <>
                <h2 id="market-disclaimer-title">Golden State Bundle</h2>
                <p className="modal-intro">
                  After purchase, these items will be available in your Accessories page. You can equip username icons, card frames, and banners on saved cards, and apply Bay Sniper to any build.
                </p>
                <div className="market-disclaimer-note market-disclaimer-note-compact">
                  <span>No refunds</span>
                </div>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={busyId === disclaimer.bundle.id}
                  onClick={() => buy(disclaimer.bundle)}
                >
                  {busyId === disclaimer.bundle.id ? 'Unlocking...' : `Confirm ${dollars(disclaimer.bundle.priceCents)}`}
                </button>
              </>
            ) : (
              <>
                <h2 id="market-disclaimer-title">
                  {disclaimer.type === 'pro-player' ? 'Pro Player Request' : 'Photo Drawing Request'}
                </h2>
                {disclaimer.type === 'pro-player' ? (
                  <div className="market-disclaimer-copy">
                    <p>Your request will be reviewed and added to the game in 1-2 days.</p>
                    <p>Once added, this player drawing will be part of the public game pool and can be received by any user.</p>
                  </div>
                ) : (
                  <div className="market-disclaimer-copy">
                    <p>Your request will be reviewed and added to the game in 1-2 days.</p>
                    <p>This drawing will only be available in the buyer&apos;s collection, but users can publicly display the drawing on their saved cards.</p>
                  </div>
                )}
                <div className="market-disclaimer-note">
                  <span>No refunds</span>. Inappropriate names or photos will not be accepted.
                </div>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={requestBusyId === disclaimer.type}
                  onClick={() => submitDrawingRequest(disclaimer.type)}
                >
                  {requestBusyId === disclaimer.type
                    ? 'Submitting...'
                    : `Confirm ${disclaimer.type === 'pro-player' ? '$5' : '$10'}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
