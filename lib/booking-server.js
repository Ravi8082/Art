"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExhibitionsForBooking = getExhibitionsForBooking;
exports.getBookingUser = getBookingUser;
exports.getArtistDirectory = getArtistDirectory;
exports.getArtistDirectoryProfile = getArtistDirectoryProfile;
exports.getCuratedGallery = getCuratedGallery;
exports.getExhibitionArchive = getExhibitionArchive;
exports.getGalleryUpcomingEditions = getGalleryUpcomingEditions;
exports.getPublicArtists = getPublicArtists;
exports.getFeaturedArtistDirectory = getFeaturedArtistDirectory;
exports.getPublicArtistGallery = getPublicArtistGallery;
exports.getPublicArtist = getPublicArtist;
exports.getMyArtistProfile = getMyArtistProfile;
const headers_1 = require("next/headers");
const serverApiBaseUrl = (process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
async function readJson(path, forwardCookie, noStore = false) {
    try {
        const headers = { accept: 'application/json' };
        if (forwardCookie) {
            const jar = await (0, headers_1.cookies)();
            const serialized = jar.getAll().map((entry) => `${entry.name}=${entry.value}`).join('; ');
            if (serialized)
                headers.cookie = serialized;
        }
        const response = await fetch(`${serverApiBaseUrl}${path}`, forwardCookie || noStore
            ? { headers, cache: 'no-store' }
            : { headers, next: { revalidate: 30 } });
        if (!response.ok)
            return null;
        return await response.json();
    }
    catch {
        return null;
    }
}
async function getExhibitionsForBooking() {
    return (await readJson('/api/bookings/exhibitions', false, true)) ?? [];
}
async function getBookingUser() {
    const data = await readJson('/api/auth/me', true);
    return data?.user ?? null;
}
async function getArtistDirectory() {
    return (await readJson('/api/artists', false)) ?? [];
}
async function getArtistDirectoryProfile(slug) {
    return readJson(`/api/artists/${encodeURIComponent(slug)}`, false);
}
async function getCuratedGallery() {
    return (await readJson('/api/artists/curated-gallery', false)) ?? [];
}
async function getExhibitionArchive() {
    return (await readJson('/api/exhibition-archive', false)) ?? [];
}
async function getGalleryUpcomingEditions() {
    return (await readJson('/api/exhibition-archive/upcoming', false, true)) ?? [];
}
async function getPublicArtists() {
    return (await readJson('/api/artist-profile/public', false)) ?? [];
}
const featuredPortraitSlugs = new Set(['vikramaditya-rathore', 'pratibha-yadav', 'aarav-deshmukh', 'saroj']);
function normalizeArtistName(name) {
    return name.trim().toLocaleLowerCase().replace(/[^a-z]/g, '');
}
async function getFeaturedArtistDirectory() {
    const [artists, publicArtists] = await Promise.all([getArtistDirectory(), getPublicArtists()]);
    const uploadedPortraits = new Map();
    for (const artist of publicArtists) {
        if (artist.imageUrl)
            uploadedPortraits.set(normalizeArtistName(artist.displayName), artist.imageUrl);
    }
    return artists.map((artist) => {
        if (!featuredPortraitSlugs.has(artist.slug))
            return artist;
        const uploadedPortrait = uploadedPortraits.get(normalizeArtistName(artist.displayName));
        return {
            ...artist,
            portraitUrl: uploadedPortrait
                ? /^https?:\/\//i.test(uploadedPortrait) ? uploadedPortrait : `${serverApiBaseUrl}${uploadedPortrait}`
                : '',
        };
    });
}
async function getPublicArtistGallery() {
    return (await readJson('/api/artist-profile/public/gallery', false)) ?? [];
}
async function getPublicArtist(userId) {
    const data = await readJson(`/api/artist-profile/public/${encodeURIComponent(userId)}`, false);
    return data;
}
async function getMyArtistProfile() {
    return (await readJson('/api/artist-profile/me', true)) ?? { profile: null, artworks: [] };
}
