export const up = (pgm) => {
  pgm.createTable('albums', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    name: { type: 'varchar(500)', notNull: true },
    slug: { type: 'varchar(500)', unique: true },
    cover_image_url: { type: 'text' },
    release_date: { type: 'date' },
    metadata: { type: 'jsonb' },
    created_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.createTable('media_albums', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    media_id: {
      type: 'uuid',
      notNull: true,
      references: 'media(id)',
      onDelete: 'CASCADE',
    },
    album_id: {
      type: 'uuid',
      notNull: true,
      references: 'albums(id)',
      onDelete: 'CASCADE',
    },
    track_number: { type: 'integer' },
    created_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.addConstraint('media_albums', 'media_albums_media_id_album_id_unique', 'UNIQUE(media_id, album_id)');

  pgm.createIndex('albums', 'name');
  pgm.createIndex('albums', 'slug');
  pgm.createIndex('media_albums', 'media_id');
  pgm.createIndex('media_albums', 'album_id');

  pgm.sql(`
    CREATE TRIGGER update_albums_updated_at
    BEFORE UPDATE ON albums
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `);
};

export const down = (pgm) => {
  pgm.sql(`DROP TRIGGER IF EXISTS update_albums_updated_at ON albums`);
  pgm.dropTable('media_albums');
  pgm.dropTable('albums');
};