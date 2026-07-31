// ==========================================
// CHOREY LOCAL STORAGE — SCHEMA VERSION 9
// ==========================================
// This is the only file that may access localStorage. Shared tasks and current
// occurrence state live in Supabase. This file preserves device-local state.
const ChoreyStorage = (() => {
  const CURRENT_SCHEMA_VERSION = 9;
  const ROOT_STORAGE_KEY = "chorey_app_state";
  const VALID_VIEW_MODES = new Set(["mine", "unassigned", "household", "completed"]);
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
      daily: { dateKey: null, congratulationsShownByUserId: {} },
      developer: { dateOverride: null },
      settings: { viewModeByUserId: {} },
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

  function normalizeViewModes(candidate) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return {};
    return Object.fromEntries(Object.entries(candidate).flatMap(([reference, mode]) => {
      const personId = findPersonId(reference);
      return personId && VALID_VIEW_MODES.has(mode) ? [[personId, mode]] : [];
    }));
  }

  function normalizeState(candidate) {
    const source = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : {};
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      activePersonId: findPersonId(source.activePersonId),
      daily: {
        dateKey: typeof source.daily?.dateKey === "string" ? source.daily.dateKey : null,
        congratulationsShownByUserId: (() => {
          const candidate = source.daily?.congratulationsShownByUserId;
          if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
            return Object.fromEntries(Object.entries(candidate).flatMap(([reference, shown]) => {
              const personId = findPersonId(reference);
              return personId && shown ? [[personId, true]] : [];
            }));
          }
          const activeId = findPersonId(source.activePersonId);
          return source.daily?.congratulationsShown && activeId ? { [activeId]: true } : {};
        })(),
      },
      developer: {
        dateOverride: /^\d{4}-\d{2}-\d{2}$/.test(source.developer?.dateOverride || "")
          ? source.developer.dateOverride
          : null,
      },
      settings: {
        viewModeByUserId: normalizeViewModes(source.settings?.viewModeByUserId),
      },
    };
  }

  function migrateLegacyStorage() {
    const migrated = createDefaultState();
    migrated.activePersonId = findPersonId(
      LEGACY_KEYS.activePerson.map(key => localStorage.getItem(key)).find(value => value !== null)
    );
    migrated.daily.dateKey = localStorage.getItem(LEGACY_KEYS.dateKey);
    if (localStorage.getItem(LEGACY_KEYS.congrats) === "true" && migrated.activePersonId) {
      migrated.daily.congratulationsShownByUserId[migrated.activePersonId] = true;
    }
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
    state.daily = { dateKey, congratulationsShownByUserId: {} };
    return saveState();
  }

  return Object.freeze({
    getState: () => clone(state),
    getActivePersonId: () => state.activePersonId,
    setActivePersonId(id) { state.activePersonId = findPersonId(id); return saveState(); },
    clearActivePerson() { state.activePersonId = null; return saveState(); },
    prepareDate,
    getCongratulationsShown(personId) {
      const id = findPersonId(personId);
      return Boolean(id && state.daily.congratulationsShownByUserId[id]);
    },
    setCongratulationsShown(personId, value) {
      const id = findPersonId(personId);
      if (!id) return false;
      if (value) state.daily.congratulationsShownByUserId[id] = true;
      else delete state.daily.congratulationsShownByUserId[id];
      return saveState();
    },
    getViewMode(personId) {
      const id = findPersonId(personId);
      return id ? state.settings.viewModeByUserId[id] || null : null;
    },
    setViewMode(personId, mode) {
      const id = findPersonId(personId);
      if (!id || !VALID_VIEW_MODES.has(mode)) return false;
      state.settings.viewModeByUserId[id] = mode;
      return saveState();
    },
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
