import { GAMES, SPEED_MODES, getTodayKey } from '../shared/settings.js';

const HUD_HOST_ID = 'lg-turbo-hud-host';

export class FloatingHud {
  #host = null;
  #shadow = null;
  #game = null;
  #settings = null;
  #stats = null;
  #collapsed = false;
  #solving = false;
  #onSolve = null;
  #onCycleSpeed = null;
  #toastTimer = null;

  constructor({ game, settings, stats, onSolve, onCycleSpeed }) {
    this.#game = game;
    this.#settings = settings;
    this.#stats = stats;
    this.#onSolve = onSolve;
    this.#onCycleSpeed = onCycleSpeed;
  }

  mount() {
    if (document.getElementById(HUD_HOST_ID)) {
      document.getElementById(HUD_HOST_ID).remove();
    }
    const host = document.createElement('div');
    host.id = HUD_HOST_ID;
    host.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
    const shadow = host.attachShadow({ mode: 'open' });
    this.#host = host;
    this.#shadow = shadow;
    this.#render();
    (document.body || document.documentElement).appendChild(host);
  }

  unmount() {
    if (this.#host) {
      this.#host.remove();
      this.#host = null;
      this.#shadow = null;
    }
  }

  update({ game, settings, stats } = {}) {
    if (game) this.#game = game;
    if (settings) this.#settings = settings;
    if (stats) this.#stats = stats;
    if (!this.#settings?.showHud) {
      this.unmount();
      return;
    }
    if (!this.#host || !document.contains(this.#host)) {
      this.mount();
      return;
    }
    this.#syncUI();
  }

  setSolving(isSolving) {
    this.#solving = isSolving;
    this.#syncUI();
  }

