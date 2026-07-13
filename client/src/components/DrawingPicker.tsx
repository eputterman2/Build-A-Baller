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

export function DrawingPicker({ options, selectedId, onChange, compact = false }: DrawingPickerProps) {
  const visibleOptions = options.filter(option => option.current || option.owned);
  if (!visibleOptions.length) return null;

  return (
    <div className={`drawing-picker${compact ? ' compact' : ''}`}>
      <div className="drawing-picker-head">
        <h3>Player Drawing</h3>
        <p>Unlocked drawings can be swapped in when they fit this card’s overall range.</p>
      </div>
      <div className="drawing-picker-grid">
        {visibleOptions.map(option => {
          const selected = option.id === selectedId;
          const disabled = !option.eligible;
          return (
            <button
              className={`drawing-picker-option${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
              disabled={disabled}
              key={option.id}
              onClick={() => onChange(option.id)}
              type="button"
            >
              <img src={option.src} alt="" />
              <span>
                <b>{option.name}</b>
                <small>
                  {option.eligible
                    ? option.owned ? 'Eligible' : 'New unlock'
                    : `Needs ${rangeText(option.minOverall, option.maxOverall)}`}
                </small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
