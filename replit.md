# GRE Vocabulary Flashcard Web Application

## Overview
A Flask-based web application for GRE vocabulary revision using interactive flashcards, with login-protected access and cross-list word search.

## Project Structure
- `app.py` - Main Flask application with API endpoints and auth
- `templates/` - HTML templates (Jinja2)
  - `login.html` - Login page
  - `index.html` - Main app (list selection, flashcards, dashboard, search)
- `static/css/style.css` - All styles including login, search, and search results
- `static/js/app.js` - Frontend logic (flashcards, search, dashboard)
- `UpdatedLists/` - Python files containing vocabulary word lists (list1.py through list14.py)
- `data/` - Runtime data storage for word states (created automatically)

## Features
- **Login** — Hardcoded credentials (saiyam/saiyam), 2-month persistent session cookie
- **Flashcards** — Study any combination of lists, mark words known/flagged/skip
- **Dashboard** — Progress stats per list
- **Search** — Live word search across all 14 lists; results show word group and list name

## Running the Application
```bash
python app.py
```
Runs on port 5000, host 0.0.0.0.

## API Endpoints
- `GET /login` / `POST /login` — Auth
- `GET /logout` — Clear session
- `GET /` — Main page (requires login)
- `GET /api/lists` — All vocabulary lists
- `GET /api/search?q=<query>` — Search word across all lists
- `POST /api/start-session` — Start study session
- `POST /api/update-word-state` — Update word state
- `GET /api/dashboard` — Progress stats
- `POST /api/reset-progress` — Reset all progress

## Dependencies
- Flask 3.1.2, Werkzeug 3.1.5, Jinja2 3.1.6, MarkupSafe 3.0.3
