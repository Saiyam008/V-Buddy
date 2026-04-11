"""
GRE Vocabulary Flashcard Web Application
Flask backend for interactive vocabulary revision
"""
import json
import os
import sys
import random
from datetime import timedelta
from functools import wraps
from pathlib import Path

from markupsafe import Markup
from flask import Flask, render_template, request, jsonify, session, redirect, url_for

# Initialize Flask with correct static folder configuration
app = Flask(__name__, 
            static_folder=os.path.join(os.path.dirname(__file__), 'static'),
            static_url_path='/static',
            template_folder=os.path.join(os.path.dirname(__file__), 'templates'))

app.secret_key = 'gre-vocab-secret-key-2024'
app.permanent_session_lifetime = timedelta(days=60)
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True

# Hardcoded credentials
VALID_USERNAME = 'saiyam'
VALID_PASSWORD = 'saiyam'

# Configuration
UPDATED_LISTS_DIR = Path(__file__).parent / "UpdatedLists"
DATA_DIR = Path(__file__).parent / "data"
STATE_FILE = DATA_DIR / "word_states.json"

# Ensure data directory exists
DATA_DIR.mkdir(exist_ok=True)

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('logged_in'):
            if request.is_json:
                return jsonify({"error": "Unauthorized"}), 401
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated


# Load all word lists
def load_all_lists():
    """Load all list files from UpdatedLists directory"""
    lists = {}
    for i in range(1, 15):
        list_file = UPDATED_LISTS_DIR / f"list{i}.py"
        if list_file.exists():
            try:
                with open(list_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                namespace = {}
                exec(content, namespace)
                list_var = f"list{i}"
                if list_var in namespace:
                    lists[f"List {i}"] = namespace[list_var]
            except Exception as e:
                print(f"Error loading {list_file}: {e}")
    return lists


ALL_LISTS = load_all_lists()


def load_word_states():
    if STATE_FILE.exists():
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_word_states(states):
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(states, f, indent=2, ensure_ascii=False)


def get_word_states_for_lists(selected_lists):
    all_states = load_word_states()
    for list_name in selected_lists:
        if list_name not in all_states:
            all_states[list_name] = {}
        if list_name in ALL_LISTS:
            for group_name, words in ALL_LISTS[list_name].items():
                for word in words:
                    word_key = f"{group_name}||{word}"
                    if word_key not in all_states[list_name]:
                        all_states[list_name][word_key] = {
                            "state": "unattempted",
                            "group": group_name
                        }
    save_word_states(all_states)
    return all_states


# ── Auth routes ────────────────────────────────────────────────────────────────

@app.route('/login', methods=['GET', 'POST'])
def login():
    if session.get('logged_in'):
        return redirect(url_for('index'))
    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        if username == VALID_USERNAME and password == VALID_PASSWORD:
            session.permanent = True
            session['logged_in'] = True
            session['username'] = username
            return redirect(url_for('index'))
        else:
            error = 'Invalid username or password.'
    return render_template('login.html', error=error)


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


# ── Main routes ────────────────────────────────────────────────────────────────

@app.route('/')
@login_required
def index():
    return render_template('index.html', username=session.get('username', ''))


# ── API routes ─────────────────────────────────────────────────────────────────

@app.route('/api/lists')
@login_required
def get_lists():
    return jsonify({
        "lists": list(ALL_LISTS.keys()),
        "total": len(ALL_LISTS)
    })


@app.route('/api/search')
@login_required
def search_words():
    """Search for a word across all lists"""
    query = request.args.get('q', '').strip().lower()
    if not query:
        return jsonify({"results": [], "query": query})

    results = []
    for list_name, groups in ALL_LISTS.items():
        for group_name, words in groups.items():
            for word in words:
                if query in word.lower():
                    results.append({
                        "word": word,
                        "group": group_name,
                        "list": list_name
                    })

    results.sort(key=lambda x: (not x['word'].lower().startswith(query), x['word'].lower()))
    return jsonify({"results": results, "query": query, "total": len(results)})


@app.route('/api/start-session', methods=['POST'])
@login_required
def start_session():
    data = request.json
    selected_lists = data.get('lists', [])
    filters = data.get('filters', {'known': True, 'flagged': True, 'unmarked': True})

    if not selected_lists:
        return jsonify({"error": "No lists selected"}), 400

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

    word_states = get_word_states_for_lists(selected_lists)

    filtered_words = []
    for word in all_words:
        word_key = f"{word['group']}||{word['word']}"
        if word['list'] in word_states and word_key in word_states[word['list']]:
            state = word_states[word['list']][word_key].get('state')
        else:
            state = 'unattempted'

        include = False
        if state == 'known' and filters.get('known', True):
            include = True
        elif state == 'flagged' and filters.get('flagged', True):
            include = True
        elif state == 'unattempted' and filters.get('unmarked', True):
            include = True

        if include:
            filtered_words.append(word)

    random.shuffle(filtered_words)

    return jsonify({
        "total_words": len(filtered_words),
        "words": filtered_words,
        "states": word_states,
        "selected_lists": selected_lists
    })


@app.route('/api/update-word-state', methods=['POST'])
@login_required
def update_word_state():
    data = request.json
    list_name = data.get('list')
    word = data.get('word')
    group = data.get('group')
    state = data.get('state')

    if not all([list_name, word, group, state]):
        return jsonify({"error": "Missing required fields"}), 400

    all_states = load_word_states()
    if list_name not in all_states:
        all_states[list_name] = {}

    word_key = f"{group}||{word}"
    all_states[list_name][word_key] = {"state": state, "group": group}
    save_word_states(all_states)

    return jsonify({"success": True})


@app.route('/api/dashboard')
@login_required
def get_dashboard():
    all_states = load_word_states()
    dashboard = {}

    for list_name in sorted(ALL_LISTS.keys()):
        known = flagged = unattempted = total = 0
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
@login_required
def reset_progress():
    if STATE_FILE.exists():
        STATE_FILE.unlink()
    return jsonify({"success": True})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    app.run(debug=debug, host='0.0.0.0', port=port)
