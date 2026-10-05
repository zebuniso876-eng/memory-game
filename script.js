(() => {
  'use strict';

  const CARD_SYMBOLS = [
    { name: 'Sun', emoji: '☀️', color: '#f59e0b' },
    { name: 'Moon', emoji: '🌙', color: '#6366f1' },
    { name: 'Star', emoji: '⭐', color: '#eab308' },
    { name: 'Flower', emoji: '🌸', color: '#ec4899' },
    { name: 'Leaf', emoji: '🍃', color: '#22c55e' },
    { name: 'Heart', emoji: '❤️', color: '#ef4444' },
    { name: 'Cloud', emoji: '☁️', color: '#38bdf8' },
    { name: 'Rainbow', emoji: '🌈', color: '#8b5cf6' }
  ];

  const LEADERBOARD_KEY = 'memory-game-leaderboard';
  const HIDE_DELAY = 900;

  const state = {
    cards: [],
    firstCard: null,
    secondCard: null,
    moves: 0,
    pairs: 0,
    isLocked: false,
    isGameOver: false,
    hideTimer: null,
    winningResultSaved: false
  };

  const $ = (tag, options = {}) => {
    const element = document.createElement(tag);

    if (options.className) element.className = options.className;
    if (options.text) element.textContent = options.text;
    if (options.id) element.id = options.id;
    if (options.type) element.type = options.type;
    if (options.ariaLabel) element.setAttribute('aria-label', options.ariaLabel);
    if (options.role) element.setAttribute('role', options.role);

    return element;
  };

  function createImage(symbol, hidden = false) {
    const image = $('img', {
      className: 'card-image',
      ariaLabel: hidden ? 'Закрытая карточка' : symbol.name
    });

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
        <rect width="160" height="160" rx="24" fill="${symbol.color}"/>
        <circle cx="80" cy="80" r="58" fill="rgba(255,255,255,.18)"/>
        <text x="80" y="103" text-anchor="middle" font-size="68">${symbol.emoji}</text>
      </svg>
    `;

    image.src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    image.alt = hidden ? 'Закрытая карточка' : symbol.name;
    return image;
  }

  function shuffle(array) {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i -= 1) {
      const randomIndex = Math.floor(Math.random() * (i + 1));
      [result[i], result[randomIndex]] = [result[randomIndex], result[i]];
    }

    return result;
  }

  function createCard(symbol, index) {
    const button = $('button', {
      className: 'card',
      type: 'button',
      ariaLabel: 'Открыть карточку'
    });

    button.dataset.index = String(index);
    button.dataset.symbol = symbol.name;

    const inner = $('span', { className: 'card-inner' });
    const front = $('span', { className: 'card-front' });
    const back = $('span', { className: 'card-back' });

    const frontImage = createImage(symbol);
    front.append(frontImage);

    const backMark = $('span', { className: 'back-mark', text: '?' });
    back.append(backMark);

    inner.append(front, back);
    button.append(inner);

    button.addEventListener('click', () => handleCardClick(button));
    return button;
  }

  function buildApplication() {
    const app = $('div', { className: 'app' });
    const header = $('header', { className: 'header' });
    const brand = $('div', { className: 'brand' });
    const title = $('h1', { className: 'title', text: 'Memory Game' });
    const subtitle = $('p', {
      className: 'subtitle',
      text: 'Найди все 8 пар за минимальное число ходов'
    });

    brand.append(title, subtitle);

    const headerActions = $('div', { className: 'header-actions' });
    const newGameButton = $('button', {
      className: 'button button-primary',
      text: 'Новая игра',
      type: 'button'
    });
    const leaderboardButton = $('button', {
      className: 'button button-secondary',
      text: 'Таблица лидеров',
      type: 'button'
    });

    newGameButton.id = 'new-game-button';
    leaderboardButton.id = 'leaderboard-button';

    headerActions.append(newGameButton, leaderboardButton);
    header.append(brand, headerActions);

    const main = $('main', { className: 'main' });
    const stats = $('section', { className: 'stats', ariaLabel: 'Статистика игры' });

    const movesBox = $('div', { className: 'stat' });
    const movesLabel = $('span', { className: 'stat-label', text: 'Ходы' });
    const movesValue = $('strong', { className: 'stat-value', text: '0' });
    movesValue.id = 'moves';
    movesBox.append(movesLabel, movesValue);

    const pairsBox = $('div', { className: 'stat' });
    const pairsLabel = $('span', { className: 'stat-label', text: 'Найдено пар' });
    const pairsValue = $('strong', { className: 'stat-value', text: '0 / 8' });
    pairsValue.id = 'pairs';
    pairsBox.append(pairsLabel, pairsValue);

    stats.append(movesBox, pairsBox);

    const board = $('section', {
      className: 'game-board',
      ariaLabel: 'Игровое поле'
    });
    board.id = 'game-board';

    const hint = $('p', {
      className: 'hint',
      text: 'Открой две карточки и запомни их расположение.'
    });

    main.append(stats, board, hint);
    app.append(header, main);
    document.body.append(app);

    newGameButton.addEventListener('click', startNewGame);
    leaderboardButton.addEventListener('click', openLeaderboard);

    return { app, board, movesValue, pairsValue };
  }

  function createModal() {
    const overlay = $('div', {
      className: 'modal-overlay',
      role: 'presentation'
    });

    const modal = $('div', {
      className: 'modal',
      role: 'dialog'
    });

    modal.setAttribute('aria-modal', 'true');

    const closeButton = $('button', {
      className: 'modal-close',
      text: '×',
      type: 'button',
      ariaLabel: 'Закрыть'
    });

    const content = $('div', { className: 'modal-content' });
    modal.append(closeButton, content);
    overlay.append(modal);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeModal();
    });

    closeButton.addEventListener('click', closeModal);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && overlay.classList.contains('is-visible')) {
        closeModal();
      }
    });

    document.body.append(overlay);

    return { overlay, modal, content, closeButton };
  }

  const ui = buildApplication();
  const modalUI = createModal();

  function updateStats() {
    ui.movesValue.textContent = String(state.moves);
    ui.pairsValue.textContent = `${state.pairs} / 8`;
  }

  function renderBoard() {
    ui.board.replaceChildren();

    state.cards.forEach((card, index) => {
      const element = createCard(card, index);

      if (card.isOpen) {
        element.classList.add('is-open');
        element.setAttribute('aria-label', 'Открытая карточка');
      }

      if (card.isMatched) {
        element.classList.add('is-matched');
        element.setAttribute('aria-label', 'Найденная пара');
      }

      ui.board.append(element);
    });
  }

  function createDeck() {
    const duplicated = CARD_SYMBOLS.flatMap((symbol) => [
      { ...symbol, isOpen: false, isMatched: false },
      { ...symbol, isOpen: false, isMatched: false }
    ]);

    return shuffle(duplicated);
  }

  function startNewGame() {
    if (state.hideTimer !== null) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }

    closeModal();

    state.cards = createDeck();
    state.firstCard = null;
    state.secondCard = null;
    state.moves = 0;
    state.pairs = 0;
    state.isLocked = false;
    state.isGameOver = false;
    state.winningResultSaved = false;

    updateStats();
    renderBoard();
  }

  function getCardByElement(element) {
    const index = Number(element.dataset.index);
    return { card: state.cards[index], index };
  }

  function handleCardClick(element) {
    if (state.isLocked || state.isGameOver) return;

    const { card } = getCardByElement(element);

    if (!card || card.isOpen || card.isMatched) return;

    card.isOpen = true;
    element.classList.add('is-open');
    element.setAttribute('aria-label', 'Открытая карточка');

    if (state.firstCard === null) {
      state.firstCard = card;
      return;
    }

    if (state.firstCard === card) return;

    state.secondCard = card;
    state.moves += 1;
    updateStats();

    checkPair();
  }

  function getCardElement(card) {
    const elements = ui.board.querySelectorAll('.card');

    for (const element of elements) {
      const index = Number(element.dataset.index);
      if (state.cards[index] === card) return element;
    }

    return null;
  }

  function checkPair() {
    const first = state.firstCard;
    const second = state.secondCard;

    if (first.name === second.name) {
      first.isMatched = true;
      second.isMatched = true;
      state.pairs += 1;

      const firstElement = getCardElement(first);
      const secondElement = getCardElement(second);

      [firstElement, secondElement].forEach((element) => {
        if (element) {
          element.classList.add('is-matched');
          element.setAttribute('aria-label', 'Найденная пара');
        }
      });

      state.firstCard = null;
      state.secondCard = null;
      updateStats();

      if (state.pairs === 8) {
        finishGame();
      }

      return;
    }

    state.isLocked = true;

    state.hideTimer = window.setTimeout(() => {
      first.isOpen = false;
      second.isOpen = false;

      const firstElement = getCardElement(first);
      const secondElement = getCardElement(second);

      [firstElement, secondElement].forEach((element) => {
        if (element) {
          element.classList.remove('is-open');
          element.setAttribute('aria-label', 'Открыть карточку');
        }
      });

      state.firstCard = null;
      state.secondCard = null;
      state.isLocked = false;
      state.hideTimer = null;
    }, HIDE_DELAY);
  }

  function getToday() {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${date.getFullYear()}`;
  }

  function readLeaderboard() {
    try {
      const data = localStorage.getItem(LEADERBOARD_KEY);
      const parsed = data ? JSON.parse(data) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveResult() {
    if (state.winningResultSaved) return;

    const results = readLeaderboard();
    results.push({
      moves: state.moves,
      date: getToday(),
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`
    });

    results.sort((a, b) => a.moves - b.moves || a.id.localeCompare(b.id));
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(results.slice(0, 10)));

    state.winningResultSaved = true;
  }

  function finishGame() {
    state.isGameOver = true;
    state.isLocked = true;
    saveResult();

    window.setTimeout(() => {
      showVictoryModal();
    }, 350);
  }

  function clearModalContent() {
    modalUI.content.replaceChildren();
  }

  function openModal() {
    modalUI.overlay.classList.add('is-visible');
    document.body.classList.add('modal-open');
    modalUI.closeButton.focus();
  }

  function closeModal() {
    modalUI.overlay.classList.remove('is-visible');
    document.body.classList.remove('modal-open');
  }

  function showVictoryModal() {
    clearModalContent();

    const icon = $('div', { className: 'modal-icon', text: '🏆' });
    const title = $('h2', { className: 'modal-title', text: 'Победа!' });
    const message = $('p', {
      className: 'modal-message',
      text: `Все 8 пар найдены за ${state.moves} ход${getRussianPlural(state.moves)}.`
    });

    const actions = $('div', { className: 'modal-actions' });
    const newGame = $('button', {
      className: 'button button-primary',
      text: 'Новая игра',
      type: 'button'
    });
    const close = $('button', {
      className: 'button button-secondary',
      text: 'Закрыть',
      type: 'button'
    });

    newGame.addEventListener('click', startNewGame);
    close.addEventListener('click', closeModal);

    actions.append(newGame, close);
    modalUI.content.append(icon, title, message, actions);
    openModal();
  }

  function getRussianPlural(number) {
    const n = Math.abs(number) % 100;
    if (n >= 11 && n <= 19) return 'ов';
    const last = n % 10;
    if (last === 1) return '';
    if (last >= 2 && last <= 4) return 'а';
    return 'ов';
  }

  function showEmptyLeaderboard() {
    const message = $('p', {
      className: 'empty-message',
      text: 'Пока нет завершённых игр.'
    });
    modalUI.content.append(message);
  }

  function showLeaderboardTable(results) {
    const table = $('table', { className: 'leaderboard-table' });
    const caption = $('caption', { className: 'sr-only', text: 'Таблица лучших результатов' });

    const thead = $('thead');
    const headerRow = $('tr');
    ['Место', 'Ходы', 'Дата'].forEach((text) => {
      headerRow.append($('th', { text }));
    });
    thead.append(headerRow);

    const tbody = $('tbody');

    results.forEach((result, index) => {
      const row = $('tr');
      row.append(
        $('td', { text: String(index + 1) }),
        $('td', { text: String(result.moves) }),
        $('td', { text: result.date })
      );
      tbody.append(row);
    });

    table.append(caption, thead, tbody);
    modalUI.content.append(table);
  }

  function openLeaderboard() {
    clearModalContent();

    const icon = $('div', { className: 'modal-icon', text: '🏅' });
    const title = $('h2', { className: 'modal-title', text: 'Таблица лидеров' });
    modalUI.content.append(icon, title);

    const results = readLeaderboard();

    if (results.length === 0) {
      showEmptyLeaderboard();
    } else {
      showLeaderboardTable(results);
    }

    const actions = $('div', { className: 'modal-actions' });
    const close = $('button', {
      className: 'button button-secondary',
      text: 'Закрыть',
      type: 'button'
    });
    close.addEventListener('click', closeModal);
    actions.append(close);
    modalUI.content.append(actions);

    openModal();
  }

  startNewGame();
})();
