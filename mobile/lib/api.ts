import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  clearStoredTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/lib/secure-tokens';
import { useSessionStore } from '@/store/session';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://localhost:4000/api';

let parsedApiUrl: URL;
try {
  parsedApiUrl = new URL(configuredApiUrl);
} catch {
  throw new Error('EXPO_PUBLIC_API_URL must be an absolute backend URL ending in /api');
}

if (!['http:', 'https:'].includes(parsedApiUrl.protocol)) {
  throw new Error('EXPO_PUBLIC_API_URL must use HTTP or HTTPS');
}

export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, '');
export const API_ORIGIN = parsedApiUrl.origin;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { Accept: 'application/json' },
});

type RetryConfig = InternalAxiosRequestConfig & { mobileAuthRetried?: boolean };
type MobileTokens = { accessToken: string; refreshToken: string; expiresIn: number };
let refreshInFlight: Promise<string | null> | null = null;

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as RetryConfig | undefined;
  if (
    error.response?.status !== 401 ||
    !config ||
    config.mobileAuthRetried ||
    config.url?.includes('/auth/mobile/')
  ) {
    return Promise.reject(error);
  }

  config.mobileAuthRetried = true;
  refreshInFlight ??= refreshMobileAccessToken().finally(() => {
    refreshInFlight = null;
  });
  const token = await refreshInFlight;
  if (!token) return Promise.reject(error);

  config.headers.set('Authorization', `Bearer ${token}`);
  return api.request(config);
});

async function refreshMobileAccessToken() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    setAccessToken(null);
    useSessionStore.getState().setUser(null);
    return null;
  }

  try {
    const { data } = await axios.post<MobileTokens>(
      `${API_BASE_URL}/auth/mobile/refresh`,
      { refreshToken },
      { timeout: 15_000, headers: { Accept: 'application/json' } },
    );
    setAccessToken(data.accessToken);
    await setRefreshToken(data.refreshToken);
    return data.accessToken;
  } catch (error) {
    if (axios.isAxiosError(error) && (error.response?.status === 400 || error.response?.status === 401)) {
      await clearStoredTokens();
      useSessionStore.getState().setUser(null);
      return null;
    }
    throw error;
  }
}

export function resolveMediaUrl(path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, `${API_ORIGIN}/`).toString();
}

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError<{ error?: string; message?: string }>(error)) {
    return error.response?.data?.error ?? error.response?.data?.message ?? error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export type EventMedia = {
  id: string;
  url: string;
  altText: string;
  mediaType: string;
};

export type BlogSummary = {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  coverUrl: string | null;
};

export type BlogMedia = {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO';
  url: string;
};

export type BlogPost = BlogSummary & {
  body: string;
  media?: BlogMedia[];
};

export type Exhibition = {
  id: string;
  slug: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  city: string;
  state: string;
  status: string;
  media: EventMedia[];
};

export type Artist = {
  id: string;
  slug: string;
  displayName: string;
  city: string | null;
  medium: string | null;
  specialty: string | null;
  bio: string | null;
  portraitUrl: string | null;
  artworkUrl: string | null;
  isSpotlight: boolean;
  artworkCount: number;
};

export type PublicArtist = {
  userId: string;
  displayName: string;
  headline: string;
  city: string;
  state: string;
  artStyle: string;
  imageUrl: string | null;
};

export type PublicArtistArtwork = {
  id: string;
  title: string;
  medium: string;
  size: string;
  year: number | null;
  price: number | null;
  description: string;
  artistId: string;
  artistName: string;
  city: string;
  url: string | null;
  avatarUrl: string | null;
};

export type ExhibitionArchiveMedia = {
  id: string;
  editionId: string;
  mediaType: string;
  sourceType: string;
  sourceUrl: string | null;
  mimeType: string | null;
  caption: string;
  artistName: string;
  stallName: string;
  altText: string;
  durationSeconds: number | null;
  sortOrder: number;
  url: string | null;
  embedUrl: string | null;
};

export type ExhibitionArchiveEdition = {
  id: string;
  editionKey: string;
  title: string;
  editionNumber: string;
  city: string;
  monthLabel: string;
  startDate: string | null;
  endDate: string | null;
  dateIsExact: boolean;
  venue: string;
  artistCount: number;
  media: ExhibitionArchiveMedia[];
};

export type Artwork = {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  artistSlug: string;
  medium: string | null;
  dimensions: string | null;
  year: number | null;
  city: string | null;
  price: number | null;
  status: string;
  description: string | null;
  imageUrl: string | null;
};

export type VisitorPass = {
  passId: string;
  eventId: string;
  title: string;
  city: string | null;
  venue: string | null;
  startsAt: string;
  endsAt: string;
  passTier: string;
  quantity: number;
  paymentStatus: string;
  passCode: string;
  qrData: string | null;
  status: string;
};

export type AccountUser = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  permissions: string[];
  roles?: string[];
};

