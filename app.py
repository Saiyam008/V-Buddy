"""
GRE Vocabulary Flashcard Web Application
Flask backend for interactive vocabulary revision
"""
import json
import os
import sys
import random
from pathlib import Path

# Fix for Anaconda Jinja2 import issue
if 'anaconda' in sys.executable.lower():
    # Remove Anaconda from path temporarily
    import site
    site.PREFIXES.insert(0, os.path.dirname(sys.executable))

from markupsafe import Markup
from flask import Flask, render_template, request, jsonify

# Initialize Flask with correct static folder configuration
app = Flask(__name__, 
            static_folder=os.path.join(os.path.dirname(__file__), 'static'),
            static_url_path='/static',
            template_folder=os.path.join(os.path.dirname(__file__), 'templates'))

# Configuration
UPDATED_LISTS_DIR = Path(__file__).parent / "UpdatedLists"
DATA_DIR = Path(__file__).parent / "data"
STATE_FILE = DATA_DIR / "word_states.json"

# Ensure data directory exists
DATA_DIR.mkdir(exist_ok=True)

# Verify static files exist (for debugging)
import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

@app.before_request
def before_request():
    """Log request info"""
    logger.debug(f"Request: {request.method} {request.path}")
    if request.path.startswith('/static'):
        logger.debug(f"Static file requested: {request.path}")

# Load all word lists
def load_all_lists():
    """Load all list files from UpdatedLists directory"""
    lists = {}
    for i in range(1, 15):
        list_file = UPDATED_LISTS_DIR / f"list{i}.py"
        if list_file.exists():
            try:
                # Read and execute the Python file to extract the list
                with open(list_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                # Create a namespace to execute in
                namespace = {}
                exec(content, namespace)
                # Get the list{i} variable
                list_var = f"list{i}"
                if list_var in namespace:
                    lists[f"List {i}"] = namespace[list_var]
            except Exception as e:
                print(f"Error loading {list_file}: {e}")
    return lists

# Load initial lists
ALL_LISTS = load_all_lists()

def load_word_states():
    """Load saved word states from file"""
    if STATE_FILE.exists():
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_word_states(states):
    """Save word states to file"""
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(states, f, indent=2, ensure_ascii=False)

def get_word_states_for_lists(selected_lists):
    """Get or create word states for selected lists"""
    all_states = load_word_states()
    
    # Create states for new words if they don't exist
    for list_name in selected_lists:
        if list_name not in all_states:
            all_states[list_name] = {}
        
        if list_name in ALL_LISTS:
            for group_name, words in ALL_LISTS[list_name].items():
                for word in words:
                    word_key = f"{group_name}||{word}"
                    if word_key not in all_states[list_name]:
                        all_states[list_name][word_key] = {
                            "state": "unattempted",  # unattempted, known, flagged
                            "group": group_name
                        }
    
    save_word_states(all_states)
    return all_states

@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')

@app.route('/api/lists')
def get_lists():
    """Get all available lists"""
    return jsonify({
        "lists": list(ALL_LISTS.keys()),
        "total": len(ALL_LISTS)
    })

@app.route('/api/start-session', methods=['POST'])
def start_session():
    """Start a study session with selected lists and filters"""
    data = request.json
    selected_lists = data.get('lists', [])
    filters = data.get('filters', {'known': True, 'flagged': True, 'unmarked': True})
    
    if not selected_lists:
        return jsonify({"error": "No lists selected"}), 400
    
    # Get all words from selected lists
    all_words = []
    for list_name in selected_lists:
        if list_name in ALL_LISTS:
            for group_name, words in ALL_LISTS[list_name].items():
                for word in words:
                    all_words.append({
                        "list": list_name,
                        "word": word,
                        "group": group_name
                    })
    
    # Get current states to filter words
    word_states = get_word_states_for_lists(selected_lists)
    
    # Filter words based on selected filters
    filtered_words = []
    for word in all_words:
        word_key = f"{word['group']}||{word['word']}"
        
        # Check word state
        if word['list'] in word_states and word_key in word_states[word['list']]:
            state = word_states[word['list']][word_key].get('state')
        else:
            state = 'unattempted'
        
        # Include word if its state is in selected filters
        include = False
        if state == 'known' and filters.get('known', True):
            include = True
        elif state == 'flagged' and filters.get('flagged', True):
            include = True
        elif state == 'unattempted' and filters.get('unmarked', True):
            include = True
        
        if include:
            filtered_words.append(word)
    
    # Shuffle words
    random.shuffle(filtered_words)
    
    return jsonify({
        "total_words": len(filtered_words),
        "words": filtered_words,
        "states": word_states,
        "selected_lists": selected_lists
    })

@app.route('/api/update-word-state', methods=['POST'])
def update_word_state():
    """Update the state of a word (known, flagged, unattempted)"""
    data = request.json
    list_name = data.get('list')
    word = data.get('word')
    group = data.get('group')
    state = data.get('state')  # 'known', 'flagged', 'unattempted'
    
    if not all([list_name, word, group, state]):
        return jsonify({"error": "Missing required fields"}), 400
    
    all_states = load_word_states()
    
    if list_name not in all_states:
        all_states[list_name] = {}
    
    word_key = f"{group}||{word}"
    all_states[list_name][word_key] = {
        "state": state,
        "group": group
    }
    
    save_word_states(all_states)
    
    return jsonify({"success": True})

@app.route('/api/dashboard')
def get_dashboard():
    """Get dashboard statistics for all lists"""
    all_states = load_word_states()
    dashboard = {}
    
    for list_name in sorted(ALL_LISTS.keys()):
        known = 0
        flagged = 0
        unattempted = 0
        total = 0
        
        if list_name in ALL_LISTS:
            for group_name, words in ALL_LISTS[list_name].items():
                for word in words:
                    total += 1
                    word_key = f"{group_name}||{word}"
                    
                    if list_name in all_states and word_key in all_states[list_name]:
                        state = all_states[list_name][word_key].get("state")
                        if state == "known":
                            known += 1
                        elif state == "flagged":
                            flagged += 1
                        else:
                            unattempted += 1
                    else:
                        unattempted += 1
        
        dashboard[list_name] = {
            "total": total,
            "known": known,
            "flagged": flagged,
            "unattempted": unattempted,
            "percentage_known": round((known / total * 100) if total > 0 else 0, 1)
        }
    
    return jsonify(dashboard)

@app.route('/api/reset-progress', methods=['POST'])
def reset_progress():
    """Reset all progress"""
    if STATE_FILE.exists():
        STATE_FILE.unlink()
    return jsonify({"success": True})

if __name__ == '__main__':
    import os
    # Use port 7860 for Hugging Face Spaces, fallback to 5000 for local
    port = int(os.environ.get('PORT', 7860))
    # Only use debug mode if running locally
    debug = os.environ.get('FLASK_ENV') == 'development'
    app.run(debug=debug, host='0.0.0.0', port=port)
