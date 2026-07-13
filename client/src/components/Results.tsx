import { useEffect, useMemo, useState } from 'react';
import {
  ATTRIBUTES, CATEGORIES, PLAYERS_BY_ID, analyzeBuild, formatValue, gradeFor,
  selectArchetypeCharacter,
  type CategoryName, type DrawingOption, type PickMap, type ScoreResult,
} from '@shared/index';
import { lastName, overallTier } from '../util';
import { api } from '../api';
import { useAuth } from '../auth';
import { DrawingPicker } from './DrawingPicker';

interface ResultsProps {
  overall: number;
  result: ScoreResult;
  picks: PickMap;
  selectedCharacterId?: string;
  onCharacterChange?: (characterId: string) => void;
}

function scoreColor(v: number): string {
  if (v >= 85) return '#1f9d63';
  if (v >= 70) return '#5a9e3e';
  if (v >= 55) return '#c8930f';
  if (v >= 40) return '#e0701d';
  return '#d23b30';
}

function Bar({ label, value, color, unit = '' }:
  { label: string; value: number; color: string; unit?: string }) {
  return (
    <div className="bar-row">
      <div className="bar-label">{label}<span>{value}{unit}</span></div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

export function Results({ overall, result, picks, selectedCharacterId, onCharacterChange }: ResultsProps) {
  const { user } = useAuth();
  const canSwapDrawing = typeof onCharacterChange === 'function';
  const grade = gradeFor(overall);
  const analysis = analyzeBuild(result);
  const defaultCharacter = useMemo(() => selectArchetypeCharacter(result, picks), [result, picks]);
  const [drawingOptions, setDrawingOptions] = useState<DrawingOption[]>([
    {
      id: defaultCharacter.id,
      name: defaultCharacter.name,
      src: defaultCharacter.src,
      minOverall: overall,
      maxOverall: overall,
      owned: false,
      eligible: true,
      current: true,
    },
  ]);
  const activeCharacterId = selectedCharacterId ?? defaultCharacter.id;
  const character = drawingOptions.find(option => option.id === activeCharacterId && option.eligible)
    ?? drawingOptions.find(option => option.id === defaultCharacter.id)
    ?? drawingOptions[0];
  const riskColor = result.injuryRisk >= 55 ? '#e63946'
    : result.injuryRisk >= 30 ? '#f4a261' : '#2a9d8f';
  const buildBonuses = result.buildBonuses ?? [];

  useEffect(() => {
    if (canSwapDrawing && !selectedCharacterId) onCharacterChange(defaultCharacter.id);
  }, [canSwapDrawing, defaultCharacter.id, onCharacterChange, selectedCharacterId]);

  useEffect(() => {
    if (!canSwapDrawing || !user) {
      setDrawingOptions([{
        id: defaultCharacter.id,
        name: defaultCharacter.name,
        src: defaultCharacter.src,
        minOverall: overall,
        maxOverall: overall,
        owned: false,
        eligible: true,
        current: true,
      }]);
      return;
    }

    let alive = true;
    api.drawingOptions(overall, activeCharacterId)
      .then(options => {
        if (!alive) return;
        const hasDefault = options.some(option => option.id === defaultCharacter.id);
        const hasActive = options.some(option => option.id === activeCharacterId);
        setDrawingOptions(hasDefault ? options : [
          {
            id: defaultCharacter.id,
            name: defaultCharacter.name,
            src: defaultCharacter.src,
            minOverall: overall,
            maxOverall: overall,
            owned: false,
            eligible: true,
            current: true,
          },
          ...options,
        ].filter((option, index, all) =>
          hasActive || option.id !== activeCharacterId || all.findIndex(item => item.id === option.id) === index));
      })
      .catch(() => {
        if (alive) {
          setDrawingOptions([{
            id: defaultCharacter.id,
            name: defaultCharacter.name,
            src: defaultCharacter.src,
            minOverall: overall,
            maxOverall: overall,
            owned: false,
            eligible: true,
            current: true,
          }]);
        }
      });
    return () => { alive = false; };
  }, [activeCharacterId, canSwapDrawing, defaultCharacter, overall, user]);

  return (
    <>
      <div className="overall-card">
        <div className={`overall-num overall-tier-${overallTier(overall)}`}>
          <span>{overall}</span><small>OVR</small>
        </div>
        <div className="overall-grade">
          <div className="grade">{grade.g}</div>
          <div className="grade-label">{grade.label}</div>
        </div>
      </div>

      <div className="results-grid">
        <div className="panel">
          <h3>Categories</h3>
          {(Object.keys(CATEGORIES) as CategoryName[]).map(name => (
            <Bar key={name} label={CATEGORIES[name].label}
              value={result.categoryScores[name]} color={CATEGORIES[name].color} />
          ))}
          <div className="injury">
            <Bar label="Injury Risk" value={result.injuryRisk} color={riskColor} unit="%" />
          </div>
        </div>

        <div className="panel analysis-panel">
          <div className="analysis-copy">
            <h3>Analysis</h3>
            <p className="verdict">{analysis.verdict}</p>
            <div className="analysis-group">
              <h4 className="a-strength">Strengths</h4>
              <ul className="analysis-list pos">
                {analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div className="analysis-group">
              <h4 className="a-weak">Weaknesses</h4>
              <ul className="analysis-list neg">
                {analysis.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>
          <div className="archetype-art">
            <img src={character.src} alt={`${character.name} character`} />
          </div>
        </div>
      </div>

      {canSwapDrawing && (
        <div className="panel">
          <DrawingPicker
            options={drawingOptions}
            selectedId={character.id}
            onChange={onCharacterChange}
          />
        </div>
      )}

      {buildBonuses.length > 0 && (
        <div className="panel build-bonus-panel">
          <h3>Build Bonuses</h3>
          <div className="build-bonus-list">
            {buildBonuses.map(bonus => (
              <div className="build-bonus-item" key={bonus.name}>
                <div>
                  <h4>{bonus.name}</h4>
                  <p>{bonus.text}</p>
                </div>
                <b>+{bonus.points} OVR</b>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <h3>Attribute Breakdown</h3>
        <div className="attrs">
          {ATTRIBUTES.map(attr => {
            const v = result.subScores[attr.key];
            const player = PLAYERS_BY_ID[picks[attr.key]];
            const raw = player ? formatValue(attr.format, player[attr.key] as number) : '—';
            const isMeasurement = attr.type === 'measure';
            return (
              <div className="attr-row" key={attr.key}>
                <span className="attr-name">{attr.label}</span>
                <span className="attr-from">
                  {player ? lastName(player.name) : '—'}{isMeasurement ? '' : ` · ${raw}`}
                </span>
                <span
                  className={`attr-val${isMeasurement ? ' measurement' : ''}`}
                  style={isMeasurement ? undefined : { color: scoreColor(v) }}
                >
                  {isMeasurement ? raw : v}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