export type HomepageContent = {
  heroFeatures?: { icon: HomepageIcon; title: string; subtitle: string }[];
  categories?: { icon: HomepageIcon; title: string; href: string }[];
  mentor?: { visible: boolean; name: string; title: string; bio: string };
  testimonials?: { authorName: string; authorRole: string; message: string }[];
  visibility?: {
    hero?: boolean;
    upcomingExhibitions?: boolean;
    featuredArtists?: boolean;
    impact?: boolean;
    venuePartners?: boolean;
    gallery?: boolean;
    eventHighlights?: boolean;
    invitedGuests?: boolean;
    mediaAlliances?: boolean;
  };
  impact: { value: string; label: string }[];
  highlights: { title: string; description: string }[];
  venuePartners: { name: string }[];
};

export type HomepageIcon =
  | 'calendar'
  | 'users'
  | 'accessibility'
  | 'palette'
  | 'image'
  | 'landmark'
  | 'brush'
  | 'archive';

export type HomepageMedia = {
  url: string;
  altText: string;
  mimeType?: string;
};

export type SiteContent = {
  text: Record<string, string | undefined>;
};

export type BookingExhibition = {
  id: string;
  title: string;
  city: string;
  state?: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  registrationDeadline: string | null;
  availableStalls: number;
  totalStalls: number;
  registrationOpen: boolean;
  media: { id: string; altText: string; mediaType: 'IMAGE'; url: string }[];
};

export type StallType = {
  id: string;
  code: string;
  name: string;
  category: 'INDIVIDUAL' | 'GROUP' | 'GALLERY';
  widthM: number;
  depthM: number;
  price: number;
  taxRate: number;
  includes: string | null;
};

export type BookingStall = {
  id: string;
  code: string;
  state: string;
  location: string;
  sortOrder: number;
  floorX: number;
  floorY: number;
  status: 'AVAILABLE' | 'BOOKED' | 'HELD' | 'RESERVED' | 'DISABLED';
  holdExpiresAt: string | null;
  type: StallType;
};

export type EventFlowContent = {
  kicker: string;
  title: string;
  subtitle: string;
  phases: {
    id: string;
    number: string;
    title: string;
    timeframe: string;
    audience: string[];
    introduction: string;
    activities: string[];
    imageUrl: string;
  }[];
  schedule: {
    day: string;
    title: string;
    items: { period: string; time: string; activity: string }[];
  }[];
  ctaTitle: string;
};

export type MediaPartner = {
  id: string;
  name: string;
  category: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  showOnHome: boolean;
  showOnAbout: boolean;
  showOnExhibitions: boolean;
};

export type InvitedGuest = {
  id: string;
  name: string;
  roleBadge: string;
  designation: string;
  roleSummary: string;
  editionTag: string;
  photoUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  showOnHome: boolean;
  showOnAbout: boolean;
  showOnGallery: boolean;
  showOnExhibitions: boolean;
};
