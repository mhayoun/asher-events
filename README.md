# אשר חיון · אירועים

**Live:** https://asher-events.vercel.app

Video gallery of a music teacher's events (בר מצוה, ברית מילה, שבע ברכות, …), built from a Google Drive folder.

- **Next.js 16** (App Router, RTL Hebrew) hosted on **Vercel**, code on **GitHub**
- **Live from Drive**: pages merge the saved events with the Drive folder (listing cached 1 h), so uploads show up within the hour, or **immediately with the "עדכון מהדרייב" button** in the header (password: `SYNC_PASSWORD` env var)
- **Daily sync**: a GitHub Action reads the Drive folder every morning, writes new events to `data/`, commits, and the push makes Vercel redeploy. No database and no secrets needed while the folder is shared "Anyone with the link".
- Search by text (event title *and* song/video names, Hebrew-spelling tolerant), category, year, or date range, all shareable via the URL
- Videos play from Drive (or natively from **Vercel Blob** if the optional mirror is on)

## How the Drive folder maps to the site

```
events/                         ← DRIVE_ROOT_FOLDER_ID
├── בר מצוה 2024 גבעת זעב/       ← one event (folder name = title)
│   ├── סקסופון.mp4             ← one video (file name = song title)
│   └── ילדים שרים.mp4
└── שבע ברכות גבעת זאב/
```

- **Category**: keywords in the folder and file names (`src/lib/categories.ts`). An event can have several.
  If nothing matches, a **new category is created from the folder title**: years and numbers are dropped and the
  title is cut before "who / where" words (`משפחת`, `של`, `עם`, `באולם`, a place like `במירון`, …), so
  `יום הולדת 40 משפחת כהן 2026` → **יום הולדת**. Later folders containing the same words join that category.
  To give it an icon or merge it with others, add it to `CATEGORIES`, or fix a single event in `data/overrides.json`.
- **Date**: a year in the folder name (e.g. `סוכות 2024`), otherwise the earliest video's timestamp.
- **Corrections**: `data/overrides.json`, keyed by folder id — set `title`, `date`, `datePrecision`, `location`, `description`, `categories`, or `hidden`.
- Empty folders are skipped until they contain a video.

So the teacher's workflow is: **create a folder in Drive, drop the videos in.** It shows up on the site the next morning, marked "חדש" for 30 days.

## Run locally

```bash
npm install
npm run dev                    # http://localhost:3000
```

### Check Drive for new events from your machine

```bash
npm run sync:check             # dry run: lists new events / videos, changes nothing
npm run sync                   # Drive -> data/events.json (review with git diff)
npm run sync:publish           # sync, then commit + push data/ -> Vercel redeploys
npm run sync -- --snapshot     # rebuild data/events.json from data/drive-snapshot.json, offline
```

## Hosting

- **GitHub**: `.github/workflows/daily-sync.yml` runs at 04:00 UTC (07:00 Israel time in summer). To check right away, open the repo on GitHub, go to **Actions**, choose **Daily Drive sync**, then click **Run workflow**.
- **Vercel**: the project is connected to the GitHub repo, so every push to `main`, including the bot's sync commits, deploys to production.
- **Drive**: the `events` folder must stay shared as **Anyone with the link: Viewer**, both for the sync and so visitors can play videos.

### Optional extras (not needed)

| Want | Add |
|---|---|
| Official Drive API (exact file sizes and times, private folder) | `GOOGLE_API_KEY` or `GOOGLE_SERVICE_ACCOUNT_JSON` as GitHub Actions secrets |
| Instant updates without a redeploy | Redis (`KV_REST_API_URL` / `KV_REST_API_TOKEN`) in Vercel, then `/api/cron/sync` can run as a Vercel Cron |
| Native video player instead of Drive's | Vercel Blob (`BLOB_READ_WRITE_TOKEN`): the sync copies each video there |

## Endpoints

| Path | |
|---|---|
| `/` | Gallery with search and filters (`?q=&cat=&from=&to=&sort=old`) |
| `/events/[folderId]?v=[videoId]` | Event page with player and playlist |
| `/api/sync` | POST `{ password }`: the header button. Checks Drive now and expires the cached listing |
| `/api/events` | JSON of all events and the last sync report |
| `/api/cron/sync` | Sync into Redis, only if Redis is configured (Bearer `CRON_SECRET`) |
| `/api/revalidate` | POST, refreshes pages after a local sync (Bearer `CRON_SECRET`) |
