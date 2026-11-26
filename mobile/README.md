# The Haat of Art mobile app

Expo Router app for Android and iOS. Public exhibition, artist, artwork, visitor-pass and image data comes from the existing Express API and its MySQL database. The app does not create a database or copy media.

## Run locally

1. Start the existing backend with `pnpm --dir backend dev`.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to the backend API URL, including `/api`.
   - Android emulator: use `http://10.0.2.2:4000/api`.
   - iOS simulator: `http://localhost:4000/api` normally reaches the host.
   - Physical device: use the computer's LAN IP and make sure the device can reach the backend.
   - Production: set the deployed HTTPS API origin; do not commit credentials or tokens.
3. Run `npm install` and `npm run start` from this directory. Use Expo Go or a development build to open the app on Android/iOS.

## Android emulator and Expo Go

- This is an Expo-managed project. The `android/` Gradle project is generated only when you run prebuild; Android Studio will not find an installable app by opening the repository root.
- Start an Android emulator from Android Studio's Device Manager, then run `npm run android` from `mobile/`. Expo starts Metro and opens the project in Expo Go on the emulator.
- Set `EXPO_PUBLIC_API_URL` to the computer's LAN IP for a physical phone (both devices must be on the same network and Node/Metro allowed through Windows Firewall). For an Android emulator, use `http://10.0.2.2:4000/api`.
- If Expo Go cannot reach Metro over Wi-Fi, try `npx expo start --tunnel` and scan its new QR code. Update Expo Go from Play Store if it reports an unsupported SDK.
- To build/open the native Gradle project in Android Studio instead of using Expo Go, run `npx expo prebuild --platform android`, then open `mobile/android`. For a device/emulator install, run `npm run build:android`.

### Windows quick launch

In PowerShell, from the repository root:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
adb devices -l
Set-Location mobile
npx expo start --go --lan --port 8083
```

`adb devices -l` should show the emulator as `device`, not `offline`. If it is offline, stop and restart that emulator from Android Studio Device Manager, then check again. Expo Go can scan the displayed QR or open `exp://<computer-LAN-IP>:8083` manually.

## Existing backend integration

- Exhibitions use `/api/events`; artist cards and artwork images use the approved-profile endpoints `/api/artist-profile/public` and `/api/artist-profile/public/gallery`, with profiles opened through `/api/artist-profile/public/:userId`. This keeps each portfolio image associated with its owning artist instead of using the separate seeded showcase catalogue.
- Event lists request bounded pages; approved artist and portfolio endpoints retain their existing public array responses. Event details use `/api/events/:id`.
- Visitor registration uses `POST /api/visitor-passes`; it issues passes through the current workflow and displays the returned QR. My Haat uses `/api/auth/me` and `/api/passes/visitor/passes`.
- Native account sign-in uses the additive `/api/auth/mobile/*` token endpoints. Refresh tokens are kept in SecureStore and rotated through the existing `refresh_sessions` table. Access requests use the same permission checks as the website.
- Accounts with `bookings:manage` get an Applications & Bookings operations screen from My Haat. It uses the website's admin APIs for applicant review, city/state filtering, exhibitor contact, and payment verification; the backend remains the source of truth.
- Event reminders are local device notifications. Pass scanning is shown only when `/api/auth/me` grants `passes:scan`; check-in is performed by the existing `/api/passes/check-in` route.

The API base URL must point to the existing backend connected to the intended MySQL database. An unavailable or misconfigured API is shown as an error; the app does not substitute sample business data.
