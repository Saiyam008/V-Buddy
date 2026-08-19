---
title: GRE Vocabulary Flashcard
emoji: 📚
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# GRE Vocabulary Flashcard Web Application

A modern, interactive web application for GRE vocabulary revision with two study modes, cross-list search, and persistent progress tracking.

## Features

**📖 Learn Mode**
- Browse vocabulary organised by word groups
- Groups sorted by size (largest first), then alphabetically
- Expand / collapse individual groups
- Works across one or multiple lists simultaneously

**🧠 Revise Mode**
- Flashcard-style quiz with randomly shuffled words
- Mark words as: Known (✓), Flagged (🚩), or Skipped (⊘)
- Filter by word status before starting
- Progress saved permanently per user

**🔍 Search**
- Live search across all 14 word lists
- Results show word, list name, and group

**📊 Dashboard**
- Per-list progress: Known / Flagged / Unattempted counts
- Visual progress bars and percentage completion

## Local Development

```bash
pip install -r requirements.txt
python app.py          # runs on http://localhost:7860
```

Or with Docker:

```bash
docker build -t gre-vocab .
docker run -p 7860:7860 gre-vocab
```

## File Structure

```
├── app.py                  # Flask backend (SQLite storage)
├── requirements.txt
├── templates/
│   ├── index.html          # Main app
│   └── login.html          # Login page
├── static/
│   ├── css/style.css
│   └── js/app.js
└── UpdatedLists/
    ├── list1.py … list14.py
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/lists` | All available lists |
| GET | `/api/learn-data?lists=List+1,List+2` | Word groups for Learn mode |
| GET | `/api/search?q=query` | Search across all lists |
| POST | `/api/start-session` | Start a Revise session |
| POST | `/api/update-word-state` | Save a word's state |
| GET | `/api/dashboard` | Progress statistics |
| POST | `/api/reset-progress` | Clear all progress |

## Keyboard Shortcuts (Revise mode)

| Key | Action |
|---|---|
| `←` / `→` | Previous / Next word |
| `Space` | Reveal word group |
