# ♡ Forever & Always — Wedding Planner

A private, fully responsive wedding planning website built with **Node.js (no external runtime dependencies)**. Designed for desktop, tablet, and phones, and configured for deployment on **Vercel**. All planners share one password, and—once connected—the app stores its plans and uploaded photos in your designated **Google Drive folder**.

**Wedding site password:** `STWed2027` (set server-side, not stored in browser JavaScript).

**Your Google Drive destination:** https://drive.google.com/drive/folders/1ihLbsZeSl8hZ37Bec7mijpX6zkqr2IC4

> **Important:** The Google Drive folder is *not automatically connected* just because its URL was provided. You will need to authorize a small Google Apps Script one time. The app already contains the Google Drive integration, code, folder ID, and step-by-step setup guide.

## What's inside?

| Section | What you can do |
|---|---|
| Overview | Custom couple names, wedding date countdown, planning progress, budget, guests and inspiration |
| To-do list | Create, edit, delete, assign, prioritize, categorise, filter and complete tasks across three columns |
| Inspiration | Upload JPG/PNG/WEBP/GIF photos (up to 3 MB each), or add an image URL; save captions and notes |
| Budget tracker | Enter estimates and actual spending, track payments and remaining estimated budget, currency settings |
| Guest list | Names, groups, RSVP statuses, meal requests, plus-ones and notes |
| Vendors | Businesses, service categories, contacts, quotes, booking statuses and notes |
| Wedding timeline | Save milestones, locations, dates, times and completion statuses |
| Planning team | Add planner names/roles, choose a display name, assign tasks and label recent activity |
| Settings | Custom wedding details, Google Drive status, JSON backup export, recent activity, sign out |

The interface is **mobile-first responsive** at small sizes, with a bottom tab bar on phones and a sidebar on desktop. Planners see each other's updates on refresh and the app also checks quietly every minute when idle. The server validates changes and uploaded image types. All data and image endpoints require a valid signed, HttpOnly login session.

## A. Test locally in 2 minutes (Windows / macOS / Linux)

### Requirements
- **Node.js 22 or newer**, available at https://nodejs.org/
- A web browser

### Windows: one-click startup
1. Unzip this project into a folder, e.g. `Documents\Wedding Planner`.
2. Double-click **`START-WEDDING-PLANNER.bat`**.
3. Open http://localhost:3000 (the batch file also opens this for you).
4. Sign in with **`STWed2027`**.

### Terminal startup (any OS)
```bash
cd wedding-planner
npm run dev
```

The zip includes a **local-only `.env.local`** with the requested wedding password and a random development session key. No `npm install` is needed because the app uses only built-in Node.js APIs. If your port is already in use, change `PORT=3000` in `.env.local`.

**Try it out:** Demo tasks, a budget and inspiration references are preloaded **only in local test mode**. Add a planner, create a task, mark it done, add an idea with a photo, then check the dashboard. Local testing data goes to `.local-data/wedding-data.json` and uploaded files to `.local-data/uploads/`. That folder is excluded from Git and does not deploy or synchronize to Google Drive automatically. The demo is not your real wedding plan.

Stop the local server with `Ctrl + C` in the terminal.

## B. Connect your Google Drive folder for shared planners

Full illustrated-by-steps instructions are in **[`google-apps-script/SETUP.md`](google-apps-script/SETUP.md)**; follow these once:

1. Open https://script.google.com/home/projects/create using a Google account with **Editor** access to your wedding folder.
2. Paste **`google-apps-script/Code.gs`** into the Apps Script editor.
3. Add an Apps Script **Script property** called `APP_SECRET` containing a random secret of at least 32 characters.
4. Deploy as a **Web app**, **Execute as: Me**, **Who has access: Anyone**. The private secret is required on every call. Authorize your account's Google Drive access.
5. Copy the script's `/exec` Web app URL. Set `GOOGLE_APPS_SCRIPT_URL` and `GOOGLE_APPS_SCRIPT_SECRET` in Vercel to the URL and secret.

The bridge **automatically creates** in your given Drive folder:
- `wedding-planner-data.json` — tasks, inspiration metadata, budgets, guests, vendors, timeline, planners, wedding settings and recent activity.
- `Wedding Planner Images/` — uploaded photos.

The Drive data is shared with planners **through the website password**, not by granting them OAuth access individually. Google Apps Script uses `LockService` for atomic editing of the shared JSON document to avoid lost updates between concurrent planners.

**Privacy note:** The website password does not alter Google Drive's own folder/file permissions. If your Drive folder is shared publicly, someone may be able to read its contents directly via Drive, even though the wedding website itself is password-protected. Make the folder **Restricted** and only share it with trusted accounts as necessary.

