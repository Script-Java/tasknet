const GAMIFICATION_UPDATE_EVENT = 'fides:gamification-update';

export function dispatchGamificationUpdate() {
  window.dispatchEvent(new CustomEvent(GAMIFICATION_UPDATE_EVENT));
}

export function onGamificationUpdate(handler: () => void) {
  window.addEventListener(GAMIFICATION_UPDATE_EVENT, handler);
  return () => window.removeEventListener(GAMIFICATION_UPDATE_EVENT, handler);
}