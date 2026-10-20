# Forever & Always — Wedding Planner (Direct Google Drive Edition)

A private, responsive Node.js wedding-planning app deployable to **Vercel**, with **Google Drive as its only persistent storage**. No Firebase, Supabase, database subscription, Google Apps Script, or separate backend is involved. The app implements the frontend, login, security, to-do lists, progress dashboard, guest list, budget, vendors, milestones, planning team, and photo upload.

**Wedding site password:** `STWed2027` (set as an environment variable).

**Existing Google Drive folder:** https://drive.google.com/drive/folders/1ihLbsZeSl8hZ37Bec7mijpX6zkqr2IC4

## Important: How Google Drive connects

Vercel cannot permanently save files in its own filesystem. Your app must obtain **Google Drive API authorization** to save to your private Google Drive folder. This is done using a **one-time, local OAuth authorization**; there is **no Apps Script, no external relay, and no other paid service**.

The app communicates directly with Google Drive:

`Planners → Your Vercel Node.js app → Google Drive REST API → Your folder`

Only the owner completes Google authorization. Other planners use the site link and website password, **not** their personal Google accounts.

The Drive folder ID is preconfigured. Files are created as needed:

- `wedding-planner--tasks--<id>.json`, `wedding-planner--guests--<id>.json`, etc. — records saved separately to prevent two planners editing *different* items from overwriting one shared file
- `wedding-planner--settings.json` — wedding configuration
- `wedding-planner--activity--<id>.json` — history of additions and updates
- `Wedding Planner Images/` — uploaded JPG, PNG, WebP and GIF images (3 MB maximum each)

Changes are shared on refresh and checked periodically by the interface. Edits to the **same** item can still conflict (last save wins); do not have two planners edit a single entry at the same instant. This is a lightweight shared Drive file store, not a transactional relational database.

## 1 — Create Google API credentials (free)

