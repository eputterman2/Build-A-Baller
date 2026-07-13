import type { PlayerIdentity } from './types';

export const EMPTY_PLAYER_IDENTITY: PlayerIdentity = {
  playerName: '',
  motto: '',
  country: '',
};

export interface CountryOption {
  name: string;
  flagFile: string;
}

const country = (name: string, flagFile = `Flag of ${name}.svg`): CountryOption => ({
  name,
  flagFile,
});

export const COMMON_COUNTRIES: CountryOption[] = [
  country('Algeria'),
  country('Angola'),
  country('Argentina'),
  country('Armenia'),
  country('Australia'),
  country('Austria'),
  country('Bahamas', 'Flag of the Bahamas.svg'),
  country('Barbados'),
  country('Belgium'),
  country('Belize'),
  country('Bolivia'),
  country('Bosnia and Herzegovina'),
  country('Brazil'),
  country('Bulgaria'),
  country('Cameroon'),
  country('Canada'),
  country('Chile'),
  country('China', 'Flag of the People\'s Republic of China.svg'),
  country('Colombia'),
  country('Costa Rica'),
  country('Croatia'),
  country('Cuba'),
  country('Czech Republic'),
  country('Denmark'),
  country('Dominican Republic'),
  country('Ecuador'),
  country('Egypt'),
  country('El Salvador'),
  country('Ethiopia'),
  country('Finland'),
  country('France'),
  country('Georgia'),
  country('Germany'),
  country('Ghana'),
  country('Greece'),
  country('Guatemala'),
  country('Haiti'),
  country('Honduras'),
  country('Hungary'),
  country('Iceland'),
  country('India'),
  country('Indonesia'),
  country('Ireland'),
  country('Israel'),
  country('Italy'),
  country('Jamaica'),
  country('Japan'),
  country('Kenya'),
  country('Latvia'),
  country('Lithuania'),
  country('Malaysia'),
  country('Mali'),
  country('Mexico'),
  country('Montenegro'),
  country('Morocco'),
  country('Nepal'),
  country('Netherlands', 'Flag of the Netherlands.svg'),
  country('New Zealand'),
  country('Nicaragua'),
  country('Nigeria'),
  country('Norway'),
  country('Panama'),
  country('Paraguay'),
  country('Peru'),
  country('Philippines', 'Flag of the Philippines.svg'),
  country('Poland'),
  country('Portugal'),
  country('Puerto Rico'),
  country('Qatar'),
  country('Romania'),
  country('Senegal'),
  country('Serbia'),
  country('Slovenia'),
  country('South Africa'),
  country('South Korea'),
  country('Spain'),
  country('Sweden'),
  country('Switzerland'),
  country('Thailand'),
  country('Tunisia'),
  country('Turkey'),
  country('Ukraine'),
  country('United Kingdom', 'Flag of the United Kingdom.svg'),
  country('United States', 'Flag of the United States.svg'),
  country('Uruguay'),
  country('Venezuela'),
  country('Vietnam'),
];

const COUNTRY_NAMES = new Set(COMMON_COUNTRIES.map(option => option.name));

const MAX_LENGTHS: Record<keyof PlayerIdentity, number> = {
  playerName: 18,
  motto: 28,
  country: 24,
};

const FIELD_LABELS: Record<keyof PlayerIdentity, string> = {
  playerName: 'Name',
  motto: 'Motto',
  country: 'Country',
};

const BLOCKED_PATTERNS = [
  /a[\W_]*s[\W_]*s/i,
  /b[\W_]*i[\W_]*t[\W_]*c[\W_]*h/i,
  /c[\W_]*u[\W_]*n[\W_]*t/i,
  /d[\W_]*i[\W_]*c[\W_]*k/i,
  /f[\W_]*a[\W_]*g/i,
  /f[\W_]*u[\W_]*c[\W_]*k/i,
  /k[\W_]*y[\W_]*s/i,
  /n[\W_]*i[\W_]*g[\W_]*g/i,
  /p[\W_]*[e3][\W_]*d[\W_]*[o0]/i,
  /p[\W_]*u[\W_]*s[\W_]*s[\W_]*y/i,
  /r[\W_]*e[\W_]*t[\W_]*a[\W_]*r[\W_]*d/i,
  /s[\W_]*h[\W_]*i[\W_]*t/i,
  /s[\W_]*l[\W_]*u[\W_]*t/i,
  /w[\W_]*h[\W_]*o[\W_]*r[\W_]*e/i,
];

function clean(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasBlockedPublicContent(value: string): boolean {
  return BLOCKED_PATTERNS.some(pattern => pattern.test(value));
}

function hasUnsafeContact(value: string): boolean {
  return /https?:\/\//i.test(value) || /\bwww\./i.test(value) || /@/.test(value);
}

function hasTooMuchNoise(value: string): boolean {
  return /(.)\1{5,}/.test(value) || /[^\w\s'.!,&-]/u.test(value);
}

export function normalizePlayerIdentity(input: Partial<PlayerIdentity> = {}): {
  identity: PlayerIdentity;
  errors: string[];
} {
  const identity: PlayerIdentity = {
    playerName: clean(input.playerName),
    motto: clean(input.motto),
    country: clean(input.country),
  };
  const errors: string[] = [];

  (Object.keys(identity) as Array<keyof PlayerIdentity>).forEach(key => {
    const value = identity[key];
    if (!value) return;

    if (value.length > MAX_LENGTHS[key]) {
      errors.push(`${FIELD_LABELS[key]} must be ${MAX_LENGTHS[key]} characters or fewer.`);
    }
    if (hasBlockedPublicContent(value)) {
      errors.push(`${FIELD_LABELS[key]} contains language that is not allowed.`);
    }
    if (hasUnsafeContact(value)) {
      errors.push(`${FIELD_LABELS[key]} cannot include links, emails, or handles.`);
    }
    if (hasTooMuchNoise(value)) {
      errors.push(`${FIELD_LABELS[key]} has characters or repetition that are not allowed.`);
    }
  });

  if (identity.country && !COUNTRY_NAMES.has(identity.country)) {
    errors.push('Please choose a country from the list.');
  }

  return { identity, errors };
}
