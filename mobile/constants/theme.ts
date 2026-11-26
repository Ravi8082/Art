export type WebsiteTheme = {
  orange: string;
  navy: string;
  cream: string;
  card: string;
  muted: string;
  line: string;
};

type AppTheme = {
  background: string;
  surface: string;
  surfaceRaised: string;
  terracotta: string;
  terracottaLight: string;
  champagne: string;
  cream: string;
  muted: string;
  subtle: string;
  border: string;
  nav: string;
  success: string;
  danger: string;
};

export const theme: AppTheme = {
  background: '#1B120E',
  surface: '#281912',
  surfaceRaised: '#3A261B',
  terracotta: '#C94D32',
  terracottaLight: '#A93D28',
  champagne: '#C69A55',
  cream: '#F6E9D7',
  muted: '#C5AE96',
  subtle: '#9B8069',
  border: '#5A3D2D',
  nav: '#150E0B',
  success: '#9AC9A2',
  danger: '#E28A79',
};

export const typography = {
  sans: 'HaatSans',
  sansMedium: 'HaatSansMedium',
  sansSemibold: 'HaatSansSemibold',
  sansBold: 'HaatSansBold',
  display: 'HaatDisplay',
  displayItalic: 'HaatDisplayItalic',
};

let appliedWebsiteThemeSignature = '';

export function applyWebsiteTheme(colors: WebsiteTheme) {
  const signature = [colors.orange, colors.navy, colors.cream, colors.card, colors.muted, colors.line].join('|');
  if (signature === appliedWebsiteThemeSignature) return false;
  const accent = normalizeHex(colors.orange);
  Object.assign(theme, {
    background: '#1B120E',
    surface: '#281912',
    surfaceRaised: '#3A261B',
    terracotta: accent,
    terracottaLight: '#A93D28',
    champagne: '#C69A55',
    cream: '#F6E9D7',
    muted: '#C5AE96',
    subtle: '#9B8069',
    border: '#5A3D2D',
    nav: '#150E0B',
    success: '#9AC9A2',
    danger: '#E28A79',
  });
  appliedWebsiteThemeSignature = signature;
  return true;
}

function normalizeHex(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#C94D32';
}
