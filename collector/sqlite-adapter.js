export function sqliteAdapter(database) {
  function statement(sql, values = []) {
    return { bind: (...bound) => statement(sql, bound),
      async first() { return database.prepare(sql).get(...values) || null; },
      async all() { return { results: database.prepare(sql).all(...values) }; },
      async run() { return database.prepare(sql).run(...values); },
    };
  }
  return { prepare: statement, async exec(sql) { database.exec(sql); }, async batch(statements) { database.exec('BEGIN'); try { const result = []; for (const s of statements) result.push(await s.run()); database.exec('COMMIT'); return result; } catch (error) { database.exec('ROLLBACK'); throw error; } } };
}
