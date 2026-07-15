import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ARCHETYPE_CHARACTER_RULES, buildArchetype, getArchetypeCharacterById, resolveArchetypeCharacter,
  type CollectionBuild, type DrawingOption, type PlayerIdentity,
} from '@shared/index';
import { useAuth } from '../auth';
import { api } from '../api';
import { downloadCardImage, shareCardLink } from '../util';
import { AuthModal } from './AuthModal';
import { SaveIdentityModal } from './SaveIdentityModal';
import { SportsCard } from './SportsCard';
import { DrawingPicker } from './DrawingPicker';

export function Collection() {
  const { user, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [builds, setBuilds] = useState<CollectionBuild[] | null>(null);
  const [playerOfDayWinCount, setPlayerOfDayWinCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingBuild, setEditingBuild] = useState<CollectionBuild | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editCharacterId, setEditCharacterId] = useState('');
  const [editDrawingOptions, setEditDrawingOptions] = useState<DrawingOption[]>([]);
  const [shareStatus, setShareStatus] = useState<{ id: string; label: string } | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => {
    if (!user) {
      setBuilds(null);
      setPlayerOfDayWinCount(null);
      return;
    }
    setError(null);
    Promise.all([api.collection(), api.playerOfDayWins()])
      .then(([collection, winHistory]) => {
        setBuilds(collection);
        setPlayerOfDayWinCount(winHistory.totalWins);
      })
      .catch(e => setError((e as Error).message));
  }, [user]);

  const deleteBuild = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await api.deleteBuild(id);
      setBuilds(current => current?.filter(build => build.id !== id) ?? current);
      setBuilds(await api.collection());
      setConfirmId(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const updateIdentity = async (identity: PlayerIdentity) => {
    if (!editingBuild) return;
    setSavingEdit(true);
    setError(null);
    try {
      const updated = await api.updateBuildIdentity(editingBuild.id, identity);
      const nextCharacterId = editCharacterId || editingBuild.characterId;
      const characterUpdate = nextCharacterId !== editingBuild.characterId
        ? await api.updateBuildCharacter(editingBuild.id, nextCharacterId)
        : {
          characterId: editingBuild.characterId,
          originalOwnerDrawing: editingBuild.originalOwnerDrawing,
        };
      setBuilds(current => current?.map(build =>
        build.id === editingBuild.id
          ? {
            ...build,
            identity: updated,
            characterId: characterUpdate.characterId,
            originalOwnerDrawing: characterUpdate.originalOwnerDrawing,
          }
          : build,
      ) ?? current);
      setEditingBuild(null);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setSavingEdit(false);
    }
  };

  const shareBuild = async (build: CollectionBuild) => {
    const archetype = buildArchetype(build.result);
    const cardName = build.identity?.playerName || archetype;
    const url = `${window.location.origin}/build/${build.id}?from=collection`;
    try {
      const result = await shareCardLink({
        url,
        title: `${build.overall} OVR ${cardName}`,
        text: `I built a ${build.overall} OVR ${cardName} in Build-A-Baller. Can you beat it?`,
      });
      setShareStatus({ id: build.id, label: result === 'copied' ? 'Copied!' : 'Shared!' });
      setTimeout(() => setShareStatus(null), 1500);
    } catch {
      // Users can cancel the native share sheet; no need to show an error.
    }
  };

  const downloadBuild = async (build: CollectionBuild) => {
    const archetype = buildArchetype(build.result);
    const cardName = build.identity?.playerName || archetype;
    try {
      setDownloadStatus({ id: build.id, label: 'Saving...' });
      await downloadCardImage(build.id, `${build.overall} OVR ${cardName}`);
      setDownloadStatus({ id: build.id, label: 'Saved!' });
      setTimeout(() => setDownloadStatus(null), 1500);
    } catch {
      setDownloadStatus({ id: build.id, label: 'Try Again' });
      setTimeout(() => setDownloadStatus(null), 1800);
    }
  };

  useEffect(() => {
    if (!editingBuild) {
      setEditCharacterId('');
      setEditDrawingOptions([]);
      return;
    }
    const currentCharacter = resolveArchetypeCharacter(
      editingBuild.result,
      editingBuild.picks,
      editingBuild.characterId,
    );
    setEditCharacterId(currentCharacter.id);
    const currentRule = getArchetypeCharacterById(currentCharacter.id);
    setEditDrawingOptions(currentRule ? [{
      id: currentRule.id,
      name: currentRule.name,
      src: currentRule.src,
      minOverall: currentRule.minOverall,
      maxOverall: currentRule.maxOverall,
      owned: true,
      eligible: true,
      current: true,
    }] : []);

    let alive = true;
    api.drawingOptions(editingBuild.overall, currentCharacter.id, buildArchetype(editingBuild.result))
      .then(options => {
        if (alive) setEditDrawingOptions(options);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [editingBuild]);

  const collectionStats = useMemo(() => {
    const savedBuilds = builds ?? [];
    const highestOverall = savedBuilds.length ? Math.max(...savedBuilds.map(build => build.overall)) : null;
    const highestBuild = highestOverall == null
      ? null
      : savedBuilds.find(build => build.overall === highestOverall) ?? null;
    const collectedDrawingIds = new Set(
      savedBuilds.map(build => resolveArchetypeCharacter(build.result, build.picks, build.characterId).id),
    );
    const totalDrawingCount = new Set(ARCHETYPE_CHARACTER_RULES.map(rule => rule.id)).size;
    return {
      highestOverall,
      highestBuild,
      collectedDrawingCount: collectedDrawingIds.size,
      totalDrawingCount,
    };
  }, [builds]);

  if (loading) return <div className="notice">Loading collection…</div>;

  if (!user) {
    return (
      <div className="collection-empty">
        <h2 className="results-title">My Collection</h2>
        <p>Log in to see the cards you’ve saved to the leaderboard.</p>
        <button className="btn btn-primary" onClick={() => setShowAuth(true)}>Log In</button>
        {showAuth && (
          <AuthModal
            onClose={() => setShowAuth(false)}
            intro="Log in to view your saved player cards."
          />
        )}
      </div>
    );
  }

  if (error) return <div className="notice error">Couldn’t load collection: {error}</div>;
  if (!builds || playerOfDayWinCount == null) return <div className="notice">Loading collection…</div>;

  return (
    <div className="collection">
      <h2 className="results-title">My Collection</h2>
      <div className="collection-summary">
        {collectionStats.highestBuild ? (
          <Link
            className="collection-summary-card"
            to={`/build/${collectionStats.highestBuild.id}?from=collection`}
          >
            <span>Highest Overall</span>
            <b>{collectionStats.highestOverall}</b>
          </Link>
        ) : (
          <div className="collection-summary-card is-disabled">
            <span>Highest Overall</span>
            <b>-</b>
          </div>
        )}
        <Link className="collection-summary-card" to="/collection/drawings">
          <span>Drawings Collected</span>
          <b>{collectionStats.collectedDrawingCount}/{collectionStats.totalDrawingCount}</b>
        </Link>
        <Link className="collection-summary-card" to="/collection/player-of-day">
          <span>Player of the Day</span>
          <b>{playerOfDayWinCount}</b>
        </Link>
        <Link className="collection-summary-card collection-summary-accessories" to="/collection/accessories">
          <span>Accessories</span>
          <b>Equip</b>
        </Link>
      </div>
      {builds.length === 0 ? (
        <div className="notice">No saved cards yet. Build a baller and save them to the leaderboard.</div>
      ) : (
        <div className="sports-card-grid">
          {builds.map(build => (
            <div className="leaderboard-card-cell" key={build.id}>
              <SportsCard
                build={build}
                rank={build.place ?? 'unranked'}
                viewTo={`/build/${build.id}?from=collection`}
                metaActions={confirmId === build.id ? (
                  <>
                    <button
                      className="link sports-card-danger-link"
                      disabled={deletingId === build.id}
                      onClick={() => deleteBuild(build.id)}
                    >
                      {deletingId === build.id ? 'deleting…' : 'confirm'}
                    </button>
                    <button className="link" onClick={() => setConfirmId(null)}>cancel</button>
                  </>
                ) : (
                  <>
                    <button className="link" onClick={() => setEditingBuild(build)}>edit</button>
                    <button className="link sports-card-danger-link" onClick={() => setConfirmId(build.id)}>
                      delete
                    </button>
                  </>
                )}
              />
              <div className="card-export-actions">
                <button className="btn btn-small share-card-btn" onClick={() => shareBuild(build)}>
                  {shareStatus?.id === build.id ? shareStatus.label : 'Share'}
                </button>
                <button className="btn btn-small share-card-btn" onClick={() => downloadBuild(build)}>
                  {downloadStatus?.id === build.id ? downloadStatus.label : 'Download'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editingBuild && (
        <SaveIdentityModal
          onClose={() => setEditingBuild(null)}
          onSave={updateIdentity}
          saving={savingEdit}
          initialIdentity={editingBuild.identity}
          title="Edit Baller"
          intro=""
          submitLabel="Save Changes"
          showSkip={false}
          extraContent={
            <DrawingPicker
              compact
              options={editDrawingOptions}
              selectedId={editCharacterId}
              onChange={setEditCharacterId}
            />
          }
        />
      )}
    </div>
  );
}
