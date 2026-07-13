import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ACCESSORIES_BY_ID, COMMON_COUNTRIES, EMPTY_BUILD_ACCESSORIES, EMPTY_PLAYER_IDENTITY, normalizePlayerIdentity,
  type Accessory, type AccessoryType, type BuildAccessories, type PlayerIdentity,
} from '@shared/index';
import { api } from '../api';

interface SaveIdentityModalProps {
  onClose: () => void;
  onSave: (identity: PlayerIdentity, accessories?: BuildAccessories) => Promise<void>;
  saving: boolean;
  initialIdentity?: PlayerIdentity;
  initialAccessories?: BuildAccessories;
  title?: string;
  intro?: string;
  submitLabel?: string;
  showSkip?: boolean;
  showAccessories?: boolean;
  extraContent?: ReactNode;
}

export function SaveIdentityModal({
  onClose,
  onSave,
  saving,
  initialIdentity = EMPTY_PLAYER_IDENTITY,
  initialAccessories = EMPTY_BUILD_ACCESSORIES,
  title = 'Baller Identity',
  intro = 'Add optional card details before saving to the leaderboard.',
  submitLabel = 'Save Card',
  showSkip = true,
  showAccessories = false,
  extraContent,
}: SaveIdentityModalProps) {
  const [identity, setIdentity] = useState<PlayerIdentity>(() => ({ ...EMPTY_PLAYER_IDENTITY, ...initialIdentity }));
  const [accessories, setAccessories] = useState<BuildAccessories>(() => ({ ...EMPTY_BUILD_ACCESSORIES, ...initialAccessories }));
  const [ownedAccessories, setOwnedAccessories] = useState<Accessory[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showAccessories) return;
    api.accessories()
      .then(data => {
        const owned = new Set(data.ownedAccessoryIds);
        setOwnedAccessories(data.accessories.filter(accessory => owned.has(accessory.id)));
      })
      .catch(() => setOwnedAccessories([]));
  }, [showAccessories]);

  const groupedAccessories = useMemo(() => {
    const grouped: Record<AccessoryType, Accessory[]> = {
      userIcon: [],
      cardFrame: [],
      cardBanner: [],
    };
    for (const accessory of ownedAccessories) grouped[accessory.type].push(accessory);
    return grouped;
  }, [ownedAccessories]);

  const update = (key: keyof PlayerIdentity, value: string) => {
    setIdentity(current => ({ ...current, [key]: value }));
  };

  const updateAccessory = (key: keyof BuildAccessories, value: string) => {
    setAccessories(current => ({ ...current, [key]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizePlayerIdentity(identity);
    if (normalized.errors.length) {
      setError(normalized.errors[0]);
      return;
    }
    setError(null);
    try {
      await onSave(normalized.identity, accessories);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const renderAccessorySelect = (
    label: string,
    key: keyof BuildAccessories,
    type: AccessoryType,
  ) => (
    <label>
      {label}
      <select
        value={accessories[key]}
        onChange={e => updateAccessory(key, e.target.value)}
      >
        <option value="">None</option>
        {groupedAccessories[type].map(accessory => (
          <option key={accessory.id} value={accessory.id}>
            {ACCESSORIES_BY_ID[accessory.id]?.name ?? accessory.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal identity-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <h2>{title}</h2>
        {intro && <p className="modal-intro">{intro}</p>}
        <form onSubmit={submit}>
          <label>
            <span className="identity-label-row">
              Name
              <small>{identity.playerName.length}/18</small>
            </span>
            <input
              value={identity.playerName}
              onChange={e => update('playerName', e.target.value)}
              maxLength={18}
              placeholder="Joe Basketball"
            />
          </label>
          <label>
            <span className="identity-label-row">
              Motto
              <small>{identity.motto.length}/28</small>
            </span>
            <input
              value={identity.motto}
              onChange={e => update('motto', e.target.value)}
              maxLength={28}
              placeholder="Ball is life"
            />
          </label>
          <label>
            Country
            <select
              value={identity.country}
              onChange={e => update('country', e.target.value)}
            >
              <option value="">Select a country</option>
              {COMMON_COUNTRIES.map(option => (
                <option key={option.name} value={option.name}>{option.name}</option>
              ))}
            </select>
          </label>
          {showAccessories && ownedAccessories.length > 0 && (
            <div className="identity-accessories">
              <h3>Apply Accessories</h3>
              {renderAccessorySelect('User icon', 'userIconId', 'userIcon')}
              {renderAccessorySelect('Card frame', 'cardFrameId', 'cardFrame')}
              {renderAccessorySelect('Card banner', 'cardBannerId', 'cardBanner')}
            </div>
          )}
          {extraContent}
          {error && <div className="form-error">{error}</div>}
          <div className="identity-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : submitLabel}
            </button>
            {showSkip && (
              <button
                className="link"
                type="button"
                disabled={saving}
                onClick={() => onSave(EMPTY_PLAYER_IDENTITY, EMPTY_BUILD_ACCESSORIES)}
              >
                Skip
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
