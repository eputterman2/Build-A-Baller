import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ACCESSORIES_BY_ID, CATEGORIES, COMMON_COUNTRIES, analyzeBuild, buildArchetype, gradeFor,
  isCustomCharacterId, resolveArchetypeCharacter,
  type BuildDetail, type CategoryName,
} from '@shared/index';
import { overallTier } from '../util';

interface SportsCardProps {
  build: BuildDetail;
  rank?: number | 'unranked';
  viewTo?: string;
  viewLabel?: string;
  metaActions?: ReactNode;
}

const flagSrc = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=96`;

const LEGACY_COUNTRY_NAMES: Record<string, string> = {
  america: 'United States',
  usa: 'United States',
  'u.s.a.': 'United States',
  us: 'United States',
  uk: 'United Kingdom',
};

function flagForCountry(country?: string): { label: string; src: string } | null {
  const value = country?.trim();
  if (!value) return null;
  const canonical = LEGACY_COUNTRY_NAMES[value.toLowerCase()] ?? value;
  const option = COMMON_COUNTRIES.find(item => item.name === canonical);
  return option ? { label: option.name, src: flagSrc(option.flagFile) } : null;
}

export function SportsCard({ build, rank, viewTo, viewLabel = 'view', metaActions }: SportsCardProps) {
  const [flipped, setFlipped] = useState(false);
  const grade = gradeFor(build.overall);
  const archetype = buildArchetype(build.result);
  const character = resolveArchetypeCharacter(build.result, build.picks, build.characterId);
  const analysis = analyzeBuild(build.result);
  const topStrengths = analysis.strengths.slice(0, 2);
  const topWeakness = analysis.weaknesses[0];
  const identity = build.identity;
  const cardName = identity?.playerName || archetype;
  const countryFlag = flagForCountry(identity?.country);
  const motto = identity?.motto;
  const selectedAccessories = build.accessories;
  const userIcon = selectedAccessories?.userIconId ? ACCESSORIES_BY_ID[selectedAccessories.userIconId] : null;
  const cardFrame = selectedAccessories?.cardFrameId ? ACCESSORIES_BY_ID[selectedAccessories.cardFrameId] : null;
  const cardBanner = selectedAccessories?.cardBannerId ? ACCESSORIES_BY_ID[selectedAccessories.cardBannerId] : null;
  const cardTier = isCustomCharacterId(build.characterId) ? 'onyx' : overallTier(build.overall);
  const cardViewTo = viewTo ?? `/build/${build.id}`;
  const toggleFlip = () => setFlipped(v => !v);
  const toggleFromKeyboard = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    toggleFlip();
  };

  return (
    <article
      className={`sports-card-wrap card-tier-${cardTier}${flipped ? ' flipped' : ''}${cardFrame ? ' has-card-frame' : ''}${cardBanner ? ' has-card-banner' : ''}`}
      data-card-id={build.id}
    >
      <div className="sports-card-meta">
        {rank != null && (
          <span className="sports-card-rank">
            {typeof rank === 'number' ? `#${rank}` : rank}
          </span>
        )}
        <span className="sports-card-user">
          <span>@{build.username}</span>
          {userIcon && <img className="sports-card-user-icon" src={userIcon.src} alt="" />}
        </span>
        <span className="sports-card-actions">
          <Link className="link sports-card-view" to={cardViewTo}>{viewLabel}</Link>
          {metaActions}
        </span>
      </div>

      <div
        role="button"
        tabIndex={0}
        className="sports-card"
        onClick={toggleFlip}
        onKeyDown={toggleFromKeyboard}
        aria-pressed={flipped}
        aria-label={flipped ? 'Show card front' : 'Show card back'}
      >
        <div className="sports-card-inner">
          <div className={`sports-card-face sports-card-front${cardFrame ? ' has-card-frame' : ''}${cardBanner ? ' has-card-banner' : ''}`}>
            {cardBanner && <img className="card-banner-art" src={cardBanner.src} alt="" />}
            <div className="card-overall">
              <span>{build.overall}</span>
              <small>OVR</small>
            </div>
            {build.originalOwnerDrawing && (
              <div className="card-owner-badge" aria-label="Original owner">
                <span aria-hidden="true">★</span>
                <small>owner</small>
              </div>
            )}
            <img
              className="card-player-art"
              src={character.src}
              data-character={character.id}
              alt=""
            />
            <div className="card-front-identity">
              <div className="card-front-name-row">
                <b>{cardName}</b>
                {countryFlag && (
                  <span className="card-country-flag">
                    <img src={countryFlag.src} alt={countryFlag.label} loading="lazy" />
                  </span>
                )}
              </div>
              {motto && <small>"{motto}"</small>}
            </div>
            {cardFrame && <img className="card-frame-art" src={cardFrame.src} alt="" />}
            <div className="card-shine" />
          </div>

          <div className="sports-card-face sports-card-back">
            <div className="card-back-head">
              <div>
                <span className="card-back-user">@{build.username}</span>
                <h3>{archetype}</h3>
              </div>
              <div className="card-back-grade">
                <b>{grade.g}</b>
                <span>{build.overall}</span>
              </div>
            </div>

            <p className="card-verdict">{analysis.verdict}</p>

            <div className="card-cats">
              {(Object.keys(CATEGORIES) as CategoryName[]).map(name => (
                <div className="card-cat" key={name}>
                  <span>{CATEGORIES[name].label}</span>
                  <b>{build.result.categoryScores[name]}</b>
                </div>
              ))}
            </div>

            <div className="card-analysis-mini">
              <div>
                <h4>Strengths</h4>
                <ul>
                  {topStrengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div>
                <h4>Weakness</h4>
                <ul>
                  <li>{topWeakness}</li>
                </ul>
              </div>
            </div>

            <Link
              className="card-full-stats"
              to={cardViewTo}
              onClick={e => e.stopPropagation()}
            >
              View Full Stats
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
