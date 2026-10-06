# DroneSeva — Full-Stack Local Setup

Run the whole pipeline on your own machine: upload drone photos → build an orthomosaic →
detect garbage → auto-create a ticket in the ticketing dashboard.

## What you're running

| #   | Service                                              | Repo / source                                     | Port | Needs                         |
| --- | ---------------------------------------------------- | ------------------------------------------------- | ---- | ----------------------------- |
| 1   | **WebODM** (photogrammetry, Docker)                  | https://github.com/WebODM/WebODM                  | 8000 | Docker Desktop                |
| 2   | **Python detection sidecar** (FastAPI + Faster-RCNN) | this repo, `python/`                              | 8001 | Python 3.11, model file       |
| 3   | **DroneSeva-Portal** (Next.js)                       | https://github.com/Kirito-012/Drone-Seva (`main`) | 3010 | Node 20+                      |
| 4   | **TCSticket** (ticket dashboard, Next.js)            | https://github.com/Kirito-012/TCSticket (`main`)  | 3000 | Node 20+, MongoDB, Cloudinary |

Flow: Portal → WebODM (builds the orthophoto) → Portal → sidecar (detects garbage) → Portal → TCSticket (creates the ticket).

## 0. Get these from the project owner (not on GitHub)

1. **Model files** — a zip containing these two files, keeping the folder structure:
   ```
   model/faster_2026-07-25_train/6_1785026794/20260726_004928/best_coco_bbox_mAP_50_epoch_12.pth
   model/faster_2026-07-25_train/6_1785026794/20260726_004928/vis_data/config.py
   ```
   Unzip it into the **root of the DroneSeva-Portal repo** so the `model/` folder sits next to `package.json`.
2. **TCSticket secrets**: `MONGODB_URI`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `INTEGRATION_API_KEY`. (Or use your own free MongoDB Atlas cluster and Cloudinary account; any random string works for `INTEGRATION_API_KEY` as long as both apps use the same one.)

## 1. Prerequisites

- **Git**, **Node.js 20+** (24 tested), **Python 3.11**
- **Docker Desktop** (WSL2 backend on Windows) — for WebODM
- **NVIDIA GPU + recent driver** is recommended for detection (tested on a GTX 1650). No GPU? Set `GARBAGE_DEVICE=cpu` in step 4 — it works but is much slower.
- ~15 GB free disk (Docker images + model + Python packages)

Clone everything into one folder:

```bash
mkdir DroneSeva && cd DroneSeva
git clone https://github.com/Kirito-012/Drone-Seva.git DroneSeva-Portal
git clone https://github.com/Kirito-012/TCSticket.git
git clone https://github.com/WebODM/WebODM.git
```

(Make sure `main` is checked out in both app repos: `git checkout main`.)

## 2. WebODM (port 8000)

