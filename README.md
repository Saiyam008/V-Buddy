---
title: GRE Vocabulary Flashcard
emoji: 📚
colorFrom: blue
colorTo: purple
sdk: docker
sdk_version: "latest"
python_version: "3.9"
app_file: app.py
pinned: false
---

# GRE Vocabulary Flashcard Web Application

A modern, interactive web-based flashcard application for GRE vocabulary revision. Features beautiful UI, smart state tracking, and comprehensive progress analytics.

## Features

✨ **Interactive Flashcards**
- Randomly shuffled words from selected lists
- One-click word group reveal
- Clean, modern card-based interface
- Keyboard navigation support (← → arrow keys, Space to reveal)

📊 **State Tracking**
- Mark words as: Known (✓), Flagged (🚩), or Skipped (⊘)
- Automatic state persistence
- Progress saved with every interaction
- Single-user persistent storage

📈 **Dashboard & Analytics**
- View progress for each individual list
- See counts: Total, Known, Flagged, Unattempted
- Visual progress bars for each list
- Overall completion percentages

🎯 **Smart Features**
- Multi-list selection (single or multiple)
- Next/Previous navigation with disabled states at boundaries
- Session progress tracking
- Real-time statistics during study
- Option to reset all progress

## Installation

### Prerequisites
- Python 3.8+
- pip (Python package manager)

### Setup

1. **Install Dependencies**
```bash
pip install -r requirements.txt
```

2. **Run the Application**
```bash
python app.py
```

3. **Access the App**
Open your browser and navigate to:
```
http://localhost:5000
```

## Usage

### Starting a Session
1. Select one or multiple word lists from the selection screen
2. Click "Start Study Session"

### During Study
- **Click the flashcard** to reveal the word group
- **Mark the word** using three buttons:
  - 🚩 **Flag** - Words you want to review later (orange)
  - ✓ **Known** - Words you're confident about (green)
  - ⊘ **Skip** - Words you haven't attempted (gray)
- **Navigate** using Previous/Next buttons or arrow keys
- **View stats** at the bottom (Known, Flagged, Skipped counts)
- **Exit** the session anytime to go back to selection

### Dashboard
- Access via "Dashboard" button in navbar
- See detailed progress for each list:
  - Total words
  - Known count
  - Flagged count
  - Unattempted count
  - Progress percentage
- Option to clear all progress (cannot be undone)

## File Structure

```
Vocab_Code/
├── app.py                      # Flask backend application
├── requirements.txt            # Python dependencies
├── README.md                   # This file
├── templates/
│   └── index.html             # Main HTML template
├── static/
│   ├── css/
│   │   └── style.css          # Complete styling
│   └── js/
│       └── app.js             # Frontend logic
├── data/
│   └── word_states.json       # Persistent storage (auto-created)
└── UpdatedLists/
    ├── list1.py
    ├── list2.py
    └── ... (list3 through list14)
```

## Data Storage

All word states are automatically saved to `data/word_states.json` in the following format:

```json
{
  "List 1": {
    "Group Name||word": {
      "state": "known|flagged|unattempted",
      "group": "Group Name"
    }
  }
}
```

## API Endpoints

### GET `/api/lists`
Returns all available lists

**Response:**
```json
{
  "lists": ["List 1", "List 2", ...],
  "total": 14
}
```

### POST `/api/start-session`
Starts a new study session with selected lists

**Request:**
```json
{
  "lists": ["List 1", "List 2"]
}
```

**Response:**
```json
{
  "total_words": 450,
  "words": [
    {
      "list": "List 1",
      "word": "word",
      "group": "Group Name"
    }
  ],
  "states": { ... }
}
```

### POST `/api/update-word-state`
Updates the state of a word

**Request:**
```json
{
  "list": "List 1",
  "word": "word",
  "group": "Group Name",
  "state": "known|flagged|unattempted"
}
```

### GET `/api/dashboard`
Returns statistics for all lists

**Response:**
```json
{
  "List 1": {
    "total": 30,
    "known": 15,
    "flagged": 5,
    "unattempted": 10,
    "percentage_known": 50.0
  }
}
```

### POST `/api/reset-progress`
Clears all saved progress

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` Left Arrow | Previous word |
| `→` Right Arrow | Next word |
| `Space` | Reveal word group |

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (responsive design)

## Deployment

### Hugging Face Spaces

To deploy on Hugging Face Spaces:

1. Create a new Space with "Docker" runtime
2. Upload your project files
3. Create a `Dockerfile`:

```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "app.py"]
```

4. Update `app.py` to listen on all interfaces:
```python
if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=7860)
```

## Tips for Best Experience

📚 **Study Tips**
- Start with smaller list selections for focused revision
- Flag challenging words for targeted review
- Use the dashboard to track your progress
- Revisit flagged words regularly

⚙️ **Settings**
- Adjust the number of words per session by limiting list selection
- Data persists automatically, no manual save needed
- Clear progress only when starting fresh

## Troubleshooting

### Lists not loading
- Ensure all `list{1-14}.py` files exist in `UpdatedLists/` folder
- Check that files contain a variable named `list{n}` with word groups

### Port already in use
```bash
# Use a different port
python -c "from app import app; app.run(port=5001)"
```

### Data not saving
- Ensure `data/` directory exists and is writable
- Check browser console for errors (F12)

## Future Enhancements

- Spaced repetition algorithm
- Timed study sessions
- Audio pronunciation
- Multi-language support
- Study statistics graphs
- User accounts (multi-user version)

## License

This project is created for personal GRE preparation use.

## Support

For issues or suggestions, please check the console logs (F12 in browser) for debugging information.

---

**Happy Studying! 📚✨**
