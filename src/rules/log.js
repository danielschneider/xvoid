// Appends a log entry and keeps the five newest. Pure: returns a new array.
export const addLog = (state, text, kind = 'system') => [
  { id: (state.logs[0]?.id || 0) + 1, text, kind },
  ...state.logs,
].slice(0, 5);
