import AsyncStorage from '@react-native-async-storage/async-storage';

const draftStorageKey = 'haat-blog-drafts-v1';
const submissionStorageKey = 'haat-blog-submissions-v1';
const savedStorageKey = 'haat-blog-saved-v1';
const likedStorageKey = 'haat-blog-liked-v1';

export type BlogDraft = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  author: string;
  email: string;
  coverUri: string | null;
  coverName: string | null;
  coverMimeType: string | null;
  coverSize: number | null;
  updatedAt: string;
};

export type BlogSubmissionRecord = {
  id: string;
  title: string;
  author: string;
  submittedAt: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isBlogDraft(value: unknown): value is BlogDraft {
  return isObject(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.excerpt === 'string'
    && typeof value.body === 'string'
    && typeof value.author === 'string'
    && typeof value.email === 'string'
    && (value.coverUri === null || typeof value.coverUri === 'string')
    && (value.coverName === null || typeof value.coverName === 'string')
    && (value.coverMimeType === null || typeof value.coverMimeType === 'string')
    && (value.coverSize === null || typeof value.coverSize === 'number')
    && typeof value.updatedAt === 'string';
}

function isBlogSubmission(value: unknown): value is BlogSubmissionRecord {
  return isObject(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.author === 'string'
    && typeof value.submittedAt === 'string';
}

async function readArray<T>(key: string, isItem: (value: unknown) => value is T): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return [];

  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || !value.every(isItem)) {
    throw new Error('Saved blog information is invalid. Remove the affected draft or saved entry and try again.');
  }
  return value;
}

async function writeArray<T>(key: string, value: T[]) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const loadBlogDrafts = () => readArray(draftStorageKey, isBlogDraft);

export async function saveBlogDraft(draft: BlogDraft) {
  const drafts = await loadBlogDrafts();
  await writeArray(draftStorageKey, [draft, ...drafts.filter((item) => item.id !== draft.id)]);
}

export async function removeBlogDraft(id: string) {
  const drafts = await loadBlogDrafts();
  await writeArray(draftStorageKey, drafts.filter((item) => item.id !== id));
}

export const loadBlogSubmissions = () => readArray(submissionStorageKey, isBlogSubmission);

export async function saveBlogSubmission(submission: BlogSubmissionRecord) {
  const submissions = await loadBlogSubmissions();
  await writeArray(submissionStorageKey, [submission, ...submissions.filter((item) => item.id !== submission.id)]);
}

export async function removeBlogSubmission(id: string) {
  const submissions = await loadBlogSubmissions();
  await writeArray(submissionStorageKey, submissions.filter((item) => item.id !== id));
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export const loadSavedBlogIds = () => readArray(savedStorageKey, isString);
export const loadLikedBlogIds = () => readArray(likedStorageKey, isString);

async function toggleBlogId(key: string, id: string) {
  const ids = await readArray(key, isString);
  const isActive = ids.includes(id);
  await writeArray(key, isActive ? ids.filter((item) => item !== id) : [id, ...ids]);
  return !isActive;
}

export const toggleSavedBlog = (id: string) => toggleBlogId(savedStorageKey, id);
export const toggleLikedBlog = (id: string) => toggleBlogId(likedStorageKey, id);

export function formatBlogDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
