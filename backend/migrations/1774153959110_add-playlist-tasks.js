/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createTable('playlist_tasks', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    url: { type: 'varchar(1000)', notNull: true },
    requested_by: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
    quality:       { type: 'varchar(20)' },
    format:        { type: 'varchar(20)' },
    status: {
      type: 'varchar(20)',
      default: 'queued',
      check: "status IN ('queued', 'downloading', 'completed', 'failed')",
    },
    total_tracks:  { type: 'integer', default: 0 },
    error_message: { type: 'text' },
    created_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.addColumn('download_tasks', {
    playlist_id: {
      type: 'uuid',
      references: 'playlist_tasks(id)',
      onDelete: 'SET NULL',
    },
  });

  pgm.createIndex('playlist_tasks', 'requested_by');
  pgm.createIndex('playlist_tasks', 'status');
  pgm.createIndex('download_tasks', 'playlist_id');

  pgm.sql(`
    CREATE TRIGGER update_playlist_tasks_updated_at
    BEFORE UPDATE ON playlist_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `);
};

export const down = (pgm) => {
  pgm.sql(`DROP TRIGGER IF EXISTS update_playlist_tasks_updated_at ON playlist_tasks`);
  pgm.dropIndex('download_tasks', 'playlist_id');
  pgm.dropColumn('download_tasks', 'playlist_id');
  pgm.dropTable('playlist_tasks');
};
