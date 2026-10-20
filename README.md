# Forever & Always — Wedding Planner (Version 3)

A fully responsive, password-protected **Node.js 22+** wedding planning website deployed on **Vercel** (free tier where available), using only your existing **Google Drive folder** for shared data and photos. No database, payment processor, Firebase, Supabase, or Google Cloud Console project.

**Wedding password:** `STWed2027` — set in Vercel, never checked in the browser.

**Drive folder:** https://drive.google.com/drive/folders/1ihLbsZeSl8hZ37Bec7mijpX6zkqr2IC4

## What it does

- Task board: To Do, In Progress and Done; task titles, assigned wedding planner, deadlines, notes, categories and priorities.
- Inspiration gallery: upload private JPG, PNG, WebP and GIF images (up to 3 MB), or add reference URLs.
- Wedding dashboard, progress and countdown, settings, guest list/RSVPs, budget and expenditure, vendors, important dates, planning team, activity timeline, data export.
- Responsive desktop/tablet/mobile view, including mobile bottom navigation.
- Server-side password enforcement, signed HttpOnly/SameSite cookies, protected planning-data and image routes.

## Why the old Vercel version said “Could not load the page”

The previous Node code attempted to load `web/login.html` and `web/app.html` at runtime with filesystem paths that were not reliably included in the Vercel function output. **Version 3 embeds all website assets in `lib/web-assets.js`**, which is imported directly into the Node function. This makes the login screen and main application independent of deployment filesystem paths. After changing front-end code, run `npm run embed` and commit the updated module.

## How the Google Drive connection works

Your application does all wedding planning logic. **Google Drive is just the storage folder**. However, Google's security rules don't let Vercel write into a private Drive folder from its sharing link alone. The free **Google Apps Script Web App** is the minimal Google-native bridge that authorizes Drive file reads/writes using *your* Google account. This is a separate Google-hosted service, but you do **not** need to create a Google Cloud Console project, set up OAuth credentials, or pay for it within Google's normal free quotas.

Read **`google-apps-script/SETUP.md`** for the exact one-time setup. Your planners don't need a Google login; only the website password.

### Files automatically managed in your Google Drive folder

```text
Your Wedding Folder/
├── To Do.json
├── In Progress.json
├── Done.json
├── Budget.json
├── Guests.json
├── Vendors.json
├── Timeline.json
├── Planners.json
├── Inspiration.json
├── Settings.json
├── Activity.json
└── Wedding Planner Images/
    ├── [uploaded image]
    └── [uploaded image]
```

All `.json` files are **ordinary readable text files**, containing arrays of wedding planning objects (except Settings, which is an object). A missing file is created. Changing a task's status moves that object between status files. Drive writes are synchronized with a Google Apps Script lock to avoid overwriting edits from two planners who make changes simultaneously.

## Vercel environment variables

| Environment variable | Value |
|---|---|
| `WEDDING_PASSWORD` | `STWed2027` |
| `WEDDING_SESSION_SECRET` | fresh random 64-character hex string |
| `GOOGLE_APPS_SCRIPT_URL` | Google Apps Script Web App `/exec` URL |
| `GOOGLE_APPS_SCRIPT_SECRET` | same private 64-character value as Apps Script Script Property `APP_SECRET` |

The folder ID is already set in `google-apps-script/Code.gs`; keeping `GOOGLE_DRIVE_FOLDER_ID` in Vercel is harmless but not needed. You can **remove** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` if they were set for Version 2.

Generate **two different** random secrets using Node:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## Update your existing GitHub / Vercel deployment

1. Extract this ZIP.
2. Copy the new source files into the root of your existing wedding-planner GitHub repository, replacing old app files. **Remove the old `lib/drive.js` and `scripts/connect-google-drive.mjs` if they still exist.** Don't commit any `.env.local` files or production secrets.
3. Commit and push to your default branch `main` (or upload the contents using GitHub's file uploader).
4. Make sure Vercel's **Root Directory** is the folder containing `package.json` and `vercel.json` (usually the repository root); **Framework Preset: Other**.
5. Configure the four Vercel variables above in **Production**. Redeploy after saving.
6. Connect your Drive via the instructions in `google-apps-script/SETUP.md` and test saving a task and uploading a photo.

**The Vercel deployment may display its login screen even before storage has been connected**, but once signed in it shows a “Storage not connected” setup message and refuses to save changes. That is intentional: Vercel functions cannot keep durable local data.

## Run locally without a Google account

1. Install Node.js 22 or later.
2. On Windows, double-click `START-WEDDING-PLANNER.bat`. On any OS, use `npm run dev`.
3. The first run generates a private `.env.local` with the website password and random session secret. The test site is available at http://localhost:3000.
4. Sign in with `STWed2027`. Local demo data persists on **your own computer only**, in `.local-data/`. It **does not sync with other planners** unless you configure the Drive bridge locally too.

Stop the dev server with Ctrl+C. No `npm install` is needed, because runtime code only uses Node built-ins.

## Test and verify

```bash
npm test
npm run check
npm run embed   # only needed after changing files inside web/
```

Tests cover validation, signed-password login, inaccessible private URLs without authentication, task creation/completion/deletion, local photo protection, and an offline simulated Google Drive bridge that creates the required files, moves task items, and uploads images. The live Google account connection cannot be tested until you deploy the Apps Script and give it authorization.

## Security and limitations

- Shared password = shared full edit/delete permissions. Planner names are for organizing tasks; they are not proof of identity.
- Keep Drive sharing **Restricted**. Do not put the Apps Script secret in GitHub, URL parameters, or browser code.
- The bridge runs with your authorized Google account's permissions: **review Google’s authorization dialog** before approval.
- Free tiers have execution limits, quotas, and file size limits. 3 MB maximum per image; occasional temporary slowdowns and retries may be needed.
- Uploaded images are not automatically deleted from Drive if an inspiration item is removed, so accidental deletions can be recovered manually.
- To avoid unexpected simultaneous updates, don't hand-edit the JSON files while wedding planners are using the website.
- The app is optimized for a small wedding team; it isn't a general multi-tenant app or relational database.