> WebODM is not part of our repos. It is the open-source project cloned from GitHub (https://github.com/WebODM/WebODM) and runs **locally in Docker** on your machine.

Start Docker Desktop first and wait until it says "running", then:

```bash
cd WebODM
docker compose up -d        # first run pulls several GB — be patient
```

Open http://localhost:8000, create the admin account on first visit (e.g. `admin@webodm` + a password you choose) and remember it — the Portal logs in with it.
Check it works: `docker ps` should list `webapp`, `worker`, `node-odx-1`, `broker`, `db`.

## 3. TCSticket (port 3000)

```bash
cd TCSticket
npm install
```

Create `TCSticket/.env.local`:

```env
MONGODB_URI=<from owner>
AUTH_SECRET=<any random 32+ char string, e.g. run: openssl rand -base64 32>
SEED_ADMIN_EMAIL=admin@thecraftsync.local
SEED_ADMIN_PASSWORD=<choose a password>
INTEGRATION_API_KEY=<from owner, or choose one — must match step 5>
DRONESEVA_PORTAL_ORIGIN=http://localhost:3010
CLOUDINARY_CLOUD_NAME=<from owner>
CLOUDINARY_API_KEY=<from owner>
CLOUDINARY_API_SECRET=<from owner>
```

Seed roles and the admin account (skip if the shared database is already seeded), then run:

```bash
npm run seed
npm run dev
```

http://localhost:3000 → sign in with the seeded admin. The seed also creates `manager@test.local` and `agent@test.local` test accounts.

## 4. Python detection sidecar (port 8001)

```bash
cd DroneSeva-Portal
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate

# order matters: torch first, then mmcv, then the rest
pip install torch==2.1.0 torchvision==0.16.0 --index-url https://download.pytorch.org/whl/cu121
pip install mmcv==2.1.0 -f https://download.openmmlab.com/mmcv/dist/cu121/torch2.1.0/index.html
pip install -r python/requirements.txt
```

Start it (leave the terminal open):

```bash
python -m uvicorn server:app --app-dir python --host 127.0.0.1 --port 8001
```

No NVIDIA GPU? Set it first: PowerShell `$env:GARBAGE_DEVICE="cpu"` · bash `export GARBAGE_DEVICE=cpu`.
Healthy when you see `Model loaded in …s`. Check: http://127.0.0.1:8001/health

## 5. DroneSeva-Portal (port 3010)

```bash
cd DroneSeva-Portal
npm install
```

Create `DroneSeva-Portal/.env`:

```env
WEBODM_URL=http://localhost:8000
WEBODM_USERNAME=<WebODM admin email from step 2>
WEBODM_PASSWORD=<WebODM admin password from step 2>

DATABASE_URL=file:./dev.db
SESSION_SECRET=<any random 32+ char string>

ADMIN_EMAIL=admin@droneseva.local
ADMIN_PASSWORD=<choose a password>
VIEWER_EMAIL=viewer@droneseva.local
VIEWER_PASSWORD=<choose a password>

GARBAGE_SIDECAR_URL=http://127.0.0.1:8001
APP_URL=http://localhost:3010

TCS_TICKET_API_URL=http://localhost:3000
TCS_TICKET_API_KEY=<same value as INTEGRATION_API_KEY in step 3>
```

Create the local database, seed the logins and run:

```bash
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run dev -- -p 3010
```

http://localhost:3010 → sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` (super-admin: full access; the viewer account is read-only).

## 6. Try the full flow

1. In the Portal (3010), create a project and upload drone photos (JPGs with GPS EXIF; 20+ overlapping images work best).
2. Wait for **Processing images…** to finish — the orthomosaic appears on the map.
3. Click the garbage-analysis action. When it completes with detections, a PDF report is generated and a ticket appears in TCSticket (3000) with a "View in DroneSeva" link.

## Start order (every time)

Docker Desktop → WebODM (`docker compose up -d`) → sidecar (8001) → TCSticket (3000) → Portal (3010).

## Troubleshooting

| Symptom                                                         | Fix                                                                                                                                                                                |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker Desktop won't start (WSL error)                          | Quit it, run `wsl --shutdown`, reopen; reboot if it persists                                                                                                                       |
| Portal can't reach WebODM / login fails                         | Check `docker ps`; confirm `WEBODM_USERNAME/PASSWORD` match the WebODM admin                                                                                                       |
| `Model loaded` never appears / file not found                   | `model/…/best_coco_bbox_mAP_50_epoch_12.pth` and `vis_data/config.py` must exist under the Portal repo root                                                                        |
| `mmcv` import / `_ext` errors                                   | The mmcv wheel must match torch 2.1.0 + CUDA 12.1 (step 4 order). On CPU-only machines use the cpu wheel index: `…/mmcv/dist/cpu/torch2.1.0/index.html` and torch from `…/whl/cpu` |
| CUDA out of memory                                              | Close other GPU apps or use `GARBAGE_DEVICE=cpu`                                                                                                                                   |
| No ticket created                                               | `TCS_TICKET_API_KEY` must equal TCSticket's `INTEGRATION_API_KEY`; TCSticket must be running on 3000                                                                               |
| Port already in use                                             | Stop the other app on that port; keep Portal 3010 / TCSticket 3000 or update the `*_URL` / `APP_URL` / `DRONESEVA_PORTAL_ORIGIN` values to match                                   |
| Windows: "insufficient system resources" while starting servers | Start services one at a time rather than all at once                                                                                                                               |
