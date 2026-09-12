import type { DrawingOption } from '@shared/index';

function rangeText(minOverall: number, maxOverall: number): string {
  if (minOverall === maxOverall) return `${minOverall} OVR`;
  if (minOverall <= 0) return `up to ${maxOverall} OVR`;
  return `${minOverall}-${maxOverall} OVR`;
}

interface DrawingPickerProps {
  options: DrawingOption[];
  selectedId: string;
  onChange: (id: string) => void;
  compact?: boolean;
}

const DRAWING_ART_SCALE: Record<string, number> = {
  'a7-left': 1.3,
  'b1-bottom-left': 1.18,
  'gs-sharpshooter': 1.14,
};

export function DrawingPicker({ options, selectedId, onChange, compact = false }: DrawingPickerProps) {
  const seenNames = new Set<string>();
  const visibleOptions = options
    .filter(option => option.current || option.owned)
    .filter(option => {
      const name = option.name.replace(/\s+preview$/i, '').trim().toLowerCase();
      if (seenNames.has(name)) return false;
      seenNames.add(name);
      return true;
    });
  if (!visibleOptions.length) return null;

  return (
    <div className={`drawing-picker${compact ? ' compact' : ''}`}>
      <div className="drawing-picker-head">
        <h3>Player Drawing</h3>
        <p>Unlocked drawings can be swapped in when they fit this card’s overall range.</p>
      </div>
      <div className="drawing-picker-scroll">
        <div className="drawing-picker-grid">
          {visibleOptions.map(option => {
            const selected = option.id === selectedId;
            const disabled = !option.eligible;
            const eligibilityText = option.eligible
              ? option.owned ? 'Eligible' : 'New unlock'
              : `Needs ${rangeText(option.minOverall, option.maxOverall)}`;
            return (
              <button
                aria-label={`${option.name} - ${eligibilityText}`}
                className={`drawing-picker-option${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}${option.eligible ? ' is-eligible' : ' is-ineligible'}`}
                disabled={disabled}
                key={option.id}
                onClick={() => onChange(option.id)}
                title={option.name}
                type="button"
              >
                <img
                  src={option.src}
                  alt=""
                  style={{ transform: `scale(${DRAWING_ART_SCALE[option.id] ?? 1})` }}
                />
                {compact && (
                  <span>
                    <b>{option.name}</b>
                    <small>{eligibilityText}</small>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
