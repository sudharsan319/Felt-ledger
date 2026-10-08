# Felt — Poker Session Ledger

A small Flask web app for keeping track of a home poker game. Add players, record each buy-in and cash-out in chips, and see each player's net result alongside the chips left on the table.

## Run locally

Install the dependency and start the app:

```sh
pip install -r requirements.txt
python hello.py
```

Open `http://127.0.0.1:8000` in your browser. The ledger saves to local storage in that browser on that device; it does not sync between devices.

## Using the ledger

- Add a player, optionally including their first buy-in.
- Use **Buy-in** to record additional chips and **Cash out** when a player leaves or the game ends.
- A positive net means the player cashed out more than they bought in; a negative net means they bought in more than they cashed out.
- The table balance is total buy-ins minus total cash-outs. A zero balance means the recorded cash-outs match the recorded buy-ins.
- **New session** asks for the player count and names, archives the current game, and gives each new player the same starting stack from Settings.
- Use **New player** during a game when someone joins; they receive the configured starting stack.

The default chip rate is ₹20 for 1,000 chips. Use **Settings** to change the cash-to-chip rate, starting stack, rebuy limit, and chip denominations for a session. Chip amounts are converted to their rupee value automatically. For transactions, enter a chip value total or a count expression such as `10x5 + 2x25`.

The app also includes a net-chip leaderboard, settle-up suggestions (only when cash-outs balance buy-ins), player notes, editable and undoable transaction entries, past session history with deletion, CSV export, and a shareable session summary. Starting a new session archives the current one. Everything stays in the current browser's local storage.
