// Global State
let appState = {
    currentScreen: 'selection', // selection, flashcard, dashboard
    allLists: [],
    selectedLists: [],
    selectedFilters: {
        known: true,
        flagged: true,
        unmarked: true
    },
    currentSession: null,
    currentWordIndex: 0,
    wordStates: {},
    selectedListsData: null
};

// Initialize App
document.addEventListener('DOMContentLoaded', async function() {
    await loadAvailableLists();
    setupEventListeners();
});

// Load Available Lists
async function loadAvailableLists() {
    try {
        showSpinner();
        const response = await fetch('/api/lists');
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

// Populate List Checkboxes
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

// Update List Selection
function updateListSelection() {
    const checkboxes = document.querySelectorAll('#listCheckboxes input[type="checkbox"]');
    appState.selectedLists = [];

    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            appState.selectedLists.push(checkbox.value);
        }
    });

    // Update UI
    const selectedCount = appState.selectedLists.length;
    document.getElementById('selectedCount').textContent = 
        `${selectedCount} list${selectedCount !== 1 ? 's' : ''} selected`;

    // Calculate total words
    let totalWords = 0;
    appState.allLists.forEach(list => {
        if (appState.selectedLists.includes(list)) {
            // This is approximate; actual count from backend
            totalWords += Math.floor(Math.random() * 200 + 100); // Placeholder
        }
    });

    const startBtn = document.getElementById('startBtn');
    startBtn.disabled = selectedCount === 0;

    if (selectedCount > 0) {
        document.getElementById('totalWordsCount').textContent = 
            `Ready to study!`;
    }
}

// Update Filter Selection
function updateFilterSelection() {
    appState.selectedFilters = {
        known: document.getElementById('filterKnown').checked,
        flagged: document.getElementById('filterFlagged').checked,
        unmarked: document.getElementById('filterUnmarked').checked
    };
}

// Start Study Session
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
            body: JSON.stringify({ 
                lists: appState.selectedLists,
                filters: appState.selectedFilters
            })
        });

        const data = await response.json();
        
        appState.currentSession = {
            words: data.words,
            totalWords: data.total_words,
            currentIndex: 0
        };
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

// Load Word
function loadWord(index) {
    if (!appState.currentSession || index < 0 || index >= appState.currentSession.words.length) {
        return;
    }

    appState.currentWordIndex = index;
    const word = appState.currentSession.words[index];

    // Update Display
    document.getElementById('wordDisplay').textContent = word.word;
    document.getElementById('groupDisplay').textContent = word.group;
    document.getElementById('currentWord').textContent = index + 1;
    document.getElementById('totalWords').textContent = appState.currentSession.totalWords;

    // Hide group info
    document.getElementById('groupInfo').classList.add('hidden');

    // Update progress bar
    const progress = ((index + 1) / appState.currentSession.totalWords) * 100;
    document.getElementById('progressFill').style.width = progress + '%';

    // Update button states
    document.getElementById('prevBtn').disabled = index === 0;
    document.getElementById('nextBtn').disabled = index === appState.currentSession.totalWords - 1;

    // Update stats
    updateStats();
}

// Reveal Group
function revealGroup() {
    document.getElementById('groupInfo').classList.remove('hidden');
}

// Mark Word
async function markWord(state) {
    const word = appState.currentSession.words[appState.currentWordIndex];

    try {
        const response = await fetch('/api/update-word-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                list: word.list,
                word: word.word,
                group: word.group,
                state: state
            })
        });

        if (response.ok) {
            // Update state
            const wordKey = `${word.group}||${word.word}`;
            if (!appState.wordStates[word.list]) {
                appState.wordStates[word.list] = {};
            }
            appState.wordStates[word.list][wordKey] = {
                state: state,
                group: word.group
            };

            // Visual feedback
            showMarkFeedback(state);

            // Move to next word automatically
            if (appState.currentWordIndex < appState.currentSession.totalWords - 1) {
                setTimeout(() => nextWord(), 800);
            }
        }
    } catch (error) {
        console.error('Error updating word state:', error);
    }
}

// Show Mark Feedback
function showMarkFeedback(state) {
    const flashcard = document.getElementById('flashcard');
    flashcard.style.animation = 'none';
    setTimeout(() => {
        flashcard.style.animation = '';
    }, 10);

    const stateColors = {
        'known': '#10b981',
        'flagged': '#f59e0b',
        'unattempted': '#6b7280'
    };

    flashcard.style.borderLeft = `5px solid ${stateColors[state]}`;
    flashcard.style.opacity = '0.8';

    setTimeout(() => {
        flashcard.style.borderLeft = 'none';
        flashcard.style.opacity = '1';
    }, 300);
}

