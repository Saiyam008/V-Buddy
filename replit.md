# GRE Vocabulary Flashcard Web Application

## Overview
A Flask-based web app for GRE vocabulary revision with Learn mode, Revise mode, cross-list search, and persistent progress tracking.

## Project Structure
- `app.py` — Flask backend with SQLite storage
- `Dockerfile` — Hugging Face Spaces (Docker SDK) deployment config
- `requirements.txt` — Pure Flask deps (no external DB driver needed)
- `templates/login.html` — Login page
- `templates/index.html` — Main app (selection, learn, flashcards, dashboard, search)
- `static/css/style.css` — All styles
- `static/js/app.js` — Frontend logic
- `UpdatedLists/list1.py … list14.py` — Vocabulary word lists
- `data/word_states.db` — SQLite database (auto-created, gitignored)

## Running on Replit (dev)
The workflow runs `PORT=5000 python app.py` — port 5000 is required for the Replit webview.

## Running on Hugging Face Spaces
- SDK: Docker (`sdk: docker`, `app_port: 7860` in README.md front-matter)
- Port defaults to `7860` when `PORT` env var is not set
- SQLite DB stored at `/data/word_states.db` if HF persistent storage is enabled, otherwise `./data/word_states.db`
- Credentials can be overridden via Space secrets: `APP_USERNAME`, `APP_PASSWORD`, `SECRET_KEY`

## Local / Docker run
```bash
pip install -r requirements.txt
python app.py            # http://localhost:7860

docker build -t gre-vocab .
docker run -p 7860:7860 gre-vocab
```

## Features
- **Login** — session lasts 60 days; credentials via env vars or defaults (saiyam/saiyam)
- **Learn mode** — browse groups sorted by word count desc, then alphabetically
- **Revise mode** — flashcard quiz with Known / Flagged / Skip, filter by status
- **Search** — live cross-list word search with group + list results
- **Dashboard** — per-list progress stats
- **Persistent storage** — SQLite, works with HF persistent storage at `/data`

## API Endpoints
- `GET/POST /login`, `GET /logout`
- `GET /api/lists`
- `GET /api/learn-data?lists=List+1,List+2`
- `GET /api/search?q=query`
- `POST /api/start-session`
- `POST /api/update-word-state`
- `GET /api/dashboard`
- `POST /api/reset-progress`
