# GRE Vocabulary Flashcard Web Application

## Overview
A Flask-based web application for GRE vocabulary revision using interactive flashcards.

## Project Structure
- `app.py` - Main Flask application with API endpoints
- `templates/` - HTML templates (Jinja2)
- `static/` - CSS and JavaScript files
- `UpdatedLists/` - Python files containing vocabulary word lists (list1.py through list14.py)
- `data/` - Runtime data storage for word states (created automatically)

## Running the Application
The app runs on port 5000 and serves a web-based flashcard interface.

```bash
python app.py
```

## API Endpoints
- `GET /` - Main page
- `GET /api/lists` - Get all available vocabulary lists
- `POST /api/start-session` - Start a study session with selected lists
- `POST /api/update-word-state` - Update word state (known/flagged/unattempted)
- `GET /api/dashboard` - Get statistics for all lists
- `POST /api/reset-progress` - Reset all progress

## Dependencies
- Flask 3.1.2
- Werkzeug 3.1.5
- Jinja2 3.1.6
- MarkupSafe 3.0.3

## Recent Changes
- 2026-01-26: Configured for Replit environment (port 5000)
