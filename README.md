# אשר חיון · אירועים

**Live:** https://asherhayoun.com (also https://asher-events.vercel.app)

Video gallery of a music teacher's events (בר מצוה, ברית מילה, שבע ברכות, …), built from a Google Drive folder.

- **Next.js 16** (App Router, RTL Hebrew) hosted on **Vercel**, code on **GitHub**
- **Live from Drive**: pages merge the saved events with the Drive folder (listing cached 1 h), so uploads show up within the hour, or **immediately with the "עדכון מהדרייב" button** in the footer (password: `SYNC_PASSWORD` env var)
- **Daily sync**: a GitHub Action reads the Drive folder every morning, writes new events to `data/`, commits, and the push makes Vercel redeploy. No database and no secrets needed while the folder is shared "Anyone with the link".
- Search by text and date range, then narrow down by media type (video / audio / images), category, and a weighted cloud of the words in the titles; all shareable via the URL
- Videos play from Drive (or natively from **Vercel Blob** if the optional mirror is on)

## How the Drive folder maps to the site

```
events/                              ← DRIVE_ROOT_FOLDER_ID
├── בר מצוה/                          ← category (folder name = category name on the site)
│   ├── בר מצוה 2024 גבעת זעב/        ← event (folder name = title)
│   │   ├── סקסופון.mp4              ← video (file name = song title)
│   │   └── ילדים שרים.mp4
│   └── בר מצווה של תלמיד 2024/
├── כלי נגינה/
│   └── סקסופון/
│       └── והיא שעמדה.mp3           ← audio recordings work too
└── הכנסת ספר תורה/
    └── רקודים 01.mp4                ← media directly in a category = one event named like the category
```

- **Sub-category** = a folder inside a category (e.g. `כלי נגינה / סקסופון`). Without sub-folders it is one event
  of the same name; if it holds folders, each of them is an event of that sub-category.
- **Category** = the folder directly under the root. New category folders appear on the site automatically;
  their icon comes from keywords in `src/lib/categories.ts` (🎵 when nothing matches).
- **Event** = a folder inside a category. Its videos/recordings, including those in deeper sub-folders, are its items.
- **Date**: a year in the event folder name (e.g. `סוכות 2024`), otherwise the earliest file's timestamp.
- **Moving** an event folder to another category keeps its page link and its "חדש" date (Drive ids don't change).
- **Corrections**: `data/overrides.json`, keyed by event folder id: set `title`, `date`, `datePrecision`, `location`, `description`, or `hidden`.
- Empty folders are skipped until they contain a video or recording. Files placed directly in the root are ignored.

So the teacher's workflow is: **open (or create) a category folder, create an event folder in it, drop the files in.**
It shows up within the hour, or right away with the "עדכון מהדרייב" button, marked "חדש" for 30 days.

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
| `/` | Gallery: text + date search, then media type → category → sub-category → title words (`?q=&type=video|audio|image&cat=&sub=&tags=&from=&to=`), newest first |
| `/events/[folderId]?v=[videoId]` | Event page with player and playlist |
| `/api/sync` | POST `{ password }`: the header button. Checks Drive now and expires the cached listing |
| `/api/events` | JSON of all events and the last sync report |
| `/api/cron/sync` | Sync into Redis, only if Redis is configured (Bearer `CRON_SECRET`) |
| `/api/revalidate` | POST, refreshes pages after a local sync (Bearer `CRON_SECRET`) |
