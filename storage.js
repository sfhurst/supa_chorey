// ==========================================
// CHOREY LOCAL STORAGE — SCHEMA VERSION 7
// ==========================================
// This is the only file that may access localStorage. Shared tasks and current
// occurrence state live in Supabase. This file preserves device-local state.
const ChoreyStorage = (() => {
  const CURRENT_SCHEMA_VERSION = 7;
  const ROOT_STORAGE_KEY = "chorey_app_state";
  const LEGACY_KEYS = {
    activePerson: ["chorey_active_person", "family_active_user"],
    boardState: "chore_board_state",
    dateKey: "chore_date_key",
    congrats: "congrats_triggered",
  };
  const clone = value => JSON.parse(JSON.stringify(value));

  function findPersonId(reference) {
    if (!reference) return null;
    const normalized = String(reference).trim().toLowerCase();
    const match = people.find(person =>
      person.id.toLowerCase() === normalized ||
      person.name.toLowerCase() === normalized ||
      (person.legacyIds || []).some(id => String(id).toLowerCase() === normalized)
    );
    return match?.id || null;
  }

  function createDefaultState() {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      activePersonId: null,
      daily: { dateKey: null, congratulationsShown: false },
      developer: { dateOverride: null },
    };
  }

  function readJson(key, fallbackValue) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? clone(fallbackValue) : JSON.parse(raw);
    } catch (error) {
      console.warn(`Chorey could not read "${key}".`, error);
      return clone(fallbackValue);
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Chorey could not save "${key}".`, error);
      throw new Error("Chorey could not save your local settings.", { cause: error });
    }
  }

  function normalizeState(candidate) {
    const source = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : {};
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      activePersonId: findPersonId(source.activePersonId),
      daily: {
        dateKey: typeof source.daily?.dateKey === "string" ? source.daily.dateKey : null,
        congratulationsShown: Boolean(source.daily?.congratulationsShown),
      },
      developer: {
        dateOverride: /^\d{4}-\d{2}-\d{2}$/.test(source.developer?.dateOverride || "")
          ? source.developer.dateOverride
          : null,
      },
    };
  }

  function migrateLegacyStorage() {
    const migrated = createDefaultState();
    migrated.activePersonId = findPersonId(
      LEGACY_KEYS.activePerson.map(key => localStorage.getItem(key)).find(value => value !== null)
    );
    migrated.daily.dateKey = localStorage.getItem(LEGACY_KEYS.dateKey);
    migrated.daily.congratulationsShown = localStorage.getItem(LEGACY_KEYS.congrats) === "true";
    writeJson(ROOT_STORAGE_KEY, migrated);
    Object.values(LEGACY_KEYS).flat().forEach(key => localStorage.removeItem(key));
    return migrated;
  }

  function loadState() {
    const root = readJson(ROOT_STORAGE_KEY, null);
    if (root === null) {
      const hasLegacy = Object.values(LEGACY_KEYS).flat().some(key => localStorage.getItem(key) !== null);
      return hasLegacy ? migrateLegacyStorage() : createDefaultState();
    }
    const normalized = normalizeState(root);
    writeJson(ROOT_STORAGE_KEY, normalized);
    return normalized;
  }

  let state = loadState();

  function saveState() {
    state = normalizeState(state);
    writeJson(ROOT_STORAGE_KEY, state);
    return true;
  }

  function prepareDate(dateKey) {
    if (state.daily.dateKey === dateKey) return true;
    state.daily = { dateKey, congratulationsShown: false };
    return saveState();
  }

  return Object.freeze({
    getState: () => clone(state),
    getActivePersonId: () => state.activePersonId,
    setActivePersonId(id) { state.activePersonId = findPersonId(id); return saveState(); },
    clearActivePerson() { state.activePersonId = null; return saveState(); },
    prepareDate,
    getCongratulationsShown: () => state.daily.congratulationsShown,
    setCongratulationsShown(value) { state.daily.congratulationsShown = Boolean(value); return saveState(); },
    getDeveloperDateOverride: () => state.developer?.dateOverride || null,
    setDeveloperDateOverride(value) {
      state.developer = {
        dateOverride: /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : null,
      };
      return saveState();
    },
    clearDeveloperDateOverride() { state.developer = { dateOverride: null }; return saveState(); },
    resetAllData() {
      localStorage.removeItem(ROOT_STORAGE_KEY);
      Object.values(LEGACY_KEYS).flat().forEach(key => localStorage.removeItem(key));
      state = createDefaultState();
      return true;
    },
  });
})();
