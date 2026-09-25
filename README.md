# אשר חיון · אירועים

Video gallery of a music teacher's events (בר מצוה, ברית מילה, שבע ברכות, …), built from a Google Drive folder.

- **Next.js 16** (App Router, RTL Hebrew) on **Vercel**
- **Upstash Redis** (Vercel Marketplace) stores the event list
- **Daily sync**: Vercel Cron → `/api/cron/sync` reads Drive, adds new events/videos, refreshes the site
- Search by text (event title *and* song/video names, Hebrew-spelling tolerant), category, year, or date range — all shareable via the URL
- Videos play from Drive, or natively from **Vercel Blob** if the optional mirror is on

## How the Drive folder maps to the site

```
events/                         ← DRIVE_ROOT_FOLDER_ID
├── בר מצוה 2024 גבעת זעב/       ← one event (folder name = title)
│   ├── סקסופון.mp4             ← one video (file name = song title)
│   └── ילדים שרים.mp4
└── שבע ברכות גבעת זאב/
```

- **Category**: keywords in the folder and file names (`src/lib/categories.ts`). An event can have several.
- **Date**: a year in the folder name (e.g. `סוכות 2024`), otherwise the earliest video's timestamp.
- **Corrections**: `data/overrides.json`, keyed by folder id — set `title`, `date`, `datePrecision`, `location`, `description`, `categories`, or `hidden`.
- Empty folders are skipped until they contain a video.

So the teacher's workflow is: **create a folder in Drive, drop the videos in.** It shows up on the site the next morning, marked "חדש" for 30 days.

## Run locally

```bash
npm install
cp .env.example .env.local     # fill in what you have; the site works with none of it
npm run dev                    # http://localhost:3000
```

Without Redis the site reads `data/events.json` (committed).

### Check Drive for new events from your machine

```bash
npm run sync:check             # dry run: lists new events / videos, changes nothing
npm run sync                   # Drive → Redis + data/events.json (+ Blob copies, + refresh live site)
npm run sync -- --snapshot     # rebuild data/events.json from data/drive-snapshot.json, no credentials needed
```

## Deploy

1. **Drive access**
   - For visitors to play videos, share the Drive `events` folder as **Anyone with the link → Viewer**.
   - For the sync: either create an API key (Google Cloud → APIs & Services → enable *Google Drive API* → Credentials → API key) → `GOOGLE_API_KEY`,
     or a service account key → `GOOGLE_SERVICE_ACCOUNT_JSON`, and share the folder with its `client_email`.
2. **GitHub**: push this repo.
3. **Vercel**: import the repo, then in the project:
   - Storage → Marketplace → **Upstash Redis** → connect (adds `KV_REST_API_URL` / `KV_REST_API_TOKEN`)
   - *(optional)* Storage → **Blob** → connect (adds `BLOB_READ_WRITE_TOKEN`) for native video playback
   - Environment variables: `GOOGLE_API_KEY` or `GOOGLE_SERVICE_ACCOUNT_JSON`, `CRON_SECRET` (random string)
4. Deploy. `vercel.json` schedules the sync daily at 04:00 UTC. To run it right away:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://<your-site>/api/cron/sync        # add ?dry=1 to preview
   ```

`.github/workflows/daily-sync.yml` is an optional second scheduler (GitHub Actions) that runs `npm run sync`. It's handy for the first Blob mirror of large files.

## Endpoints

| Path | |
|---|---|
| `/` | Gallery with search and filters (`?q=&cat=&from=&to=&sort=old`) |
| `/events/[folderId]?v=[videoId]` | Event page with player and playlist |
| `/api/events` | JSON of all events and the last sync report |
| `/api/cron/sync` | Daily sync (Bearer `CRON_SECRET`) |
| `/api/revalidate` | POST, refreshes pages after a local sync (Bearer `CRON_SECRET`) |