## C. Deploy to Vercel

This is a **Node.js Vercel Functions** project (not Next.js, React or Express). It uses one serverless function and server-rendered password gating, with browser JavaScript for the interactive planning workspace. The `vercel.json` rewrites all site URLs to the protected Node.js handler.

1. Create a private GitHub repository and upload/push the project's files. The `.gitignore` excludes `.env.local`, `.local-data`, and `node_modules`.
2. Go to https://vercel.com/new and import the repository. Choose **Framework Preset: Other** (not Next.js). Leave Build Command and Output Directory at defaults/blank, because no build is needed.
3. Set project **Environment Variables** (Production):

| Variable | Value |
|---|---|
| `WEDDING_PASSWORD` | `STWed2027` |
| `WEDDING_SESSION_SECRET` | A new random 64-character hex secret (different from the Drive secret) |
| `GOOGLE_APPS_SCRIPT_URL` | The deployed Google Apps Script `/exec` web app URL |
| `GOOGLE_APPS_SCRIPT_SECRET` | The value of Apps Script's `APP_SECRET` |

To generate a random secret:
```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

4. Deploy or redeploy after adding environment variables. Visit the Vercel URL in a private/incognito window: without the password, you see **only the login page**.
5. Sign in, set wedding details, add the planning team, then privately share the website URL and website password with your planners.
6. Confirm that Settings says **Google Drive connected**. Check the Drive folder for `wedding-planner-data.json` and `Wedding Planner Images/` after saving something.

**Vercel warning:** A serverless deployment has no persistent local filesystem. To prevent false confidence and accidental data loss, the app explicitly **refuses to load wedding data on Vercel without the Google Drive integration configured**. Local test mode only works on your own computer.

## D. Security and collaboration notes

- The shared password grants **everyone with that password full read/write/delete access**. The Planning Team field is display-only: it does not create separate identities or access restrictions. Activity entries identify the name selected on a device, not a verified individual.
- Password checks run on the server; sessions use tamper-resistant HMAC signatures and secure/HttpOnly/SameSite cookies. Image files and APIs are also guarded by the session.
- Basic wrong-password throttling is in memory and therefore **per serverless instance**. For a widely shared public Vercel URL, use Vercel's firewall/rate-limiting or a stronger user account provider; don't rely only on per-instance throttling against distributed attacks. Rotate the shared password if it spreads beyond your planning team.
- Use a secret Google Apps Script token **separate from** the website password, stored only on the server and in Apps Script Script Properties.
- Photo size: up to 3 MB each. Drive Apps Script has Google quota, execution and administrator policy limits, so this lightweight integration suits a small wedding team, not thousands of users.
- Uploaded files stay in the Drive image folder even when an inspiration card is deleted, so you can recover them manually.
- External image links (including the demo inspirations) display from the source website; uploaded images are stored in Drive. The starter demo images and the decorative hero photo may require an internet connection.
- You can export all planning records as a JSON backup from Settings. The app intentionally does not auto-import local demo data into your shared Drive workspace.

## E. Run tests / understand the project

```bash
npm test
npm run check
```

`npm test` exercises task edits, safe validation, login failure, password-protected API/page access, session cookies, task persistence, image uploads, and logout. `npm run check` validates JavaScript syntax without external build tools.

```text
wedding-planner/
├── api/index.js              # Vercel serverless handler
├── lib/app.js                # Node HTTP router, login and private APIs
├── lib/security.js           # HMAC sessions and password protection
├── lib/data.js               # Field validation and change operations
├── lib/store.js              # Drive Apps Script bridge / local test store
├── lib/sample.js             # Local demo data and starter checklist
├── web/app.html              # Protected application shell
├── web/app.js                # Interactive UI, sections and dialogs
├── web/styles.css            # Responsive styling
├── web/login.html            # Public password gate (no data shown)
├── google-apps-script/
│   ├── Code.gs               # Google Drive backend script
│   └── SETUP.md              # Google Drive integration guide
├── tests/                    # Security and functional smoke tests
├── .env.example              # Environment variable template
├── .env.local                # Local development ONLY, gitignored
├── START-WEDDING-PLANNER.bat # Windows launcher
├── server.js                 # Local Node.js server
└── vercel.json               # Vercel routing and bundled asset config
```

No paid application service is required for a small planning team beyond any limits/fees from Vercel and Google Workspace that apply to your accounts. Connect Drive **before** inviting your planners, so all their changes are saved to the same real place.
#   f o r e v e r - a n d - a l w a y s - w e d d i n g - p l a n n e r  
 