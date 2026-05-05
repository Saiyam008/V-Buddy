// Global State
let appState = {
    currentScreen: 'selection',
    previousScreen: 'selection',
    allLists: [],
    selectedLists: [],
    selectedFilters: { known: true, flagged: true, unmarked: true },
    currentSession: null,
    currentWordIndex: 0,
    wordStates: {}
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
    document.getElementById('learnBtn').disabled  = n === 0;
    document.getElementById('reviseBtn').disabled = n === 0;
    document.getElementById('totalWordsCount').textContent = n > 0 ? 'Choose a mode below to begin' : '';
}

function updateFilterSelection() {
    appState.selectedFilters = {
        known:    document.getElementById('filterKnown').checked,
        flagged:  document.getElementById('filterFlagged').checked,
        unmarked: document.getElementById('filterUnmarked').checked
    };
}

// ── Learn Mode ────────────────────────────────────────────────────────────────

async function startLearnMode() {
    if (appState.selectedLists.length === 0) return;
    try {
        showSpinner();
        const qs = appState.selectedLists.map(encodeURIComponent).join(',');
        const response = await fetch(`/api/learn-data?lists=${qs}`);
        if (response.status === 401) { location.href = '/login'; return; }
        const data = await response.json();
        renderLearnScreen(data.data, data.selected_lists);
        switchScreen('learn');
    } catch (e) {
        console.error('Error loading learn data:', e);
        alert('Error loading learn data');
    } finally {
        hideSpinner();
    }
}

function renderLearnScreen(data, selectedLists) {
    // Subtitle
    const subtitle = document.getElementById('learnSubtitle');
    subtitle.textContent = selectedLists.length === 1
        ? selectedLists[0]
        : `${selectedLists.length} lists selected`;

    const body = document.getElementById('learnBody');
    body.innerHTML = '';

    // Count totals
    let totalGroups = 0, totalWords = 0;
    selectedLists.forEach(listName => {
        if (data[listName]) {
            const groups = Object.keys(data[listName]);
            totalGroups += groups.length;
            groups.forEach(g => { totalWords += data[listName][g].length; });
        }
    });

    // Summary bar
    const summary = document.createElement('div');
    summary.className = 'learn-summary';
    summary.innerHTML = `
        <span class="learn-stat"><strong>${selectedLists.length}</strong> List${selectedLists.length !== 1 ? 's' : ''}</span>
        <span class="learn-stat-sep">·</span>
        <span class="learn-stat"><strong>${totalGroups}</strong> Groups</span>
        <span class="learn-stat-sep">·</span>
        <span class="learn-stat"><strong>${totalWords}</strong> Words</span>
    `;
    body.appendChild(summary);

    // Render each list
    selectedLists.forEach(listName => {
        if (!data[listName]) return;
        const groups = data[listName];

        // List section header (only shown when multiple lists)
        if (selectedLists.length > 1) {
            const listHeader = document.createElement('div');
            listHeader.className = 'learn-list-header';
            const groupCount = Object.keys(groups).length;
            const wordCount  = Object.values(groups).reduce((s, w) => s + w.length, 0);
            listHeader.innerHTML = `
                <h3 class="learn-list-title">📚 ${escapeHtml(listName)}</h3>
                <span class="learn-list-meta">${groupCount} groups · ${wordCount} words</span>
            `;
            body.appendChild(listHeader);
        }

        // Render groups
        const groupsContainer = document.createElement('div');
        groupsContainer.className = 'learn-groups';

        const sortedGroups = Object.entries(groups).sort(([nameA, wordsA], [nameB, wordsB]) => {
            if (wordsB.length !== wordsA.length) return wordsB.length - wordsA.length;
            return nameA.localeCompare(nameB);
        });

        sortedGroups.forEach(([groupName, words], idx) => {
            const card = document.createElement('div');
            card.className = 'learn-group-card';
            card.dataset.groupId = `${listName}-${idx}`;

            const header = document.createElement('div');
            header.className = 'learn-group-header';
            header.innerHTML = `
                <div class="learn-group-left">
                    <span class="learn-group-toggle">▶</span>
                    <span class="learn-group-name">${escapeHtml(groupName)}</span>
                </div>
                <span class="learn-group-count">${words.length} word${words.length !== 1 ? 's' : ''}</span>
            `;

            const wordList = document.createElement('div');
            wordList.className = 'learn-word-list collapsed';

            words.forEach(word => {
                const chip = document.createElement('div');
                chip.className = 'learn-word-chip';
                chip.textContent = word;
                wordList.appendChild(chip);
            });

            header.addEventListener('click', () => toggleGroup(card, wordList, header));
            card.appendChild(header);
            card.appendChild(wordList);
            groupsContainer.appendChild(card);
        });

        body.appendChild(groupsContainer);
    });
}

