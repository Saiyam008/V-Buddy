// Global State
let appState = {
    currentScreen: 'selection',
    previousScreen: 'selection',
    allLists: [],
    selectedLists: [],
    selectedFilters: { known: true, flagged: true, unmarked: true },
    currentSession: null,
    currentWordIndex: 0,
    wordStates: {},
    searchDebounceTimer: null
};

// Initialize App
document.addEventListener('DOMContentLoaded', async function () {
    await loadAvailableLists();
    setupEventListeners();
});

// ── List Loading ──────────────────────────────────────────────────────────────

async function loadAvailableLists() {
    try {
        showSpinner();
        const response = await fetch('/api/lists');
        if (response.status === 401) { location.href = '/login'; return; }
        const data = await response.json();
        appState.allLists = data.lists || [];
        populateListCheckboxes();
    } catch (error) {
        console.error('Error loading lists:', error);
        alert('Error loading lists. Please refresh the page.');
    } finally {
        hideSpinner();
    }
}

function populateListCheckboxes() {
    const container = document.getElementById('listCheckboxes');
    container.innerHTML = '';
    appState.allLists.forEach(list => {
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        div.innerHTML = `
            <input type="checkbox" id="${list}" value="${list}" onchange="updateListSelection()">
            <label for="${list}">${list}</label>
        `;
        container.appendChild(div);
    });
}

function updateListSelection() {
    const checkboxes = document.querySelectorAll('#listCheckboxes input[type="checkbox"]');
    appState.selectedLists = [];
    checkboxes.forEach(cb => { if (cb.checked) appState.selectedLists.push(cb.value); });

    const n = appState.selectedLists.length;
    document.getElementById('selectedCount').textContent = `${n} list${n !== 1 ? 's' : ''} selected`;
    document.getElementById('startBtn').disabled = n === 0;
    if (n > 0) document.getElementById('totalWordsCount').textContent = 'Ready to study!';
    else document.getElementById('totalWordsCount').textContent = '';
}

function updateFilterSelection() {
    appState.selectedFilters = {
        known:   document.getElementById('filterKnown').checked,
        flagged: document.getElementById('filterFlagged').checked,
        unmarked: document.getElementById('filterUnmarked').checked
    };
}

// ── Search ────────────────────────────────────────────────────────────────────

let searchDebounce = null;

