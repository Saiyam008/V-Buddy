# GRE Vocabulary Flashcard Web Application

## Overview
A Flask-based web app for GRE vocabulary revision with Learn mode, Revise mode, cross-list search, and persistent progress tracking.

## Project Structure
- `app.py` — Flask backend with SQLite storage
- `requirements.txt` — Pure Flask deps (no external DB driver needed)
- `templates/login.html` — Login page
- `templates/index.html` — Main app (selection, learn, flashcards, dashboard, search)
- `static/css/style.css` — All styles
- `static/js/app.js` — Frontend logic
- `UpdatedLists/list1.py … list14.py` — Vocabulary word lists
- `data/word_states.db` — SQLite database (auto-created, gitignored)

## Local run
```bash
pip install -r requirements.txt
python app.py
```

## Features
- **Login** — session lasts 60 days; users can sign in or create an account
- **Learn mode** — browse groups sorted by word count desc, then alphabetically
- **Revise mode** — flashcard quiz with Known / Flagged / Skip, filter by status
- **Search** — live cross-list word search with group + list results
- **Dashboard** — per-list progress stats
- **Persistent storage** — SQLite

## API Endpoints
- `GET/POST /login`, `GET /logout`
- `GET /api/lists`
- `GET /api/learn-data?lists=List+1,List+2`
- `GET /api/search?q=query`
- `POST /api/start-session`
- `POST /api/update-word-state`
- `GET /api/dashboard`
- `POST /api/reset-progress`