// Navigation
function previousWord() {
    if (appState.currentWordIndex > 0) {
        loadWord(appState.currentWordIndex - 1);
    }
}

function nextWord() {
    if (appState.currentWordIndex < appState.currentSession.totalWords - 1) {
        loadWord(appState.currentWordIndex + 1);
    }
}

// Update Stats
function updateStats() {
    if (!appState.currentSession) return;

    let known = 0, flagged = 0, skipped = 0;

    appState.currentSession.words.forEach((word, index) => {
        const wordKey = `${word.group}||${word.word}`;
        if (appState.wordStates[word.list] && appState.wordStates[word.list][wordKey]) {
            const state = appState.wordStates[word.list][wordKey].state;
            if (state === 'known') known++;
            else if (state === 'flagged') flagged++;
            else if (state === 'unattempted') skipped++;
        }
    });

    document.getElementById('knownCount').textContent = known;
    document.getElementById('flaggedCount').textContent = flagged;
    document.getElementById('skippedCount').textContent = skipped;
}

// End Session
function endSession() {
    if (confirm('End study session? Your progress has been saved.')) {
        switchScreen('selection');
        appState.currentSession = null;
        appState.currentWordIndex = 0;
    }
}

// Go to Dashboard
async function goToDashboard() {
    try {
        showSpinner();
        const response = await fetch('/api/dashboard');
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

// Populate Dashboard
function populateDashboard(stats) {
    const container = document.getElementById('dashboardStats');
    container.innerHTML = '';

    Object.entries(stats).forEach(([listName, stat]) => {
        const percentage = stat.percentage_known;
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
            <div class="stat-title">${listName}</div>
            <div class="stat-row">
                <span class="stat-label">Total Words</span>
                <span class="stat-value">${stat.total}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Known</span>
                <span class="stat-value known">${stat.known}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Flagged</span>
                <span class="stat-value flagged">${stat.flagged}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Unattempted</span>
                <span class="stat-value">${stat.unattempted}</span>
            </div>
            <div class="stat-progress">
                <div class="stat-progress-label">Progress: ${percentage}%</div>
                <div class="stat-progress-bar">
                    <div class="stat-progress-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Go Back to Selection
function goToSelection() {
    switchScreen('selection');
}

// Reset Progress
function resetProgressConfirm() {
    document.getElementById('confirmMessage').textContent = 
        'This will clear all your progress. This action cannot be undone.';
    document.getElementById('confirmBtn').onclick = async () => {
        await resetProgress();
        closeConfirm();
    };
    document.getElementById('confirmModal').classList.remove('hidden');
}

async function resetProgress() {
    try {
        showSpinner();
        const response = await fetch('/api/reset-progress', { method: 'POST' });
        if (response.ok) {
            alert('All progress has been cleared!');
            location.reload();
        }
    } catch (error) {
        console.error('Error resetting progress:', error);
        alert('Error resetting progress');
    } finally {
        hideSpinner();
    }
}

// Screen Management
function switchScreen(screen) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    // Show selected screen
    const screenEl = document.getElementById(screen + 'Screen');
    if (screenEl) {
        screenEl.classList.add('active');
    }

    appState.currentScreen = screen;

    // Update navbar visibility
    // Dashboard button always visible except during flashcard session
    document.getElementById('dashboardBtn').style.display = 
        screen === 'dashboard' ? 'none' : 'block';
    
    // Reset button only visible on dashboard
    document.getElementById('resetBtn').style.display = 
        screen === 'dashboard' ? 'block' : 'none';
}

// Utility Functions
function showSpinner() {
    document.getElementById('loadingSpinner').classList.remove('hidden');
}

function hideSpinner() {
    document.getElementById('loadingSpinner').classList.add('hidden');
}

function closeConfirm() {
    document.getElementById('confirmModal').classList.add('hidden');
}

// Setup Event Listeners
function setupEventListeners() {
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (appState.currentScreen !== 'flashcard') return;

        if (e.key === 'ArrowLeft') previousWord();
        if (e.key === 'ArrowRight') nextWord();
        if (e.key === ' ') {
            e.preventDefault();
            revealGroup();
        }
    });
}

// Auto-save is handled by each state update through the API