function toggleGroup(card, wordList, header) {
    const isOpen = !wordList.classList.contains('collapsed');
    const toggle  = header.querySelector('.learn-group-toggle');
    if (isOpen) {
        wordList.classList.add('collapsed');
        toggle.textContent = '▶';
        card.classList.remove('open');
    } else {
        wordList.classList.remove('collapsed');
        toggle.textContent = '▼';
        card.classList.add('open');
    }
}

function expandAllGroups() {
    document.querySelectorAll('.learn-word-list').forEach(wl => wl.classList.remove('collapsed'));
    document.querySelectorAll('.learn-group-toggle').forEach(t => t.textContent = '▼');
    document.querySelectorAll('.learn-group-card').forEach(c => c.classList.add('open'));
}

function collapseAllGroups() {
    document.querySelectorAll('.learn-word-list').forEach(wl => wl.classList.add('collapsed'));
    document.querySelectorAll('.learn-group-toggle').forEach(t => t.textContent = '▶');
    document.querySelectorAll('.learn-group-card').forEach(c => c.classList.remove('open'));
}

// ── Revise (Flashcard) Mode ───────────────────────────────────────────────────

async function startReviseMode() {
    if (appState.selectedLists.length === 0) return;
    try {
        showSpinner();
        const response = await fetch('/api/start-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lists: appState.selectedLists, filters: appState.selectedFilters })
        });
        if (response.status === 401) { location.href = '/login'; return; }
        const data = await response.json();

        if (data.total_words === 0) {
            alert('No words match the selected filters. Try enabling more filters.');
            return;
        }

        appState.currentSession = { words: data.words, totalWords: data.total_words };
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

    document.getElementById('wordDisplay').textContent  = word.word;
    document.getElementById('groupDisplay').textContent = word.group;
    document.getElementById('currentWord').textContent  = index + 1;
    document.getElementById('totalWords').textContent   = appState.currentSession.totalWords;
    document.getElementById('groupInfo').classList.add('hidden');

    const pct = ((index + 1) / appState.currentSession.totalWords) * 100;
    document.getElementById('progressFill').style.width = pct + '%';

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
        const key = `${word.group}||${word.word}`;
        if (appState.wordStates[word.list]?.[key]) {
            const s = appState.wordStates[word.list][key].state;
            if (s === 'known') known++;
            else if (s === 'flagged') flagged++;
            else if (s === 'unattempted') skipped++;
        }
    });
    document.getElementById('knownCount').textContent   = known;
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
    } finally {
        hideSpinner();
    }
}

