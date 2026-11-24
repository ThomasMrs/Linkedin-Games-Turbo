import {
  polyfilledBrowser,
  getGameById,
  getSettings,
  saveSettings,
  getStats,
  recordSolve,
  onStorageChange,
} from '../shared/settings.js';
import { FloatingHud } from './hud.js';
import { sleep } from '../util.js';

const SPEED_ORDER = ['turbo', 'fast', 'human'];

export function initGameController(gameId, legacyFnName, solveFn) {
  const game = getGameById(gameId);
  if (!game) return;

  if (window.__lgTurboController) {
    window.__lgTurboController.switchGame(game, legacyFnName, solveFn);
    return;
  }

  const controller = new GameController(game, legacyFnName, solveFn);
  window.__lgTurboController = controller;
  controller.start();
}

class GameController {
  #game;
  #solveFn;
  #settings = null;
  #stats = null;
  #hud = null;
  #isSolving = false;
  #autoSolvedUrls = new Set();

  constructor(game, legacyFnName, solveFn) {
    this.#game = game;
    this.#solveFn = solveFn;
    this.#bindLegacy(legacyFnName);
  }

  #bindLegacy(legacyFnName) {
    window[legacyFnName] = () => this.triggerSolve();
  }

  switchGame(game, legacyFnName, solveFn) {
    this.#game = game;
    this.#solveFn = solveFn;
    this.#bindLegacy(legacyFnName);
    this.#hud?.update({ game: this.#game, settings: this.#settings, stats: this.#stats });
    this.#maybeAutoSolve();
  }

  async start() {
    this.#settings = await getSettings();
    this.#stats = await getStats();

    this.#hud = new FloatingHud({
      game: this.#game,
      settings: this.#settings,
      stats: this.#stats,
      onSolve: () => this.triggerSolve(),
      onCycleSpeed: () => this.#cycleSpeed(),
    });

    if (this.#settings.showHud) {
      this.#mountHudWhenReady();
    }

    window.addEventListener('keydown', (e) => {
      if (!this.#settings?.shortcutEnabled) return;
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.triggerSolve();
      }
    });

    try {
      polyfilledBrowser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (!msg || !msg.type) return;
        if (msg.type === 'LG_TURBO_PING') {
          sendResponse({ ok: true, gameId: this.#game.id, isSolving: this.#isSolving });
          return true;
        }
        if (msg.type === 'LG_TURBO_SOLVE') {
          this.triggerSolve(msg.options)
            .then((result) => sendResponse(result))
            .catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
          return true;
        }
      });
    } catch (_e) {
      // Ignore if messaging unavailable
    }

    onStorageChange(({ settings, stats }) => {
      if (settings) this.#settings = settings;
      if (stats) this.#stats = stats;
      this.#hud?.update({ game: this.#game, settings: this.#settings, stats: this.#stats });
    });

    this.#maybeAutoSolve();
  }

  #mountHudWhenReady() {
    if (document.body) {
      this.#hud.mount();
    } else {
      document.addEventListener('DOMContentLoaded', () => this.#hud.mount(), { once: true });
    }
  }

  async #cycleSpeed() {
    const idx = SPEED_ORDER.indexOf(this.#settings?.speedMode || 'turbo');
    const nextMode = SPEED_ORDER[(idx + 1) % SPEED_ORDER.length];
    this.#settings = await saveSettings({ speedMode: nextMode });
    this.#hud?.update({ settings: this.#settings });
    this.#hud?.showToast(`Mode ${nextMode.toUpperCase()} activé`, 'success');
  }

  async #maybeAutoSolve() {
    if (!this.#settings?.autoSolve) return;
    const key = `${this.#game.id}:${window.location.pathname}`;
    if (this.#autoSolvedUrls.has(key)) return;
    this.#autoSolvedUrls.add(key);
    await sleep(900);
    await this.triggerSolve();
  }

  async triggerSolve(overrideOptions = {}) {
    if (this.#isSolving) {
      return { success: false, error: 'Résolution déjà en cours...' };
    }
    this.#isSolving = true;
    this.#hud?.setSolving(true);
    try {
      this.#settings = await getSettings();
      const result = await this.#solveFn({
        speedMode: overrideOptions.speedMode || this.#settings.speedMode || 'turbo',
        autoStart: overrideOptions.autoStart ?? this.#settings.autoStart ?? true,
      });
      this.#stats = await recordSolve(this.#game.id, result.durationMs);
      this.#hud?.update({ stats: this.#stats });
      this.#hud?.showToast(
        `✅ ${this.#game.name} résolu en ${result.durationMs} ms !`,
        'success'
      );
      return result;
    } catch (err) {
      const msg = err?.message || 'Grille introuvable. Lance la partie puis réessaie !';
      console.error('[LG Turbo] Solve error:', err);
      this.#hud?.showToast(`⚠️ ${msg}`, 'error');
      return { success: false, error: msg };
    } finally {
      this.#isSolving = false;
      this.#hud?.setSolving(false);
    }
  }
}
