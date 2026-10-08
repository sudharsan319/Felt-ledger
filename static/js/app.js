(() => {
  const STORAGE_KEY = 'felt-poker-ledger-v1';
  const currency = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
  const $ = (id) => document.getElementById(id);
  const dateLabel = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
  let history = [];
  let data = load();
  let toastTimer;
  let leaderboardMode = 'current';

  function freshSession() { return { name: 'Friday night game', date: dateLabel, cashRate: 20, chipRate: 1000, startingStack: 1000, rebuyLimit: 0, denominations: [1, 5, 25, 100], players: [] }; }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.current && Array.isArray(saved.current.players)) {
        history = Array.isArray(saved.history) ? saved.history : [];
        return upgrade(saved.current);
      }
      if (saved && Array.isArray(saved.players)) {
        history = Array.isArray(saved.history) ? saved.history : [];
        return upgrade(saved);
      }
    } catch (_) { /* Start fresh if saved data is unavailable. */ }
    return freshSession();
  }
  function upgrade(saved) {
        if (!saved.cashRate || !saved.chipRate) {
          // Older versions stored player amounts in rupees. Convert those saved values to chips.
          saved.cashRate = 20; saved.chipRate = 1000;
          saved.players.forEach((p) => { p.buyins = Math.round((p.buyins || 0) * 50); p.cashouts = Math.round((p.cashouts || 0) * 50); });
        }
        saved.startingStack = Number.isInteger(saved.startingStack) ? saved.startingStack : 1000;
        saved.rebuyLimit = Number.isInteger(saved.rebuyLimit) ? saved.rebuyLimit : 0;
        saved.denominations = Array.isArray(saved.denominations) ? saved.denominations : [1, 5, 25, 100];
        saved.players.forEach((p) => {
          if (!Array.isArray(p.transactions)) {
            p.transactions = [];
            if (p.buyins > 0) p.transactions.push({ id: Date.now() + Math.random(), type: 'buyin', amount: p.buyins, time: Date.now(), legacy: true });
            if (p.cashouts > 0) p.transactions.push({ id: Date.now() + Math.random(), type: 'cashout', amount: p.cashouts, time: Date.now(), legacy: true });
          }
          if (typeof p.note !== 'string') p.note = '';
          syncPlayer(p);
        });
        return saved;
  }
  function syncPlayer(player) {
    player.buyins = player.transactions.filter((t) => t.type === 'buyin').reduce((sum, t) => sum + t.amount, 0);
    player.cashouts = player.transactions.filter((t) => t.type === 'cashout').reduce((sum, t) => sum + t.amount, 0);
    player.buyinCount = player.transactions.filter((t) => t.type === 'buyin').length;
    player.rebuys = Math.max(0, player.buyinCount - (player.buyinCount ? 1 : 0));
  }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ current: data, history })); }
  function money(value) { return '₹' + currency.format(value); }
  function chipCash(chips) { return chips * Number(data.cashRate || 20) / Number(data.chipRate || 1000); }
  function chips(value) { return currency.format(value) + ' chips'; }
  function parseChipAmount(input) {
    const text = input.trim();
    if (/^\d+$/.test(text)) return Number(text);
    const denominations = (data.denominations || []).map(Number);
    const parts = text.split(/[+,]/).map((part) => part.trim());
    if (!parts.length) return NaN;
    let total = 0;
    for (const part of parts) {
      const match = part.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
      if (!match || !denominations.includes(Number(match[2]))) return NaN;
      total += Number(match[1]) * Number(match[2]);
    }
    return total;
  }
  function safe(text) { const node = document.createElement('span'); node.textContent = text; return node.innerHTML; }
  function net(player) { return player.cashouts - player.buyins; }
  function showToast(message) {
    const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }
  function render() {
    $('sessionName').value = data.name || '';
    $('cashRate').value = data.cashRate || 20;
    $('chipRate').value = data.chipRate || 1000;
    $('startingStack').value = data.startingStack ?? 1000;
    $('rebuyLimit').value = data.rebuyLimit ?? 0;
    $('denominations').value = (data.denominations || [1, 5, 25, 100]).join(', ');
    $('startingStackHelp').textContent = chips(data.startingStack || 0);
    $('rateSummary').textContent = `${money(Number(data.cashRate || 20))} = ${currency.format(Number(data.chipRate || 1000))} chips`;
    $('sessionDate').textContent = data.date || dateLabel;
    $('statusText').textContent = data.ended ? 'SESSION COMPLETE' : 'SESSION IN PROGRESS';
    const rows = $('playerRows'); rows.innerHTML = '';
    let totalIn = 0, totalOut = 0;
    data.players.forEach((player, index) => {
      totalIn += player.buyins; totalOut += player.cashouts;
      const balance = net(player);
      const state = balance > 0 ? ['Collecting', 'up'] : balance < 0 ? ['In the red', 'down'] : ['Even', 'even'];
      const initials = player.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
      const row = document.createElement('tr');
      row.innerHTML = `<td><div class="player-cell"><span class="avatar">${safe(initials)}</span><span><span class="player-name">${safe(player.name)}</span><span class="player-sub">${player.buyinCount || 0} buy-in${player.buyinCount === 1 ? '' : 's'}${player.note ? ' · ' + safe(player.note) : ''}</span></span></div></td>
        <td><span>${currency.format(player.buyins)}</span><small class="chip-sub">${money(chipCash(player.buyins))}</small></td><td><span>${currency.format(player.cashouts)}</span><small class="chip-sub">${money(chipCash(player.cashouts))}</small></td><td class="${balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'even'}"><span>${balance > 0 ? '+' : balance < 0 ? '−' : ''}${currency.format(Math.abs(balance))}</span><small class="chip-sub">${money(chipCash(Math.abs(balance)))}</small></td>
        <td class="status"><span class="badge ${state[1]}">${state[0]}</span></td>
        <td><div class="actions"><button class="action-btn" data-action="buyin" data-index="${index}">＋ Buy-in</button><button class="action-btn" data-action="cashout" data-index="${index}">Cash out</button><button class="action-btn" data-action="note" data-index="${index}">Note</button><button class="action-btn" data-action="entries" data-index="${index}">Entries</button><button class="remove-btn" data-action="remove" data-index="${index}" aria-label="Remove ${safe(player.name)}">×</button></div></td>`;
      rows.appendChild(row);
    });
    $('playerCount').textContent = data.players.length;
    $('rowCount').textContent = `(${data.players.length})`;
    $('totalBuyins').textContent = chips(totalIn);
    $('totalCashouts').textContent = chips(totalOut);
    $('buyinValue').textContent = `${money(chipCash(totalIn))} chip value`;
    $('cashoutValue').textContent = `${money(chipCash(totalOut))} chip value`;
    const tableBalance = totalIn - totalOut;
    $('tableBalance').textContent = `${tableBalance < 0 ? '−' : ''}${chips(Math.abs(tableBalance))}`;
    $('balanceHint').textContent = `${money(chipCash(Math.abs(tableBalance)))} value · ` + (tableBalance === 0 && totalIn > 0 ? 'all chips accounted for' : tableBalance > 0 ? 'still on the table' : tableBalance < 0 ? 'cash-outs exceed buy-ins' : 'buy-ins minus cash-outs');
    renderLeaderboard();
    $('emptyState').hidden = data.players.length > 0;
    $('playerRows').closest('table').hidden = data.players.length === 0;
    $('newSession').textContent = data.ended ? '＋ New session' : '↻ New session';
  }
  function renderLeaderboard() {
    const target = $('leaderboardRows');
    const allTime = leaderboardMode === 'all';
    const entries = allTime ? buildAllTimeLeaderboard() : data.players.map((player) => ({ name: player.name, score: net(player), cash: chipCash(Math.abs(net(player))), games: 1 }));
    $('leaderboardNote').textContent = allTime ? 'Ranked by lifetime net cash' : 'Ranked by net chips';
    if (!entries.length) {
      target.innerHTML = allTime ? '<p class="leaderboard-empty">Finish a game to start building your all-time standings.</p>' : '<p class="leaderboard-empty">Add players to see the standings for this session.</p>';
      return;
    }
    const ranked = [...entries].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    target.innerHTML = ranked.map((player, index) => {
      const score = player.score, tone = score > 0 ? 'positive' : score < 0 ? 'negative' : 'even';
      const rank = index === 0 ? '♛' : String(index + 1).padStart(2, '0');
      const sign = score > 0 ? '+' : score < 0 ? '−' : '';
      const mainScore = allTime ? `${sign}${money(Math.abs(score))}` : `${sign}${currency.format(Math.abs(score))}`;
      const subScore = allTime ? `${player.games} game${player.games === 1 ? '' : 's'}` : money(Math.abs(player.cash));
      return `<div class="leader-row"><span class="leader-rank ${index === 0 ? 'first' : ''}">${rank}</span><span class="leader-avatar">${safe(player.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase())}</span><span class="leader-name">${safe(player.name)}</span><span class="leader-score ${tone}">${mainScore}<small>${subScore}</small></span></div>`;
    }).join('');
  }
  function buildAllTimeLeaderboard() {
    const players = new Map();
    [...history, data].forEach((session) => {
      session.players.forEach((player) => {
        const key = player.name.trim().toLocaleLowerCase();
        if (!players.has(key)) players.set(key, { name: player.name.trim(), score: 0, games: 0 });
        const standing = players.get(key);
        standing.score += net(player) * Number(session.cashRate || 20) / Number(session.chipRate || 1000);
        standing.games += 1;
      });
    });
    return [...players.values()];
  }
  document.querySelectorAll('[data-period]').forEach((button) => button.addEventListener('click', () => {
    leaderboardMode = button.dataset.period;
    document.querySelectorAll('[data-period]').forEach((option) => {
      const active = option === button;
      option.classList.toggle('active', active);
      option.setAttribute('aria-pressed', String(active));
    });
    renderLeaderboard();
  }));
  function openAdd() {
    if (data.ended) return showToast('Start a new session to add players.');
    $('playerForm').reset(); $('startAmount').value = data.startingStack || ''; $('dialogTitle').textContent = 'Add a player'; $('savePlayer').textContent = 'Add player';
    $('playerDialog').showModal(); setTimeout(() => $('playerName').focus(), 30);
  }
  $('openAdd').addEventListener('click', openAdd);
  $('emptyAdd').addEventListener('click', openAdd);
  $('playerForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('playerName').value.trim();
    const buyin = Number($('startAmount').value || 0);
    if (!name) return;
    if (data.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return showToast('That player is already at the table.');
    if (!Number.isFinite(buyin) || buyin < 0 || !Number.isInteger(buyin)) return showToast('Enter a whole number of chips.');
    const player = { name, buyins: 0, cashouts: 0, buyinCount: 0, rebuys: 0, note: '', transactions: [] };
    if (buyin > 0) player.transactions.push({ id: Date.now() + Math.random(), type: 'buyin', amount: buyin, time: Date.now() });
    syncPlayer(player); data.players.push(player);
    $('playerDialog').close(); save(); render(); showToast(`${name} added to the table.`);
  });
  $('playerRows').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const index = Number(button.dataset.index), player = data.players[index]; if (!player) return;
    if (button.dataset.action === 'remove') {
      if (!confirm(`Remove ${player.name} and their recorded amounts?`)) return;
      data.players.splice(index, 1); save(); render(); showToast(`${player.name} removed.`); return;
    }
    if (button.dataset.action === 'note') {
      const note = prompt(`Note for ${player.name}:`, player.note || '');
      if (note !== null) { player.note = note.trim(); save(); render(); showToast('Player note saved.'); }
      return;
    }
    if (button.dataset.action === 'entries') { openEntries(index); return; }
    if (data.ended) return showToast('This session is complete. Start a new one to make changes.');
    const kind = button.dataset.action;
    if (kind === 'buyin' && data.rebuyLimit > 0 && player.rebuys >= data.rebuyLimit) return showToast(`${player.name} has reached the rebuy limit.`);
    const options = (data.denominations || []).join(', ');
    const answer = prompt(`${kind === 'buyin' ? 'Buy-in / rebuy' : 'Cash-out'} amount for ${player.name} (chip value units). Enter a total, or chips as count x denomination, e.g. 10x5 + 2x25. Available values: ${options}`);
    if (answer === null || answer.trim() === '') return;
    const amount = parseChipAmount(answer);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) return showToast('Enter a whole number of chips greater than zero.');
    player.transactions.push({ id: Date.now() + Math.random(), type: kind, amount, time: Date.now() });
    syncPlayer(player);
    save(); render(); showToast(`${kind === 'buyin' ? 'Buy-in' : 'Cash-out'} recorded for ${player.name}.`);
  });
  let entriesPlayerIndex = null;
  function openEntries(index) {
    entriesPlayerIndex = index;
    const player = data.players[index]; if (!player) return;
    $('entriesTitle').textContent = `${player.name}'s entries`;
    const entries = [...player.transactions].sort((a, b) => b.time - a.time);
    $('entriesList').innerHTML = entries.length ? entries.map((tx) => `<div class="entry-row"><div><strong>${tx.type === 'buyin' ? 'Buy-in' : 'Cash-out'}</strong><span>${new Date(tx.time).toLocaleString()}</span></div><strong>${currency.format(tx.amount)} chips <small>${money(chipCash(tx.amount))}</small></strong><div class="entry-actions"><button class="action-btn" data-tx="edit" data-id="${tx.id}">Edit</button><button class="action-btn" data-tx="undo" data-id="${tx.id}">Undo</button></div></div>`).join('') : '<p class="leaderboard-empty">No transactions recorded yet.</p>';
    $('entriesDialog').showModal();
  }
  $('entriesList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-tx]'); if (!button || entriesPlayerIndex === null) return;
    const player = data.players[entriesPlayerIndex]; if (!player) return;
    const tx = player.transactions.find((item) => String(item.id) === button.dataset.id); if (!tx) return;
    if (button.dataset.tx === 'undo') {
      if (!confirm(`Undo this ${tx.type} entry of ${currency.format(tx.amount)} chips?`)) return;
      player.transactions = player.transactions.filter((item) => item !== tx);
    } else {
      const replacement = prompt(`Edit amount in chip value units:`, String(tx.amount));
      if (replacement === null) return;
      const amount = parseChipAmount(replacement);
      if (!Number.isInteger(amount) || amount <= 0) return showToast('Enter a valid positive chip amount.');
      tx.amount = amount;
    }
    syncPlayer(player); save(); render(); openEntries(entriesPlayerIndex);
  });
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => $(button.dataset.close).close()));

  $('settleButton').addEventListener('click', () => {
    const totalIn = data.players.reduce((sum, p) => sum + p.buyins, 0);
    const totalOut = data.players.reduce((sum, p) => sum + p.cashouts, 0);
    const panel = $('settlement'); panel.hidden = false;
    if (totalIn !== totalOut) {
      const discrepancy = totalIn - totalOut;
      panel.innerHTML = `<div class="settle-head"><div><p class="eyebrow">END OF GAME</p><h2>Settle up</h2></div><button class="icon-button" id="hideSettlement" aria-label="Close">×</button></div><p class="settle-warning">Cash-outs and buy-ins differ by <strong>${currency.format(Math.abs(discrepancy))} chips (${money(chipCash(Math.abs(discrepancy)))})</strong>. Check the ledger before settling; an entry may be missing or cash may still be on the table.</p>`;
    } else {
      let debtors = data.players.filter((p) => net(p) < 0).map((p) => ({ player: p, amount: -net(p) }));
      let creditors = data.players.filter((p) => net(p) > 0).map((p) => ({ player: p, amount: net(p) }));
      const transfers = [];
      while (debtors.length && creditors.length) {
        const debtor = debtors[0], creditor = creditors[0], amount = Math.min(debtor.amount, creditor.amount);
        transfers.push({ from: debtor.player.name, to: creditor.player.name, amount });
        debtor.amount -= amount; creditor.amount -= amount;
        if (!debtor.amount) debtors.shift(); if (!creditor.amount) creditors.shift();
      }
      panel.innerHTML = `<div class="settle-head"><div><p class="eyebrow">END OF GAME</p><h2>Settle up</h2></div><button class="icon-button" id="hideSettlement" aria-label="Close">×</button></div>${transfers.length ? `<div class="transfer-list">${transfers.map((t) => `<div class="transfer-row"><span><strong>${safe(t.from)}</strong> pays <strong>${safe(t.to)}</strong></span><span>${money(chipCash(t.amount))}<small>${currency.format(t.amount)} chips</small></span></div>`).join('')}</div><p class="settle-foot">These transfers balance all recorded player results.</p>` : '<p class="settle-foot">Everyone is even. No transfers needed.</p>'}`;
    }
    $('hideSettlement').addEventListener('click', () => { panel.hidden = true; });
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  function sessionSummary(session) {
    const players = [...session.players].sort((a, b) => net(b) - net(a));
    return `${session.name} · ${session.date}\n` + players.map((p) => `${p.name}: ${net(p) >= 0 ? '+' : ''}${currency.format(net(p))} chips (${chipCashFor(session, Math.abs(net(p)))})`).join('\n');
  }
  function chipCashFor(session, amount) { return '₹' + currency.format(amount * Number(session.cashRate || 20) / Number(session.chipRate || 1000)); }
  function exportCsv(session = data) {
    const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
    const lines = [['Session', session.name], ['Date', session.date], ['Cash per chip lot', `${session.cashRate} rupees for ${session.chipRate} chips`], [], ['Player', 'Buy-ins (chips)', 'Cash-outs (chips)', 'Net (chips)', 'Net (rupees)', 'Note']];
    session.players.forEach((p) => lines.push([p.name, p.buyins, p.cashouts, net(p), Number((net(p) * session.cashRate / session.chipRate).toFixed(2)), p.note || '']));
    const csv = lines.map((row) => row.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${(session.name || 'poker-session').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  $('exportSession').addEventListener('click', () => exportCsv());
  $('shareSession').addEventListener('click', async () => {
    const text = sessionSummary(data);
    try {
      if (navigator.share) await navigator.share({ title: data.name, text });
      else { await navigator.clipboard.writeText(text); showToast('Session summary copied.'); }
    } catch (error) { if (error.name !== 'AbortError') showToast('Sharing is unavailable in this browser.'); }
  });
  $('openHistory').addEventListener('click', () => {
    const target = $('historyList');
    target.innerHTML = history.length ? [...history].reverse().map((session, reverseIndex) => {
      const index = history.length - 1 - reverseIndex;
      const inTotal = session.players.reduce((sum, p) => sum + p.buyins, 0);
      return `<div class="history-row"><div><strong>${safe(session.name || 'Poker game')}</strong><span>${safe(session.date || '')} · ${session.players.length} players · ${currency.format(inTotal)} chips bought in</span></div><div><button class="action-btn" data-history-view="${index}">View</button><button class="action-btn" data-history-export="${index}">CSV</button></div></div>`;
    }).join('') : '<p class="leaderboard-empty">Completed sessions will appear here when you start a new game.</p>';
    $('historyDialog').showModal();
  });
  $('historyList').addEventListener('click', (event) => {
    const view = event.target.closest('[data-history-view]'), csv = event.target.closest('[data-history-export]');
    if (csv) { exportCsv(history[Number(csv.dataset.historyExport)]); return; }
    if (view) {
      const session = history[Number(view.dataset.historyView)]; if (!session) return;
      const standings = [...session.players].sort((a, b) => net(b) - net(a)).map((p) => `${p.name}: ${net(p) >= 0 ? '+' : ''}${currency.format(net(p))} chips (${chipCashFor(session, Math.abs(net(p)))})`).join('\n');
      alert(`${session.name} · ${session.date}\n\n${standings || 'No players recorded.'}`);
    }
  });
  $('sessionName').addEventListener('input', (event) => { data.name = event.target.value; save(); });
  $('openSettings').addEventListener('click', () => {
    $('cashRate').value = data.cashRate || 20; $('chipRate').value = data.chipRate || 1000;
    $('startingStack').value = data.startingStack || 0; $('rebuyLimit').value = data.rebuyLimit || 0;
    $('denominations').value = (data.denominations || []).join(', ');
    updateRateExample(); $('settingsDialog').showModal();
  });
  function updateRateExample() {
    const cash = Number($('cashRate').value), chip = Number($('chipRate').value);
    $('rateExample').textContent = cash > 0 && chip > 0 ? `${money(cash)} buys ${currency.format(chip)} chips` : 'Enter a valid cash and chip amount';
  }
  ['cashRate', 'chipRate'].forEach((id) => $(id).addEventListener('input', updateRateExample));
  $('settingsForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const cash = Number($('cashRate').value), chip = Number($('chipRate').value);
    const stack = Number($('startingStack').value), rebuy = Number($('rebuyLimit').value);
    const denominations = $('denominations').value.split(/[ ,]+/).map(Number).filter((value) => Number.isInteger(value) && value > 0);
    if (!Number.isFinite(cash) || cash <= 0 || !Number.isFinite(chip) || chip <= 0 || !Number.isInteger(chip)) return showToast('Enter a positive cash amount and whole number of chips.');
    if (!Number.isInteger(stack) || stack < 0 || !Number.isInteger(rebuy) || rebuy < 0) return showToast('Starting stack and rebuy limit must be whole numbers.');
    if (!denominations.length) return showToast('Enter at least one valid chip denomination.');
    data.cashRate = cash; data.chipRate = chip; data.startingStack = stack; data.rebuyLimit = rebuy; data.denominations = [...new Set(denominations)].sort((a, b) => a - b);
    save(); $('settingsDialog').close(); render(); showToast('Session settings updated.');
  });
  $('newSession').addEventListener('click', () => {
    const hasActivity = data.players.some((p) => p.buyins || p.cashouts);
    if (hasActivity && !confirm('Finish and save this game to Past games, then start a new session?')) return;
    if (hasActivity) history.push(JSON.parse(JSON.stringify(data)));
    const previousSettings = { cashRate: data.cashRate, chipRate: data.chipRate, startingStack: data.startingStack, rebuyLimit: data.rebuyLimit, denominations: data.denominations };
    data = { ...freshSession(), ...previousSettings };
    save(); render(); showToast(hasActivity ? 'Game saved to Past games.' : 'A fresh session is ready.');
  });
  $('sessionDate').textContent = data.date || dateLabel;
  render();
})();
