// js/engine/migrations.js
// Versioned migration registry (engine-agnostic).
export function createMigrationRegistry() {
    // fromVersion -> [{ to, migrate }]
    const map = new Map();
    function register(from, to, migrate) {
        const f = String(from || '').trim();
        const t = String(to || '').trim();
        if (!f || !t)
            return;
        if (typeof migrate !== 'function')
            return;
        const arr = map.get(f) || [];
        arr.push({ to: t, migrate });
        map.set(f, arr);
    }
    function _findPath(from, to, maxSteps = 50) {
        // BFS to find any path
        const start = String(from || '').trim();
        const goal = String(to || '').trim();
        if (!start || !goal)
            return null;
        if (start === goal)
            return [];
        const q = [{ v: start, path: [] }];
        const seen = new Set([start]);
        let steps = 0;
        while (q.length && steps < 10000) {
            steps++;
            const cur = q.shift();
            const edges = map.get(cur.v) || [];
            for (let i = 0; i < edges.length; i++) {
                const e = edges[i];
                const nextV = e.to;
                const nextPath = cur.path.concat([{ from: cur.v, to: nextV, migrate: e.migrate }]);
                if (nextV === goal)
                    return nextPath;
                if (!seen.has(nextV) && nextPath.length <= maxSteps) {
                    seen.add(nextV);
                    q.push({ v: nextV, path: nextPath });
                }
            }
        }
        return null;
    }
    function migrateState(state, fromVersion, toVersion) {
        // Validate state parameter
        if (!state || typeof state !== 'object') {
            const err = new Error('migrateState() requires a valid state object');
            err.code = 'INVALID_STATE';
            err.details = { stateType: typeof state };
            throw err;
        }
        const path = _findPath(fromVersion, toVersion);
        if (path == null) {
            const err = new Error(`No migration path from ${fromVersion} to ${toVersion}`);
            err.code = 'NO_MIGRATION_PATH';
            err.details = { fromVersion, toVersion };
            throw err;
        }
        let s = state;
        for (let i = 0; i < path.length; i++) {
            const step = path[i];
            // Validate migrate function before calling
            if (typeof step.migrate !== 'function') {
                const err = new Error(`Migration step ${step.from} -> ${step.to} has invalid migrate function`);
                err.code = 'INVALID_MIGRATION';
                err.details = { from: step.from, to: step.to };
                throw err;
            }
            try {
                s = step.migrate(s);
            }
            catch (e) {
                const err = new Error(`Migration failed at step ${step.from} -> ${step.to}: ${e.message}`);
                err.code = 'MIGRATION_ERROR';
                err.details = { from: step.from, to: step.to, originalError: { message: e.message, stack: e.stack } };
                throw err;
            }
            // Validate migrated state is still an object
            if (!s || typeof s !== 'object') {
                const err = new Error(`Migration step ${step.from} -> ${step.to} returned invalid state`);
                err.code = 'INVALID_MIGRATED_STATE';
                err.details = { from: step.from, to: step.to, returnedType: typeof s };
                throw err;
            }
        }
        return s;
    }
    function getReport() {
        const out = {};
        for (const [k, arr] of map.entries()) {
            out[k] = arr.map(x => x.to);
        }
        return out;
    }
    return { register, migrateState, getReport };
}
//# sourceMappingURL=migrations.js.map