  showToast(message, type = 'success') {
    if (!this.#shadow) return;
    const toast = this.#shadow.querySelector('.hud-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `hud-toast show ${type}`;
    clearTimeout(this.#toastTimer);
    this.#toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  #render() {
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      * { box-sizing: border-box; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }

      .hud-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }

      .hud-toast {
        opacity: 0; transform: translateY(8px) scale(0.96); pointer-events: none;
        transition: all 0.22s cubic-bezier(0.22, 1, 0.36, 1);
        padding: 8px 13px; border-radius: 10px; font-size: 12px; font-weight: 600;
        color: #F8FAFC; background: rgba(15, 23, 42, 0.95);
        border: 1px solid rgba(148, 163, 184, 0.28);
        box-shadow: 0 10px 26px rgba(2, 6, 23, 0.45); backdrop-filter: blur(12px); max-width: 260px;
      }
      .hud-toast.show { opacity: 1; transform: translateY(0) scale(1); }
      .hud-toast.success { border-color: rgba(16, 185, 129, 0.55); color: #A7F3D0; }
      .hud-toast.error { border-color: rgba(244, 63, 94, 0.6); color: #FECDD3; }

      .hud-card {
        background: rgba(11, 20, 38, 0.92); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 16px;
        box-shadow: 0 14px 36px rgba(2, 6, 23, 0.52), 0 0 0 1px rgba(10, 102, 194, 0.25);
        color: #F8FAFC; padding: 10px; width: 256px; transition: all 0.22s ease;
      }
      .hud-card.collapsed { width: auto; padding: 6px 8px; border-radius: 999px; }

      .hud-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .hud-brand { display: flex; align-items: center; gap: 7px; min-width: 0; }
      .hud-logo {
        width: 22px; height: 22px; border-radius: 6px;
        background: linear-gradient(135deg, #0C1E3A 0%, #0A66C2 60%, #0EA5E9 100%);
        display: flex; align-items: center; justify-content: center; font-size: 12px;
        flex-shrink: 0; box-shadow: 0 2px 8px rgba(14, 165, 233, 0.35);
      }
      .hud-title { font-size: 12px; font-weight: 700; letter-spacing: -0.01em; color: #F1F5F9; white-space: nowrap; }
      .hud-actions-mini { display: flex; align-items: center; gap: 5px; }

      .speed-pill {
        border: 1px solid rgba(255, 255, 255, 0.14); background: rgba(255, 255, 255, 0.07);
        color: #E2E8F0; border-radius: 999px; padding: 3px 8px; font-size: 11px; font-weight: 600;
        cursor: pointer; transition: background 0.15s, border-color 0.15s;
      }
      .speed-pill:hover { background: rgba(56, 189, 248, 0.18); border-color: rgba(56, 189, 248, 0.45); }

      .icon-btn {
        width: 24px; height: 24px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.06); color: #CBD5E1; cursor: pointer;
        display: flex; align-items: center; justify-content: center; font-size: 12px; transition: all 0.15s;
      }
      .icon-btn:hover { background: rgba(255, 255, 255, 0.14); color: #FFFFFF; }

      .solve-btn {
        margin-top: 9px; width: 100%; border: none; border-radius: 11px; padding: 9px 12px;
        font-size: 13px; font-weight: 700; color: #FFFFFF; cursor: pointer;
        display: flex; align-items: center; justify-content: space-between;
        background: linear-gradient(135deg, #0A66C2 0%, #0EA5E9 100%);
        box-shadow: 0 6px 18px rgba(10, 102, 194, 0.42);
        transition: transform 0.12s ease, filter 0.15s ease, box-shadow 0.15s ease;
      }
      .solve-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 8px 22px rgba(14, 165, 233, 0.5); }
      .solve-btn:active:not(:disabled) { transform: translateY(0); }
      .solve-btn:disabled { opacity: 0.72; cursor: wait; }
      .solve-btn-left { display: flex; align-items: center; gap: 7px; }

      .kbd { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.18); color: #F8FAFC; }
      .spinner { width: 13px; height: 13px; border: 2px solid rgba(255, 255, 255, 0.35); border-top-color: #FFFFFF; border-radius: 50%; animation: spin 0.65s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }

      .games-row { margin-top: 8px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
      .game-chip {
        position: relative; text-decoration: none; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 2px; padding: 5px 3px; border-radius: 9px;
        background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08);
        color: #CBD5E1; font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.15s ease;
      }
      .game-chip:hover { background: rgba(255, 255, 255, 0.12); color: #FFFFFF; transform: translateY(-1px); }
      .game-chip.active { background: rgba(14, 165, 233, 0.18); border-color: rgba(56, 189, 248, 0.55); color: #FFFFFF; }
      .game-chip .emoji { font-size: 13px; line-height: 1; }
      .game-chip .done-dot { position: absolute; top: 3px; right: 3px; width: 6px; height: 6px; border-radius: 50%; background: #10B981; box-shadow: 0 0 6px #10B981; }

      .collapsed-row { display: flex; align-items: center; gap: 6px; }
      .mini-solve-btn {
        border: none; border-radius: 999px; padding: 5px 11px; font-size: 12px; font-weight: 700;
        color: #FFFFFF; background: linear-gradient(135deg, #0A66C2 0%, #0EA5E9 100%);
        cursor: pointer; display: flex; align-items: center; gap: 5px;
      }
      .mini-solve-btn:hover { filter: brightness(1.1); }
    `;

    const wrap = document.createElement('div');
    wrap.className = 'hud-wrap';
    wrap.innerHTML = `
      <div class="hud-toast" role="status" aria-live="polite"></div>
      <div class="hud-card"></div>
    `;

    this.#shadow.innerHTML = '';
    this.#shadow.appendChild(style);
    this.#shadow.appendChild(wrap);
    this.#syncUI();
  }

  #syncUI() {
    if (!this.#shadow) return;
    const card = this.#shadow.querySelector('.hud-card');
    if (!card) return;

    const speed = SPEED_MODES[this.#settings?.speedMode || 'turbo'] || SPEED_MODES.turbo;
    const today = getTodayKey();
    const todayMap = this.#stats?.daily?.[today] || {};

    if (this.#collapsed) {
      card.className = 'hud-card collapsed';
      card.innerHTML = `
        <div class="collapsed-row">
          <button class="mini-solve-btn" type="button" ${this.#solving ? 'disabled' : ''}>
            ${this.#solving ? '<span class="spinner"></span>' : '⚡'}
            <span>${this.#solving ? '...' : this.#game.shortName}</span>
          </button>
          <button class="icon-btn expand-btn" type="button" title="Déplier">▲</button>
        </div>
      `;
      card.querySelector('.mini-solve-btn')?.addEventListener('click', () => this.#onSolve?.());
      card.querySelector('.expand-btn')?.addEventListener('click', () => {
        this.#collapsed = false;
        this.#syncUI();
      });
      return;
    }

    card.className = 'hud-card';
    const gamesHtml = GAMES.map((g) => {
      const isActive = g.id === this.#game.id;
      const isDone = todayMap[g.id] != null;
      return `
        <a class="game-chip ${isActive ? 'active' : ''}" href="${g.url}" title="Ouvrir ${g.name}${isDone ? ' (fait : ' + todayMap[g.id] + ' ms)' : ''}">
          ${isDone ? '<span class="done-dot"></span>' : ''}
          <span class="emoji">${g.emoji}</span>
          <span>${g.shortName}</span>
        </a>
      `;
    }).join('');

    card.innerHTML = `
      <div class="hud-top">
        <div class="hud-brand">
          <div class="hud-logo">⚡</div>
          <div class="hud-title">${this.#game.emoji} ${this.#game.name}</div>
        </div>
        <div class="hud-actions-mini">
          <button class="speed-pill" type="button" title="Changer la vitesse (${speed.desc})">${speed.icon} ${speed.label}</button>
          <button class="icon-btn collapse-btn" type="button" title="Réduire">▼</button>
        </div>
      </div>
      <button class="solve-btn" type="button" ${this.#solving ? 'disabled' : ''}>
        <span class="solve-btn-left">
          ${this.#solving ? '<span class="spinner"></span><span>Résolution...</span>' : `<span>⚡</span><span>Résoudre ${this.#game.shortName}</span>`}
        </span>
        ${this.#settings?.shortcutEnabled ? '<span class="kbd">Alt+S</span>' : ''}
      </button>
      <div class="games-row">${gamesHtml}</div>
    `;

    card.querySelector('.solve-btn')?.addEventListener('click', () => this.#onSolve?.());
    card.querySelector('.speed-pill')?.addEventListener('click', () => this.#onCycleSpeed?.());
    card.querySelector('.collapse-btn')?.addEventListener('click', () => {
      this.#collapsed = true;
      this.#syncUI();
    });
  }
}
