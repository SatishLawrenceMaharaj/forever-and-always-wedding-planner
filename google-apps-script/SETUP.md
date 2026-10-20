# Connect your Vercel wedding planner to Google Drive (no GCP project)

**Goal:** Vercel hosts the full Node.js application. Your own Google Drive folder holds the lists and photographs. The **free, Google-native Google Apps Script** is just the minimum authorization adapter needed to let Vercel save files into a private Drive folder. You don't configure Google Cloud Console, Google OAuth client IDs, APIs, a database, Firebase or Supabase.

> Vercel cannot directly read or modify a private Drive folder merely from its URL or ID. This one-time Google account authorization is unavoidable for a server-hosted app. Apps Script is a separate Google service, but it doesn't require a paid plan or a separately provisioned Google Cloud project for this use.

Your folder: https://drive.google.com/drive/folders/1ihLbsZeSl8hZ37Bec7mijpX6zkqr2IC4

## Step 1. Make sure you own or can edit the folder

Use the Google account that has **Editor access** to your wedding folder. Keep the folder access **Restricted**; do not change it to “Anyone with the link can edit”. Your planners will work through the password-protected wedding website instead of editing Drive directly.

## Step 2. Create one free Google Apps Script

1. Open https://script.google.com/home/projects/create
2. Name it `Forever and Always Wedding Storage`.
3. Delete the example code in `Code.gs`.
4. Open **`google-apps-script/Code.gs` from this ZIP** in a text editor and paste its complete contents into the online `Code.gs` editor.
5. Save the project. Your existing folder ID is already set inside the source.

**This is a required one-time step.** The Vercel app is not asking your planners to run scripts or configure cloud services.

## Step 3. Generate a private secret

In PowerShell or any terminal (Node.js 22+ installed), run:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the 64-character result (do not share it). In Apps Script:

1. Open **Project settings** (gear) → **Script properties**.
2. Add a property with name **`APP_SECRET`**.
3. Paste the generated result as its value and click **Save script properties**.

This secret is **not** the wedding website password. The website's login password stays `STWed2027`.

## Step 4. Authorize Drive and deploy the connector

1. Click **Deploy** → **New deployment** → select **Web app**.
2. Set **Execute as: Me**. This lets the code write to your Drive folder under your Google account.
3. Set **Who has access: Anyone**. Google Apps Script must allow the server-side Vercel function to call its endpoint without an interactive Google login. **Every POST request checks the 64-character secret.**
4. Deploy, and accept Google's account authorization requests for Apps Script's Drive access. Google may show an unverified-app warning because this is your own private script; review the requested permissions before continuing.
5. Copy the web app URL ending in `/exec`, for example `https://script.google.com/macros/s/AKfycb.../exec`.

Apps Script's public `doGet` only shows a status message and does not expose wedding data. All data operations require the private secret.

## Step 5. Configure your existing Vercel deployment

In **Vercel → wedding-planner → Settings → Environment Variables → Production**, set:

| Name | Value |
|---|---|
| `WEDDING_PASSWORD` | `STWed2027` |
| `WEDDING_SESSION_SECRET` | a different 64-character random hex key (not the Drive secret) |
| `GOOGLE_APPS_SCRIPT_URL` | the complete Apps Script Web app URL ending `/exec` |
| `GOOGLE_APPS_SCRIPT_SECRET` | exactly the same key as `APP_SECRET` in Apps Script |

**You do not need** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, a Google Cloud Console project, or a paid storage provider. Your existing `GOOGLE_DRIVE_FOLDER_ID` variable is optional and can stay — the folder ID is built into the script.

Redeploy the Vercel project after changing environment variables.

## Step 6. Confirm it works

1. Visit your Vercel website in a new private browser window. It should show the wedding password login. Use `STWed2027`.
2. Add a task **“Test connection to Drive”**, with the responsible planner and status **To Do**.
3. Open your wedding Google Drive folder. The script will have created these readable JSON text files:
   - `To Do.json`
   - `In Progress.json`
   - `Done.json`
   - `Inspiration.json`
   - `Budget.json`
   - `Guests.json`
   - `Vendors.json`
   - `Timeline.json`
   - `Planners.json`
   - `Settings.json`
   - `Activity.json`
4. Open `To Do.json`; verify your new task object is inside. Change its status to **In Progress** in the app, then refresh Drive — it moves to `In Progress.json`.
5. Upload an inspiration JPG/PNG/WebP/GIF and confirm a `Wedding Planner Images/` folder appears in Google Drive. Each picture has an upload size limit of 3 MB.

The script **creates missing files automatically**. It also migrates existing `wedding-planner-data.json` entries on first connection if none of the new files exist, leaving the old file as a backup.

## Updating the script

When you edit `Code.gs` later, the existing deployed URL doesn't automatically update. Use **Deploy → Manage deployments → Edit → New version → Deploy**.

## Common problems

- **“Could not load the page.”** is the old Vercel static-page packaging error. Push the V3 app and redeploy; its HTML/CSS/JS are embedded into Node code to avoid that bug.
- **“Storage is not connected.”** Check Vercel's environment variables and redeploy; never add Google Drive credentials to client-side code.
- **“Storage connection authentication failed.”** `GOOGLE_APPS_SCRIPT_SECRET` in Vercel differs from Apps Script's `APP_SECRET`.
- **“Unexpected content.”** Check that you're using the `/exec` URL from a deployed Web App and that your Google account allows this sort of Web App.
- **Permission denied:** the account deploying Apps Script does not have edit permission on the Drive folder, or a Workspace admin blocked public script deployment.
- **Changes aren't showing:** refresh the app; it polls roughly once per minute while idle.
- **Big uploads fail:** shrink photos below 3 MB. Free-tier Vercel and Apps Script request size/execution quotas still apply.

**Privacy and collaboration:** Everyone with the shared site password has equal rights to view, edit and remove items. Names entered in the planning team are labels, not verified personal identities. Do not share the secret or publicly expose the Drive folder. Keep independent backups of important information.
