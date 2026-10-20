# Connect the planner to your Google Drive folder

This setup is done **once**, by an owner/editor of the Google Drive folder. Wedding planners themselves only need the wedding website password.

Target folder: https://drive.google.com/drive/folders/1ihLbsZeSl8hZ37Bec7mijpX6zkqr2IC4

## 1. Create a Google Apps Script
1. Sign in to a Google account that has **Editor** access to the target Google Drive folder.
2. Open https://script.google.com/home/projects/create and make a project named `Wedding Planner Drive Bridge`.
3. Replace the content of `Code.gs` in Google Apps Script with the **complete contents** of the `Code.gs` file included here. Save the project.
4. The folder ID has already been filled in for the link you supplied. Change `WEDDING_FOLDER_ID` only if you want another destination.

## 2. Set up a strong secret
1. Generate a secret locally with:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. In Google Apps Script, open **Project Settings** (gear icon) > **Script properties** > **Add script property**.
3. Set `APP_SECRET` to that new random value and save. **Do not use the website password** for this secret.
4. Keep a copy of the secret for your Vercel environment variables. Do not put it in front-end code or commit it to Git.

## 3. Deploy the script
1. Click **Deploy** > **New deployment**.
2. Choose **Web app** (gear icon).
3. Set **Execute as: Me**, and **Who has access: Anyone**. The script checks your private `APP_SECRET` on every request; it does not provide an unauthenticated API.
4. Click **Deploy**, review the permissions, authorize access to the folder in your own Google account, then copy the **Web app URL** ending in `/exec`.
5. Whenever you modify the script code, use **Deploy > Manage deployments > Edit > New version > Deploy**. Simply editing the code does not update an existing production version.

## 4. Configure the wedding website
Set these variables in **Vercel > Project > Settings > Environment Variables**, for Production (and Preview only if needed):

- `WEDDING_PASSWORD` = `STWed2027`
- `WEDDING_SESSION_SECRET` = a different cryptographically random secret, 64+ hex characters
- `GOOGLE_APPS_SCRIPT_URL` = your deployed `/exec` Web app URL
- `GOOGLE_APPS_SCRIPT_SECRET` = the same random value you saved as `APP_SECRET`

Redeploy the Vercel project after adding environment variables.

To test Drive sync locally too, add the last two values to `.env.local` and restart `npm run dev`.

## Files created in the Google Drive folder
- `wedding-planner-data.json` — all lists, guests, budget, vendors, events, team, settings, and recent activity, in one readable JSON file.
- `Wedding Planner Images/` — the actual uploaded inspiration photos. Website image links are protected by the website password; the folder's own Drive sharing rules still apply for people accessing Drive directly.

The bridge uses a **script-wide lock** when editing, preventing simultaneous planners from overwriting each other's changes. For best results, avoid manually editing the JSON in Drive while the website is being used.

## Troubleshooting
- **Access denied / Drive error:** Confirm the account that deployed the Web app has Editor access to the provided folder.
- **Unexpected response:** Use the Web app deployment URL (`.../exec`), not the script editing URL or a `/dev` URL.
- **Unauthorized request:** Make sure `APP_SECRET` and `GOOGLE_APPS_SCRIPT_SECRET` match exactly and are at least 32 characters.
- **Images load slowly:** Every private image is served through the Vercel website and Apps Script; 3 MB max each. Compressed JPG/WEBP images are recommended.
- **Apps Script quotas / policy:** Google Workspace admins may restrict public Web app deployments and Google imposes per-user execution limits. If your organisation blocks deployment, use a personal Google account with Editor access, or change the backend to a managed database and object storage.

**Security:** Only share the website password with invited planners. All of them have equal permissions to view, create, edit, and delete items. The website does not provide individual accounts or an audit trail proving a particular human's identity. Consider strong per-user authentication before using it for highly sensitive guest information.
