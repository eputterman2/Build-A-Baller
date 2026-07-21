import { useEffect, useMemo, useState } from 'react';
import {
  EMPTY_BUILD_ACCESSORIES,
  type Accessory, type AccessoryType, type BuildAccessories, type CollectionBuild,
} from '@shared/index';
import { api } from '../api';
import { useAuth } from '../auth';
import { AuthModal } from './AuthModal';

const TYPE_LABELS: Record<AccessoryType, string> = {
  userIcon: 'User Icons',
  cardFrame: 'Card Frames',
  cardBanner: 'Card Banners',
};

const ACCESSORY_KEYS: Record<AccessoryType, keyof BuildAccessories> = {
  userIcon: 'userIconId',
  cardFrame: 'cardFrameId',
  cardBanner: 'cardBannerId',
};

export function Accessories() {
  const { user, loading: authLoading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [ownedAccessoryIds, setOwnedAccessoryIds] = useState<Set<string>>(new Set());
  const [builds, setBuilds] = useState<CollectionBuild[]>([]);
  const [selectedAccessory, setSelectedAccessory] = useState<Accessory | null>(null);
  const [selectedBuildId, setSelectedBuildId] = useState('');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    if (!user) return;
    setError(null);
    Promise.all([api.accessories(), api.collection()])
      .then(([accessoryData, collection]) => {
        setAccessories(accessoryData.accessories);
        setOwnedAccessoryIds(new Set(accessoryData.ownedAccessoryIds));
        setBuilds(collection);
      })
      .catch(err => setError((err as Error).message));
  };

  useEffect(load, [user]);

  const groupedAccessories = useMemo(() => {
    const groups: Record<AccessoryType, Accessory[]> = {
      userIcon: [],
      cardFrame: [],
      cardBanner: [],
    };
    for (const accessory of accessories) groups[accessory.type].push(accessory);
    return groups;
  }, [accessories]);

  const openAccessory = (accessory: Accessory) => {
    setSelectedAccessory(accessory);
    setSelectedBuildId(builds[0]?.id ?? '');
    setMessage(null);
    setError(null);
  };

  const applyAccessoryToBuild = async () => {
    if (!selectedAccessory || !selectedBuildId) return;
    const build = builds.find(item => item.id === selectedBuildId);
    if (!build) return;
    setApplying(true);
    setError(null);
    setMessage(null);
    try {
      const key = ACCESSORY_KEYS[selectedAccessory.type];
      const updated = await api.updateBuildAccessories(build.id, {
        ...EMPTY_BUILD_ACCESSORIES,
        ...build.accessories,
        [key]: selectedAccessory.id,
      });
      setBuilds(current => current.map(item => (
        item.id === build.id ? { ...item, accessories: updated } : item
      )));
      setMessage(`${selectedAccessory.name} equipped.`);
      setSelectedAccessory(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setApplying(false);
    }
  };

  const unequipAccessoryFromBuild = async () => {
    if (!selectedAccessory || !selectedBuildId) return;
    const build = builds.find(item => item.id === selectedBuildId);
    if (!build) return;
    setApplying(true);
    setError(null);
    setMessage(null);
    try {
      const key = ACCESSORY_KEYS[selectedAccessory.type];
      const updated = await api.updateBuildAccessories(build.id, {
        ...EMPTY_BUILD_ACCESSORIES,
        ...build.accessories,
        [key]: '',
      });
      setBuilds(current => current.map(item => (
        item.id === build.id ? { ...item, accessories: updated } : item
      )));
      setMessage(`${selectedAccessory.name} removed.`);
      setSelectedAccessory(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setApplying(false);
    }
  };

  const applyUserIconToUsername = async () => {
    if (!selectedAccessory || selectedAccessory.type !== 'userIcon') return;
    setApplying(true);
    setError(null);
    setMessage(null);
    try {
      const userIconId = await api.updateUsernameIcon(selectedAccessory.id);
      setBuilds(current => current.map(item => (
        { ...item, accessories: { ...EMPTY_BUILD_ACCESSORIES, ...item.accessories, userIconId } }
      )));
      setMessage(`${selectedAccessory.name} applied to your username.`);
      setSelectedAccessory(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setApplying(false);
    }
  };

  const removeUserIconFromUsername = async () => {
    if (!selectedAccessory || selectedAccessory.type !== 'userIcon') return;
    setApplying(true);
    setError(null);
    setMessage(null);
    try {
      const userIconId = await api.updateUsernameIcon('');
      setBuilds(current => current.map(item => (
        { ...item, accessories: { ...EMPTY_BUILD_ACCESSORIES, ...item.accessories, userIconId } }
      )));
      setMessage('Username icon removed.');
      setSelectedAccessory(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setApplying(false);
    }
  };

  if (authLoading) return <div className="notice">Loading accessories...</div>;

  if (!user) {
    return (
      <div className="collection-empty">
        <h2 className="results-title">Accessories</h2>
        <p>Log in to see and equip your card accessories.</p>
        <button className="btn btn-primary" onClick={() => setShowAuth(true)}>Log In</button>
        {showAuth && (
          <AuthModal
            onClose={() => setShowAuth(false)}
            intro="Log in to view your accessories."
          />
        )}
      </div>
    );
  }

  return (
    <div className="accessories-page">
      <div className="collection-subpage-head">
        <h2 className="results-title">Accessories</h2>
        <p>Tap an owned item to preview and equip it.</p>
      </div>

      {error && <div className="notice error">{error}</div>}
      {message && <div className="notice success">{message}</div>}

      <section className="accessory-library">
        {(Object.keys(TYPE_LABELS) as AccessoryType[]).map(type => (
          <div className="accessory-group" key={type}>
            <h3>{TYPE_LABELS[type]}</h3>
            <div className="accessory-grid">
              {groupedAccessories[type].map(accessory => {
                const owned = ownedAccessoryIds.has(accessory.id);
                return (
                  <button
                    className={`accessory-tile${owned ? '' : ' is-locked'}`}
                    key={accessory.id}
                    type="button"
                    onClick={() => openAccessory(accessory)}
                  >
                    <img src={accessory.src} alt="" />
                    <span>{accessory.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {selectedAccessory && (
        <div className="modal-backdrop" onClick={() => setSelectedAccessory(null)}>
          <div className="modal accessory-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedAccessory(null)} aria-label="Close">×</button>
            <div className={`accessory-modal-preview accessory-modal-preview-${selectedAccessory.type}`}>
              <img src={selectedAccessory.src} alt="" />
            </div>
            <h2>{selectedAccessory.name}</h2>
            {!ownedAccessoryIds.has(selectedAccessory.id) ? (
              <p className="modal-intro">Unlock this item in the market before equipping it.</p>
            ) : selectedAccessory.type === 'userIcon' ? (
              <>
                <p className="modal-intro">Apply this icon to your username on saved cards.</p>
                <button
                  className="btn btn-primary"
                  disabled={applying}
                  onClick={applyUserIconToUsername}
                >
                  {applying ? 'Applying...' : 'Apply to Username'}
                </button>
                <button
                  className="btn btn-ghost accessory-remove-btn"
                  disabled={applying}
                  onClick={removeUserIconFromUsername}
                >
                  Remove Username Icon
                </button>
              </>
            ) : builds.length === 0 ? (
              <p className="modal-intro">Save a card before equipping this item.</p>
            ) : (
              <>
                <label>
                  Choose Card
                  <select value={selectedBuildId} onChange={e => setSelectedBuildId(e.target.value)}>
                    {builds.map(build => (
                      <option key={build.id} value={build.id}>
                        {build.overall} OVR {build.identity?.playerName || build.gradeLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="btn btn-primary"
                  disabled={applying || !selectedBuildId}
                  onClick={applyAccessoryToBuild}
                >
                  {applying ? 'Applying...' : 'Apply to Card'}
                </button>
                <button
                  className="btn btn-ghost accessory-remove-btn"
                  disabled={applying || !selectedBuildId}
                  onClick={unequipAccessoryFromBuild}
                >
                  Remove from Card
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