1. Visit **[Google Cloud Console](https://console.cloud.google.com/)** using the Google account that owns or can edit your wedding folder.
2. Create a new project (e.g. `Forever and Always Wedding`). You do **not** need to add a billing account for this integration.
3. Go to **APIs & Services → Library**, find **Google Drive API**, then select **Enable**.
4. Go to **Google Auth Platform** → **Branding**. Configure an app name (`Forever and Always Wedding`), your support email and developer contact email.
5. Under **Audience**, choose **External** if using a personal Gmail account, and add **your own Google address** under Test users. If an internal Workspace app is possible, use the appropriate internal setup.
6. Under **Data Access / Scopes**, request the Google Drive API scope `https://www.googleapis.com/auth/drive`.
7. Go to **Clients → Create client**, select **Desktop app**, and create an OAuth client called `Wedding Planner Owner Setup`.
8. Copy the **Client ID** and **Client secret**. Keep the secret private. They are only used by your app backend and the local setup script.

**Important scope note:** This version targets an **existing Drive folder by ID**, and requests Drive's full-access OAuth scope. Google classifies that scope as *restricted*. It grants the server broad capabilities under your Google identity, even though this app is programmed to use only the wedding folder. Use a dedicated Google account with access to only the wedding folder if you want stronger isolation. For distributing a Google OAuth app publicly, Google may require verification and a security assessment. This version is intended for private, owner-authorized use.

**Important token note:** Google generally makes refresh tokens from **External + Testing** consent apps expire in **7 days**. For long-term use, publish the OAuth consent app to **In production** where allowed, or expect to rerun the authorization command after the token expires. You can keep the *wedding website* private even if the Google consent screen is in production; those are separate concepts. See [Google's OAuth rules](https://developers.google.com/identity/protocols/oauth2).

## 2 — Connect your Google account locally

Download/extract this project. Install [Node.js 22+](https://nodejs.org/).

Open `.env.local` in the project root, and fill in:

```dotenv
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
```

Run from PowerShell in the extracted project:

```powershell
npm run connect:drive
```

The command displays a Google sign-in URL. **Open the URL on the SAME computer** running the command, choose the account with access to your wedding folder, and approve. A local callback receives the refresh token; the token is automatically saved to your gitignored `.env.local` file as `GOOGLE_REFRESH_TOKEN`. No tokens are printed into your browser's address bar.

If the Google consent screen says the app isn't verified, carefully confirm that it shows **your own private Google Cloud project's app name** and do not approve a project you don't recognize. Google may block access based on account settings.

## 3 — Set 5 Vercel environment variables

Go to **Vercel → Wedding Planner → Settings → Environment Variables → Production**:

| Variable | Value |
|---|---|
| `WEDDING_PASSWORD` | `STWed2027` |
| `WEDDING_SESSION_SECRET` | Unique randomly generated 64-character hexadecimal secret |
| `GOOGLE_CLIENT_ID` | Your Google OAuth Desktop client ID from Step 1 |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth Desktop client secret from Step 1 |
| `GOOGLE_REFRESH_TOKEN` | The refresh token stored in `.env.local` by Step 2 |

Optional: `GOOGLE_DRIVE_FOLDER_ID=1ihLbsZeSl8hZ37Bec7mijpX6zkqr2IC4` (already included as default in code).

Generate a session secret with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

**Don't use the wedding website password as any other secret.** Never commit `.env.local`, print your refresh token in GitHub issues or chat, or share these secrets with planners. Remember to update the Vercel configuration if you rotate or revoke a refresh token.

Once the environment variables are saved, go to **Vercel → Deployments → Redeploy** to activate them. `GOOGLE_APPS_SCRIPT_URL` and `GOOGLE_APPS_SCRIPT_SECRET` are **not used anymore**; you can remove those older variables if you previously set them.

## 4 — Verify the deployment

1. Open the deployed Vercel URL in a private browser window. Verify that it requests the password before showing the planning workspace.
2. Enter `STWed2027`.
3. Open **Settings**. You should see **Google Drive connected**.
4. Add a task called `Test Drive connection`.
5. Refresh the page. The task should remain.
6. Open the configured Drive folder. You should see a file like `wedding-planner--tasks--<id>.json`.
7. Upload a small inspiration photo and check the `Wedding Planner Images` folder.
8. Only then share the website URL and password privately with planners.

If settings load but saving fails, inspect **Vercel → Logs** for details. Common causes: OAuth token expired, wrong client ID/secret, Drive API not enabled, insufficient folder access, or a Google Workspace restriction.

## 5 — Local preview without connecting Google

The app also runs locally without Google API credentials, using a demo dataset saved on **your own computer** in `.local-data`. This mode is **not shared** and should not be used on Vercel.

On Windows, double-click `START-WEDDING-PLANNER.bat`, or run:

```bash
npm run dev
```

Visit `http://localhost:3000` and enter `STWed2027`. The app uses the Drive backend when all 3 Google credentials are present; otherwise, it uses local demo mode on your computer. On Vercel, it deliberately returns a configuration error if Drive credentials are missing instead of pretending to save data.

## Feature set

- **Overview:** Wedding countdown, task progress, guests, budget and inspiration previews
- **Tasks:** Add, assign, prioritize, edit, complete, delete and filter items
- **Inspiration:** Image uploads or image URLs, with captions, category and notes
- **Budget:** Estimates, actual amounts, payments and currency setting
- **Guests:** RSVP, meal, group, plus one and notes
- **Vendors:** Contact information, quotes and statuses
- **Timeline:** Milestones, dates and completion
- **Team:** Named planners (for assignment and activity attribution)
- **Settings:** Couple names, wedding details, JSON backup export and storage status

The website is responsive for desktop, tablet and mobile; it uses a desktop sidebar and mobile tab navigation.

## Security, cost and limitations

- The website password is verified **server-side**, with a signed, HttpOnly, SameSite cookie. Unauthenticated users cannot access API data or private photos. **Anyone with the shared password can edit/delete data**. Team member names are not separate verified accounts.
- **Google Drive OAuth credentials are only ever used by the server**. Google Drive should have its folder sharing set to **Restricted**.
- Google Drive's **free API usage and existing personal storage allowance** may be sufficient for a small wedding team. Quotas, billing rules, OAuth access rules, and Vercel free-plan usage limits still apply; it is not a guarantee of unlimited free use.
- The app saves each item separately in Drive to reduce cross-item conflicts. Concurrent updates to the same item are last-writer-wins.
- Upload maximum is 3 MB/image due to Vercel request-size limits. Deleting an inspiration entry does not delete the uploaded file from Drive (allowing manual recovery).
- Google Drive isn't a database, so very large record counts may make dashboard loading slower. You can download a JSON backup from Settings.
- The UI uses external decorative/placeholder images; shared uploaded images come only through the app from your Google Drive.

## Project structure

```text
api/index.js                       # Vercel handler
lib/app.js                         # Protected HTTP routes / login / data APIs
lib/security.js                    # Password gate and signed cookies
lib/data.js                        # Field validation / change operations
lib/store.js                       # Direct Drive record storage or local demo
lib/drive.js                       # Google OAuth token refresh and REST API
scripts/connect-google-drive.mjs   # One-time local Google authorization
web/                               # Responsive website
server.js                          # Local server
vercel.json                        # Vercel configuration
.env.example                       # Non-secret env reference
tests/                             # Local unit and HTTP security tests
```

No Apps Script, database driver, frontend build system, or paid dependency is required.

```bash
npm test
npm run check
```