function handleSearchInput(value) {
    clearTimeout(searchDebounce);
    const dropdown = document.getElementById('searchDropdown');

    if (!value.trim()) {
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
        return;
    }

    searchDebounce = setTimeout(async () => {
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`);
            if (response.status === 401) { location.href = '/login'; return; }
            const data = await response.json();
            renderSearchDropdown(data.results, data.query, data.total);
        } catch (e) {
            console.error('Search error:', e);
        }
    }, 280);
}

function handleSearchKey(event) {
    if (event.key === 'Enter') {
        const query = document.getElementById('searchInput').value.trim();
        if (query) openSearchScreen(query);
    }
    if (event.key === 'Escape') {
        document.getElementById('searchDropdown').classList.add('hidden');
    }
}

function renderSearchDropdown(results, query, total) {
    const dropdown = document.getElementById('searchDropdown');
    dropdown.innerHTML = '';

    if (results.length === 0) {
        dropdown.innerHTML = `<div class="search-dropdown-empty">No words found for "<strong>${escapeHtml(query)}</strong>"</div>`;
        dropdown.classList.remove('hidden');
        return;
    }

    const preview = results.slice(0, 6);
    preview.forEach(r => {
        const item = document.createElement('div');
        item.className = 'search-dropdown-item';
        item.innerHTML = `
            <div class="word-text">${highlightMatch(r.word, query)}</div>
            <div class="word-meta">${escapeHtml(r.list)} &middot; ${escapeHtml(r.group)}</div>
        `;
        item.addEventListener('click', () => {
            document.getElementById('searchDropdown').classList.add('hidden');
            openSearchScreen(query);
        });
        dropdown.appendChild(item);
    });

    if (total > 6) {
        const footer = document.createElement('div');
        footer.className = 'search-dropdown-footer';
        footer.textContent = `See all ${total} results`;
        footer.addEventListener('click', () => openSearchScreen(query));
        dropdown.appendChild(footer);
    }

    dropdown.classList.remove('hidden');
}

async function openSearchScreen(query) {
    document.getElementById('searchDropdown').classList.add('hidden');
    try {
        showSpinner();
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        renderSearchScreen(data.results, data.query, data.total);
        appState.previousScreen = appState.currentScreen;
        switchScreen('search');
    } catch (e) {
        console.error('Search error:', e);
    } finally {
        hideSpinner();
    }
}

function renderSearchScreen(results, query, total) {
    document.getElementById('searchResultCount').textContent = `${total} result${total !== 1 ? 's' : ''}`;
    document.getElementById('searchQueryLabel').textContent = `Showing results for: "${query}"`;

    const grid = document.getElementById('searchResultsGrid');
    grid.innerHTML = '';

    if (results.length === 0) {
        grid.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">🔍</div>
                <p>No words found matching "<strong>${escapeHtml(query)}</strong>"</p>
            </div>`;
        return;
    }

    results.forEach(r => {
        const card = document.createElement('div');
        card.className = 'search-result-card';
        card.innerHTML = `
            <div class="search-result-word">${highlightMatch(r.word, query)}</div>
            <div class="search-result-meta">
                <div class="meta-item">
                    <span class="meta-label">List:</span>
                    <span class="meta-value list-badge">${escapeHtml(r.list)}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">Group:</span>
                    <span class="meta-value">${escapeHtml(r.group)}</span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function closeSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchDropdown').classList.add('hidden');
    switchScreen(appState.previousScreen || 'selection');
}

// ── Session ───────────────────────────────────────────────────────────────────

async function startSession() {
    if (appState.selectedLists.length === 0) {
        alert('Please select at least one list');
        return;
    }

    try {
        showSpinner();
        const response = await fetch('/api/start-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lists: appState.selectedLists, filters: appState.selectedFilters })
        });

        if (response.status === 401) { location.href = '/login'; return; }
        const data = await response.json();

        appState.currentSession = { words: data.words, totalWords: data.total_words, currentIndex: 0 };
        appState.wordStates = data.states;
        appState.currentWordIndex = 0;

        switchScreen('flashcard');
        loadWord(0);
    } catch (error) {
        console.error('Error starting session:', error);
        alert('Error starting session');
    } finally {
        hideSpinner();
    }
}

// ── Flashcard ─────────────────────────────────────────────────────────────────

function loadWord(index) {
    if (!appState.currentSession || index < 0 || index >= appState.currentSession.words.length) return;

    appState.currentWordIndex = index;
    const word = appState.currentSession.words[index];

    document.getElementById('wordDisplay').textContent = word.word;
    document.getElementById('groupDisplay').textContent = word.group;
    document.getElementById('currentWord').textContent = index + 1;
    document.getElementById('totalWords').textContent = appState.currentSession.totalWords;
    document.getElementById('groupInfo').classList.add('hidden');

    const progress = ((index + 1) / appState.currentSession.totalWords) * 100;
    document.getElementById('progressFill').style.width = progress + '%';

    document.getElementById('prevBtn').disabled = index === 0;
    document.getElementById('nextBtn').disabled = index === appState.currentSession.totalWords - 1;

    updateStats();
}

function revealGroup() {
    document.getElementById('groupInfo').classList.remove('hidden');
}

async function markWord(state) {
    const word = appState.currentSession.words[appState.currentWordIndex];
    try {
        const response = await fetch('/api/update-word-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ list: word.list, word: word.word, group: word.group, state })
        });

        if (response.ok) {
            const wordKey = `${word.group}||${word.word}`;
            if (!appState.wordStates[word.list]) appState.wordStates[word.list] = {};
            appState.wordStates[word.list][wordKey] = { state, group: word.group };
            showMarkFeedback(state);
            if (appState.currentWordIndex < appState.currentSession.totalWords - 1) {
                setTimeout(() => nextWord(), 800);
            }
        }
    } catch (error) {
        console.error('Error updating word state:', error);
    }
}

function showMarkFeedback(state) {
    const flashcard = document.getElementById('flashcard');
    const colors = { known: '#10b981', flagged: '#f59e0b', unattempted: '#6b7280' };
    flashcard.style.borderLeft = `5px solid ${colors[state]}`;
    flashcard.style.opacity = '0.8';
    setTimeout(() => { flashcard.style.borderLeft = 'none'; flashcard.style.opacity = '1'; }, 300);
}

function previousWord() { if (appState.currentWordIndex > 0) loadWord(appState.currentWordIndex - 1); }
function nextWord() {
    if (appState.currentWordIndex < appState.currentSession.totalWords - 1)
        loadWord(appState.currentWordIndex + 1);
}

function updateStats() {
    if (!appState.currentSession) return;
    let known = 0, flagged = 0, skipped = 0;
    appState.currentSession.words.forEach(word => {
        const wordKey = `${word.group}||${word.word}`;
        if (appState.wordStates[word.list] && appState.wordStates[word.list][wordKey]) {
            const s = appState.wordStates[word.list][wordKey].state;
            if (s === 'known') known++;
            else if (s === 'flagged') flagged++;
            else if (s === 'unattempted') skipped++;
        }
    });
    document.getElementById('knownCount').textContent = known;
    document.getElementById('flaggedCount').textContent = flagged;
    document.getElementById('skippedCount').textContent = skipped;
}

function endSession() {
    if (confirm('End study session? Your progress has been saved.')) {
        switchScreen('selection');
        appState.currentSession = null;
        appState.currentWordIndex = 0;
    }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

async function goToDashboard() {
    try {
        showSpinner();
        const response = await fetch('/api/dashboard');
        if (response.status === 401) { location.href = '/login'; return; }
        const data = await response.json();
        populateDashboard(data);
        switchScreen('dashboard');
    } catch (error) {
        console.error('Error loading dashboard:', error);
        alert('Error loading dashboard');
    } finally {
        hideSpinner();
    }
}

function populateDashboard(stats) {
    const container = document.getElementById('dashboardStats');
    container.innerHTML = '';
    Object.entries(stats).forEach(([listName, stat]) => {
        const pct = stat.percentage_known;
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
            <div class="stat-title">${listName}</div>
            <div class="stat-row"><span class="stat-label">Total Words</span><span class="stat-value">${stat.total}</span></div>
            <div class="stat-row"><span class="stat-label">Known</span><span class="stat-value known">${stat.known}</span></div>
            <div class="stat-row"><span class="stat-label">Flagged</span><span class="stat-value flagged">${stat.flagged}</span></div>
            <div class="stat-row"><span class="stat-label">Unattempted</span><span class="stat-value">${stat.unattempted}</span></div>
            <div class="stat-progress">
                <div class="stat-progress-label">Progress: ${pct}%</div>
                <div class="stat-progress-bar"><div class="stat-progress-fill" style="width:${pct}%"></div></div>
            </div>`;
        container.appendChild(card);
    });
}

function goToSelection() { switchScreen('selection'); }

// ── Reset ─────────────────────────────────────────────────────────────────────

function resetProgressConfirm() {
    document.getElementById('confirmMessage').textContent = 'This will clear all your progress. This action cannot be undone.';
    document.getElementById('confirmBtn').onclick = async () => { await resetProgress(); closeConfirm(); };
    document.getElementById('confirmModal').classList.remove('hidden');
}

async function resetProgress() {
    try {
        showSpinner();
        const response = await fetch('/api/reset-progress', { method: 'POST' });
        if (response.ok) { alert('All progress has been cleared!'); location.reload(); }
    } catch (error) {
        console.error('Error resetting progress:', error);
        alert('Error resetting progress');
    } finally {
        hideSpinner();
    }
}

// ── Screen Management ─────────────────────────────────────────────────────────

function switchScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(screen + 'Screen');
    if (el) el.classList.add('active');
    appState.currentScreen = screen;

    document.getElementById('dashboardBtn').style.display = screen === 'dashboard' ? 'none' : 'block';
    document.getElementById('resetBtn').style.display = screen === 'dashboard' ? 'block' : 'none';
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function showSpinner() { document.getElementById('loadingSpinner').classList.remove('hidden'); }
function hideSpinner() { document.getElementById('loadingSpinner').classList.add('hidden'); }
function closeConfirm() { document.getElementById('confirmModal').classList.add('hidden'); }

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function highlightMatch(word, query) {
    const escaped = escapeHtml(word);
    const q = escapeHtml(query);
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
        const dropdown = document.getElementById('searchDropdown');
        if (dropdown) dropdown.classList.add('hidden');
    }
});

// Keyboard navigation
function setupEventListeners() {
    document.addEventListener('keydown', (e) => {
        if (appState.currentScreen !== 'flashcard') return;
        if (e.key === 'ArrowLeft') previousWord();
        if (e.key === 'ArrowRight') nextWord();
        if (e.key === ' ') { e.preventDefault(); revealGroup(); }
    });
}
