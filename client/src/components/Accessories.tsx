import { useEffect, useMemo, useState } from 'react';
import {
  EMPTY_BUILD_ACCESSORIES,
  resolveArchetypeCharacter,
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

function AccessoryArt({ accessory }: { accessory: Accessory }) {
  if (accessory.type === 'cardFrame') {
    return (
      <span className="frame-preview" aria-hidden="true">
        <span className={`frame-preview-card sports-card-front has-card-frame card-frame-${accessory.id}`} />
      </span>
    );
  }
  return <img src={accessory.src} alt="" />;
}

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
  const [equippedUserIconId, setEquippedUserIconId] = useState(user?.userIconId ?? '');

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

  useEffect(() => {
    setEquippedUserIconId(user?.userIconId ?? '');
  }, [user?.userIconId]);

  const groupedAccessories = useMemo(() => {
    const groups: Record<AccessoryType, Accessory[]> = {
      userIcon: [],
      cardFrame: [],
      cardBanner: [],
    };
    for (const accessory of accessories) groups[accessory.type].push(accessory);
    return groups;
  }, [accessories]);

  const buildAccessoryStatus = (build: CollectionBuild, accessory: Accessory) => {
    const key = ACCESSORY_KEYS[accessory.type];
    const inUse = build.accessories?.[key] === accessory.id;
    return {
      label: inUse ? 'In use' : 'Not used',
      className: inUse ? 'is-used' : 'is-unused',
    };
  };

  const openAccessory = (accessory: Accessory) => {
    setSelectedAccessory(accessory);
    setSelectedBuildId(builds[0]?.id ?? '');
    setError(null);
  };

  const applyAccessoryToBuild = async () => {
    if (!selectedAccessory || !selectedBuildId) return;
    const build = builds.find(item => item.id === selectedBuildId);
    if (!build) return;
    setApplying(true);
    setError(null);
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
    try {
      const userIconId = await api.updateUsernameIcon(selectedAccessory.id);
      setEquippedUserIconId(userIconId);
      setBuilds(current => current.map(item => (
        { ...item, accessories: { ...EMPTY_BUILD_ACCESSORIES, ...item.accessories, userIconId } }
      )));
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
    try {
      const userIconId = await api.updateUsernameIcon('');
      setEquippedUserIconId(userIconId);
      setBuilds(current => current.map(item => (
        { ...item, accessories: { ...EMPTY_BUILD_ACCESSORIES, ...item.accessories, userIconId } }
      )));
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

  const selectedUserIconStatus = selectedAccessory?.type === 'userIcon' && ownedAccessoryIds.has(selectedAccessory.id)
    ? {
      label: equippedUserIconId === selectedAccessory.id ? 'in use' : 'not used',
      className: equippedUserIconId === selectedAccessory.id ? 'is-used' : 'is-unused',
    }
    : null;

  return (
    <div className="accessories-page">
      <div className="collection-subpage-head">
        <h2 className="results-title">Accessories</h2>
        <p>Tap an owned item to preview and equip it.</p>
      </div>

      {error && <div className="notice error">{error}</div>}

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
                    <AccessoryArt accessory={accessory} />
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
              <AccessoryArt accessory={selectedAccessory} />
            </div>
            <div className="accessory-modal-title-row">
              <h2>{selectedAccessory.name}</h2>
              {selectedUserIconStatus && (
                <small className={`accessory-build-status accessory-modal-status ${selectedUserIconStatus.className}`}>
                  <i aria-hidden="true" />
                  {selectedUserIconStatus.label}
                </small>
              )}
            </div>
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
                <div className="drawing-picker compact accessory-build-picker">
                  <div className="drawing-picker-head">
                    <h3>Choose Card</h3>
                    <p>Pick which saved card should use this item.</p>
                  </div>
                  <div className="drawing-picker-grid">
                    {builds.map(build => {
                      const character = resolveArchetypeCharacter(build.result, build.picks, build.characterId);
                      const selected = build.id === selectedBuildId;
                      const status = buildAccessoryStatus(build, selectedAccessory);
                      return (
                        <button
                          className={`drawing-picker-option accessory-build-option${selected ? ' selected' : ''}`}
                          key={build.id}
                          onClick={() => setSelectedBuildId(build.id)}
                          type="button"
                        >
                          <img src={character.src} alt="" />
                          <span>
                            <b>{character.name}</b>
                            <small className={`accessory-build-status ${status.className}`}>
                              <i aria-hidden="true" />
                              {status.label}
                            </small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
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
