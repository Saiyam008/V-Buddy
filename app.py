"""
GRE Vocabulary Flashcard Web Application
Flask backend for interactive vocabulary revision
"""
import os
import random
import sqlite3
from datetime import timedelta
from functools import wraps
from pathlib import Path

from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__,
            static_folder=os.path.join(os.path.dirname(__file__), 'static'),
            static_url_path='/static',
            template_folder=os.path.join(os.path.dirname(__file__), 'templates'))
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

app.secret_key = os.environ.get('SECRET_KEY', 'gre-vocab-secret-key-2024')
app.permanent_session_lifetime = timedelta(days=60)
# SameSite=None + Secure needed for proxied environments (HF Spaces, Replit)
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True

VALID_USERNAME = os.environ.get('APP_USERNAME', 'saiyam')
VALID_PASSWORD = os.environ.get('APP_PASSWORD', 'saiyam')

UPDATED_LISTS_DIR = Path(__file__).parent / "UpdatedLists"

# ── Database path ─────────────────────────────────────────────────────────────
# Use /data if available (HF Spaces persistent storage), else local ./data
_data_dir = Path("/data") if Path("/data").exists() and os.access("/data", os.W_OK) else Path(__file__).parent / "data"
_data_dir.mkdir(parents=True, exist_ok=True)
DB_PATH = _data_dir / "word_states.db"

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.info(f"Using database at: {DB_PATH}")


# ── SQLite helpers ────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def ensure_schema():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS word_states (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                username    TEXT NOT NULL,
                list_name   TEXT NOT NULL,
                word_key    TEXT NOT NULL,
                state       TEXT NOT NULL DEFAULT 'unattempted',
                group_name  TEXT NOT NULL,
                updated_at  TEXT DEFAULT (datetime('now')),
                UNIQUE(username, list_name, word_key)
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ws_user      ON word_states(username)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ws_user_list ON word_states(username, list_name)")
        conn.commit()


ensure_schema()


# ── Word list loading ──────────────────────────────────────────────────────────

def load_all_lists():
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
                logger.error(f"Error loading {list_file}: {e}")
    return lists


ALL_LISTS = load_all_lists()


# ── DB operations ──────────────────────────────────────────────────────────────

def load_word_states_db(username, list_names=None):
    """Return { list_name: { word_key: {state, group} } }"""
    states = {}
    with get_db() as conn:
        if list_names:
            placeholders = ",".join("?" * len(list_names))
            rows = conn.execute(
                f"SELECT list_name, word_key, state, group_name FROM word_states "
                f"WHERE username=? AND list_name IN ({placeholders})",
                [username] + list(list_names)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT list_name, word_key, state, group_name FROM word_states WHERE username=?",
                (username,)
            ).fetchall()
    for row in rows:
        ln = row["list_name"]
        if ln not in states:
            states[ln] = {}
        states[ln][row["word_key"]] = {"state": row["state"], "group": row["group_name"]}
    return states


def upsert_word_state_db(username, list_name, word_key, state, group_name):
    with get_db() as conn:
        conn.execute("""
            INSERT INTO word_states (username, list_name, word_key, state, group_name, updated_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(username, list_name, word_key)
            DO UPDATE SET state=excluded.state,
                          group_name=excluded.group_name,
                          updated_at=datetime('now')
        """, (username, list_name, word_key, state, group_name))
        conn.commit()


def bulk_insert_defaults(username, entries):
    """Insert (list_name, word_key, group_name) as 'unattempted' if not exists."""
    if not entries:
        return
    with get_db() as conn:
        conn.executemany("""
            INSERT OR IGNORE INTO word_states (username, list_name, word_key, state, group_name)
            VALUES (?, ?, ?, 'unattempted', ?)
        """, [(username, ln, wk, gn) for ln, wk, gn in entries])
        conn.commit()


def reset_progress_db(username):
    with get_db() as conn:
        conn.execute("DELETE FROM word_states WHERE username=?", (username,))
        conn.commit()


def get_word_states_for_session(username, selected_lists):
    existing = load_word_states_db(username, selected_lists)
    to_insert = []
    for list_name in selected_lists:
        if list_name not in existing:
            existing[list_name] = {}
        if list_name in ALL_LISTS:
            for group_name, words in ALL_LISTS[list_name].items():
                for word in words:
                    word_key = f"{group_name}||{word}"
                    if word_key not in existing[list_name]:
                        existing[list_name][word_key] = {"state": "unattempted", "group": group_name}
                        to_insert.append((list_name, word_key, group_name))
    bulk_insert_defaults(username, to_insert)
    return existing


