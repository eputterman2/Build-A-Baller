import {
  ATTRIBUTES, CATEGORIES, formatValue, gradeFor,
  type AttributeKey, type BuildPreview, type CategoryName,
} from '@shared/index';
import { overallTier, scoreColor } from '../util';
import { PlayerSilhouette } from './PlayerSilhouette';

interface Props {
  preview: BuildPreview;
  justPicked?: AttributeKey | null;  // attribute drafted this round (for a highlight)
}

export function BuildPanel({ preview, justPicked }: Props) {
  const {
    sub, base, bodyAdjustments, categoryScores, overall, injuryRisk, modifiers, buildBonuses,
  } = preview;
  const grade = overall != null ? gradeFor(overall) : null;

  return (
    <aside className="build-panel">
      <div className="build-head">
        <PlayerSilhouette />
        <div className="build-headline">
          <div className={`build-ovr${overall != null ? ` overall-tier-${overallTier(overall)}` : ''}`}>
            <span>{overall ?? '—'}</span><small>OVR</small>
          </div>
          {grade && <div className="build-grade" title={grade.label}>{grade.g}</div>}
          <div className="build-measures">
            <div>{preview.height != null ? formatValue('height', preview.height) : '—'} <i>HT</i></div>
            <div>{preview.weight != null ? `${preview.weight}` : '—'} <i>WT</i></div>
            <div>{injuryRisk != null ? `${injuryRisk}%` : '—'} <i>INJ</i></div>
          </div>
        </div>
      </div>

      <div className="build-cats">
        {(Object.keys(CATEGORIES) as CategoryName[]).map(name => {
          const v = categoryScores[name];
          return (
            <div className="catbar" key={name}>
              <div className="catbar-label">{CATEGORIES[name].label}<span>{v ?? '—'}</span></div>
              <div className="catbar-track">
                <div className="catbar-fill" style={{ width: `${v ?? 0}%`, background: CATEGORIES[name].color }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="build-attrs">
        {ATTRIBUTES.map(attr => {
          const v = sub[attr.key];
          const b = base[attr.key];
          const measurement = attr.key === 'height'
            ? preview.height
            : attr.key === 'weight'
              ? preview.weight
              : attr.key === 'wingspan'
                ? preview.wingspan
                : null;
          const delta = v != null && b != null ? v - b : 0;
          const picked = attr.type === 'measure' ? measurement != null : v != null;
          const bodyAdjustment = attr.type === 'rating' ? bodyAdjustments[attr.key] || 0 : 0;
          const projectedBodyAdjustment = Math.round(bodyAdjustment);
          return (
            <div className={`battr${attr.key === justPicked ? ' flash' : ''}${picked ? '' : ' empty'}`} key={attr.key}>
              <span className="battr-name">
                {attr.label}
                {!picked && projectedBodyAdjustment !== 0 && (
                  <i
                    className={`body-preview-adjustment ${projectedBodyAdjustment > 0 ? 'up' : 'down'}`}
                    title={`Your body choices will ${projectedBodyAdjustment > 0 ? 'boost' : 'lower'} this stat by ${Math.abs(projectedBodyAdjustment)} points`}
                    aria-label={`Body choices ${projectedBodyAdjustment > 0 ? 'boost' : 'lower'} ${attr.label} by ${Math.abs(projectedBodyAdjustment)} points`}
                  >
                    {projectedBodyAdjustment > 0 ? `+${projectedBodyAdjustment}` : projectedBodyAdjustment}
                  </i>
                )}
              </span>
              {picked ? (
                <span className="battr-val">
                  {attr.type === 'measure' ? (
                    <b className="battr-measure">{formatValue(attr.format, measurement!)}</b>
                  ) : (
                    <>
                      {delta !== 0 && (
                        <i className={`delta ${delta > 0 ? 'up' : 'down'}`}>
                          {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}
                        </i>
                      )}
                      <b style={{ color: scoreColor(v!) }}>{v}</b>
                    </>
                  )}
                </span>
              ) : <span className="battr-val muted">—</span>}
            </div>
          );
        })}
      </div>

      {(modifiers.length > 0 || buildBonuses.length > 0) && (
        <div className="build-mods">
          {modifiers.map((m, i) => (
            <span className="mod-chip" key={i} title={m.text}>{m.name}</span>
          ))}
          {buildBonuses.map(bonus => (
            <span className="mod-chip bonus-chip" key={bonus.name} title={bonus.text}>
              {bonus.name} +{bonus.points}
            </span>
          ))}
        </div>
      )}
    </aside>
  );
}