function populateDashboard(stats) {
    const container = document.getElementById('dashboardStats');
    container.innerHTML = '';
    Object.entries(stats).forEach(([listName, stat]) => {
        const pct  = stat.percentage_known;
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

// ── Reset ─────────────────────────────────────────────────────────────────────

function resetProgressConfirm() {
    document.getElementById('confirmMessage').textContent = 'This will clear all your progress. This action cannot be undone.';
    document.getElementById('confirmBtn').onclick = async () => { await doResetProgress(); closeConfirm(); };
    document.getElementById('confirmModal').classList.remove('hidden');
}

async function doResetProgress() {
    try {
        showSpinner();
        const response = await fetch('/api/reset-progress', { method: 'POST' });
        if (response.ok) { alert('All progress has been cleared!'); location.reload(); }
    } catch (error) {
        console.error('Error resetting progress:', error);
    } finally {
        hideSpinner();
    }
}

// ── Search ────────────────────────────────────────────────────────────────────

let searchDebounce = null;

function handleSearchInput(value) {
    clearTimeout(searchDebounce);
    const dropdown = document.getElementById('searchDropdown');
    if (!value.trim()) { dropdown.classList.add('hidden'); dropdown.innerHTML = ''; return; }

    searchDebounce = setTimeout(async () => {
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`);
            if (response.status === 401) { location.href = '/login'; return; }
            const data = await response.json();
            renderSearchDropdown(data.results, data.query, data.total);
        } catch (e) { console.error('Search error:', e); }
    }, 280);
}

function handleSearchKey(event) {
    if (event.key === 'Enter') {
        const q = document.getElementById('searchInput').value.trim();
        if (q) openSearchScreen(q);
    }
    if (event.key === 'Escape') document.getElementById('searchDropdown').classList.add('hidden');
}

function renderSearchDropdown(results, query, total) {
    const dropdown = document.getElementById('searchDropdown');
    dropdown.innerHTML = '';

    if (results.length === 0) {
        dropdown.innerHTML = `<div class="search-dropdown-empty">No words found for "<strong>${escapeHtml(query)}</strong>"</div>`;
        dropdown.classList.remove('hidden');
        return;
    }

    results.slice(0, 6).forEach(r => {
        const item = document.createElement('div');
        item.className = 'search-dropdown-item';
        item.innerHTML = `
            <div class="word-text">${highlightMatch(r.word, query)}</div>
            <div class="word-meta">${escapeHtml(r.list)} · ${escapeHtml(r.group)}</div>
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
    } catch (e) { console.error('Search error:', e); }
    finally { hideSpinner(); }
}

function renderSearchScreen(results, query, total) {
    document.getElementById('searchResultCount').textContent = `${total} result${total !== 1 ? 's' : ''}`;
    document.getElementById('searchQueryLabel').textContent  = `Showing results for: "${query}"`;

    const grid = document.getElementById('searchResultsGrid');
    grid.innerHTML = '';

    if (results.length === 0) {
        grid.innerHTML = `<div class="no-results"><div class="no-results-icon">🔍</div><p>No words found matching "<strong>${escapeHtml(query)}</strong>"</p></div>`;
        return;
    }

    results.forEach(r => {
        const card = document.createElement('div');
        card.className = 'search-result-card';
        card.innerHTML = `
            <div class="search-result-word">${highlightMatch(r.word, query)}</div>
            <div class="search-result-meta">
                <div class="meta-item"><span class="meta-label">List:</span><span class="meta-value list-badge">${escapeHtml(r.list)}</span></div>
                <div class="meta-item"><span class="meta-label">Group:</span><span class="meta-value">${escapeHtml(r.group)}</span></div>
            </div>`;
        grid.appendChild(card);
    });
}

function closeSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchDropdown').classList.add('hidden');
    switchScreen(appState.previousScreen || 'selection');
}

// ── Screen Management ─────────────────────────────────────────────────────────

function switchScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(screen + 'Screen');
    if (el) el.classList.add('active');
    appState.currentScreen = screen;

    document.getElementById('dashboardBtn').style.display = screen === 'dashboard' ? 'none' : 'block';
}

function goToSelection() {
    appState.currentSession = null;
    switchScreen('selection');
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function showSpinner()  { document.getElementById('loadingSpinner').classList.remove('hidden'); }
function hideSpinner()  { document.getElementById('loadingSpinner').classList.add('hidden'); }
function closeConfirm() { document.getElementById('confirmModal').classList.add('hidden'); }

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function highlightMatch(word, query) {
    const escaped = escapeHtml(word);
    const q       = escapeHtml(query);
    return escaped.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
        const dd = document.getElementById('searchDropdown');
        if (dd) dd.classList.add('hidden');
    }
});

function setupEventListeners() {
    document.addEventListener('keydown', (e) => {
        if (appState.currentScreen !== 'flashcard') return;
        if (e.key === 'ArrowLeft') previousWord();
        if (e.key === 'ArrowRight') nextWord();
        if (e.key === ' ') { e.preventDefault(); revealGroup(); }
    });
}