# ── Auth ───────────────────────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('logged_in'):
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({"error": "Unauthorized"}), 401
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated


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
        error = 'Invalid username or password.'
    return render_template('login.html', error=error)


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


# ── Main ───────────────────────────────────────────────────────────────────────

@app.route('/')
@login_required
def index():
    return render_template('index.html', username=session.get('username', ''))


# ── API ────────────────────────────────────────────────────────────────────────

@app.route('/api/lists')
@login_required
def get_lists():
    return jsonify({"lists": list(ALL_LISTS.keys()), "total": len(ALL_LISTS)})


@app.route('/api/learn-data')
@login_required
def get_learn_data():
    lists_param = request.args.get('lists', '')
    selected_lists = [l.strip() for l in lists_param.split(',') if l.strip()] if lists_param else []
    if not selected_lists:
        return jsonify({"error": "No lists specified"}), 400
    result = {ln: dict(ALL_LISTS[ln]) for ln in selected_lists if ln in ALL_LISTS}
    return jsonify({"data": result, "selected_lists": selected_lists})


@app.route('/api/search')
@login_required
def search_words():
    query = request.args.get('q', '').strip().lower()
    if not query:
        return jsonify({"results": [], "query": query})
    results = []
    for list_name, groups in ALL_LISTS.items():
        for group_name, words in groups.items():
            for word in words:
                if query in word.lower():
                    results.append({"word": word, "group": group_name, "list": list_name})
    results.sort(key=lambda x: (not x['word'].lower().startswith(query), x['word'].lower()))
    return jsonify({"results": results, "query": query, "total": len(results)})


@app.route('/api/start-session', methods=['POST'])
@login_required
def start_session():
    username = session['username']
    data = request.json
    selected_lists = data.get('lists', [])
    filters = data.get('filters', {'known': True, 'flagged': True, 'unmarked': True})
    if not selected_lists:
        return jsonify({"error": "No lists selected"}), 400

    word_states = get_word_states_for_session(username, selected_lists)

    all_words = [
        {"list": ln, "word": word, "group": gn}
        for ln in selected_lists if ln in ALL_LISTS
        for gn, words in ALL_LISTS[ln].items()
        for word in words
    ]

    filtered_words = []
    for w in all_words:
        wk = f"{w['group']}||{w['word']}"
        state = word_states.get(w['list'], {}).get(wk, {}).get('state', 'unattempted')
        if ((state == 'known'       and filters.get('known', True)) or
            (state == 'flagged'     and filters.get('flagged', True)) or
            (state == 'unattempted' and filters.get('unmarked', True))):
            filtered_words.append(w)

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
    username = session['username']
    data = request.json
    list_name = data.get('list')
    word      = data.get('word')
    group     = data.get('group')
    state     = data.get('state')
    if not all([list_name, word, group, state]):
        return jsonify({"error": "Missing required fields"}), 400
    upsert_word_state_db(username, list_name, f"{group}||{word}", state, group)
    return jsonify({"success": True})


@app.route('/api/dashboard')
@login_required
def get_dashboard():
    username = session['username']
    all_states = load_word_states_db(username)
    dashboard = {}
    for list_name in sorted(ALL_LISTS.keys()):
        known = flagged = unattempted = total = 0
        for group_name, words in ALL_LISTS[list_name].items():
            for word in words:
                total += 1
                state = all_states.get(list_name, {}).get(f"{group_name}||{word}", {}).get('state', 'unattempted')
                if state == 'known':       known += 1
                elif state == 'flagged':   flagged += 1
                else:                      unattempted += 1
        dashboard[list_name] = {
            "total": total, "known": known, "flagged": flagged,
            "unattempted": unattempted,
            "percentage_known": round((known / total * 100) if total > 0 else 0, 1)
        }
    return jsonify(dashboard)


@app.route('/api/reset-progress', methods=['POST'])
@login_required
def reset_progress():
    reset_progress_db(session['username'])
    return jsonify({"success": True})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 7860))
    app.run(debug=False, host='0.0.0.0', port=port)
