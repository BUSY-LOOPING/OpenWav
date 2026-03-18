export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    username: { type: 'varchar(50)', notNull: true, unique: true },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    role: {
      type: 'varchar(20)',
      default: 'user',
      check: "role IN ('user', 'admin')",
    },
    is_active: { type: 'boolean', default: true },
    email_verified: { type: 'boolean', default: false },
    last_login: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.createTable('user_settings', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    setting_key: { type: 'varchar(100)', notNull: true },
    setting_value: { type: 'text' },
    data_type: {
      type: 'varchar(20)',
      default: 'string',
      check: "data_type IN ('string', 'number', 'boolean', 'json')",
    },
    created_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('user_settings', 'user_settings_user_id_setting_key_unique', 'UNIQUE(user_id, setting_key)');

  pgm.createTable('global_settings', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    setting_key: { type: 'varchar(100)', notNull: true, unique: true },
    setting_value: { type: 'text' },
    data_type: {
      type: 'varchar(20)',
      default: 'string',
      check: "data_type IN ('string', 'number', 'boolean', 'json')",
    },
    description: { type: 'text' },
    is_public: { type: 'boolean', default: false },
    created_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.createTable('media', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    title: { type: 'varchar(500)', notNull: true },
    description: { type: 'text' },
    url: { type: 'varchar(1000)', notNull: true },
    platform: { type: 'varchar(50)' },
    duration: { type: 'integer' },
    file_path: { type: 'varchar(1000)' },
    thumbnail_path: { type: 'varchar(1000)' },
    file_size: { type: 'bigint' },
    format: { type: 'varchar(50)' },
    quality: { type: 'varchar(20)' },
    status: {
      type: 'varchar(20)',
      default: 'pending',
      check: "status IN ('pending', 'downloading', 'completed', 'failed', 'deleted')",
    },
    uploaded_by: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
    metadata: { type: 'jsonb' },
    chart_position: { type: 'integer' },
    chart_name: { type: 'varchar(200)' },
    chart_date: { type: 'date' },
    created_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.createTable('user_history', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    media_id: {
      type: 'uuid',
      notNull: true,
      references: 'media(id)',
      onDelete: 'CASCADE',
    },
    watch_time: { type: 'integer', default: 0 },
    total_duration: { type: 'integer' },
    completed: { type: 'boolean', default: false },
    last_position: { type: 'integer', default: 0 },
    played_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.createTable('likes', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    media_id: {
      type: 'uuid',
      notNull: true,
      references: 'media(id)',
      onDelete: 'CASCADE',
    },
    created_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('likes', 'likes_user_id_media_id_unique', 'UNIQUE(user_id, media_id)');

  pgm.createTable('download_tasks', {
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
    status: {
      type: 'varchar(20)', 
      default: 'queued',
      check: "status IN ('queued', 'downloading', 'completed', 'failed', 'cancelled')",
    }, 
    progress: { type: 'integer', default: 0 },
    quality: { type: 'varchar(20)' },
    format: { type: 'varchar(20)' },
    error_message: { type: 'text' },
    media_id: {
      type: 'uuid',
      references: 'media(id)',
      onDelete: 'SET NULL',
    },
    retry_count: { type: 'integer', default: 0 },
    max_retries: { type: 'integer', default: 3 },
    priority: { type: 'integer', default: 5 },
    started_at: { type: 'timestamptz' },
    completed_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.createTable('refresh_tokens', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    token_hash: { type: 'varchar(255)', notNull: true },
    expires_at: { type: 'timestamptz', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
    revoked_at: { type: 'timestamptz' },
  });

  pgm.createTable('artists', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    name: { type: 'varchar(500)', notNull: true },
    slug: { type: 'varchar(500)', unique: true },
    image_url: { type: 'text' },
    genres: { type: 'text[]' },
    bio: { type: 'text' },
    social_links: { type: 'jsonb' },
    metadata: { type: 'jsonb' },
    created_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.createTable('playlists', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    name: { type: 'varchar(500)', notNull: true },
    description: { type: 'text' },
    cover_image_url: { type: 'text' },
    is_public: { type: 'boolean', default: true },
    created_by: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
    total_tracks: { type: 'integer', default: 0 },
    total_duration: { type: 'integer', default: 0 },
    metadata: { type: 'jsonb' },
    created_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.createTable('playlist_tracks', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    playlist_id: {
      type: 'uuid',
      references: 'playlists(id)',
      onDelete: 'CASCADE',
    },
    media_id: {
      type: 'uuid',
      references: 'media(id)',
      onDelete: 'CASCADE',
    },
    position: { type: 'integer', notNull: true },
    added_by: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
    added_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('playlist_tracks', 'playlist_tracks_playlist_id_media_id_unique', 'UNIQUE(playlist_id, media_id)');

  pgm.createTable('media_artists', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    media_id: {
      type: 'uuid',
      references: 'media(id)',
      onDelete: 'CASCADE',
    },
    artist_id: {
      type: 'uuid',
      references: 'artists(id)',
      onDelete: 'CASCADE',
    },
    role: { type: 'varchar(100)', default: 'artist' },
    created_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('media_artists', 'media_artists_media_id_artist_id_role_unique', 'UNIQUE(media_id, artist_id, role)');

  // ── Indexes ────────────────────────────────────────────────────────────────

  pgm.createIndex('users', 'email');
  pgm.createIndex('users', 'username');
  pgm.createIndex('users', 'role');

  pgm.createIndex('user_settings', 'user_id');
  pgm.createIndex('user_settings', 'setting_key');

  pgm.createIndex('global_settings', 'setting_key');

  pgm.createIndex('media', 'status');
  pgm.createIndex('media', 'uploaded_by');
  pgm.createIndex('media', 'platform');
  pgm.createIndex('media', ['chart_name', 'chart_date']);
  pgm.createIndex('media', [{ name: 'created_at', sort: 'DESC' }], { name: 'idx_media_created_at' });

  pgm.createIndex('user_history', 'user_id');
  pgm.createIndex('user_history', 'media_id');
pgm.createIndex('user_history', [{ name: 'played_at', sort: 'DESC' }], { name: 'idx_user_history_played_at' });

  pgm.createIndex('likes', 'user_id');
  pgm.createIndex('likes', 'media_id');

  pgm.createIndex('download_tasks', 'status');
  pgm.createIndex('download_tasks', 'priority');
  pgm.createIndex('download_tasks', 'created_at');
  pgm.createIndex('download_tasks', 'requested_by');
  pgm.createIndex('download_tasks', ['status', 'priority', 'created_at'], {
    name: 'idx_download_tasks_worker',
    where: "status IN ('queued', 'downloading')",
  });

  pgm.createIndex('refresh_tokens', 'user_id');
  pgm.createIndex('refresh_tokens', 'expires_at');

  pgm.createIndex('artists', 'name');
  pgm.createIndex('artists', 'slug');

  pgm.createIndex('playlists', 'created_by');
  pgm.createIndex('playlists', 'is_public');

  pgm.createIndex('playlist_tracks', 'playlist_id');
  pgm.createIndex('playlist_tracks', ['playlist_id', 'position']);

  pgm.createIndex('media_artists', 'media_id');
  pgm.createIndex('media_artists', 'artist_id');

  // ── updated_at trigger ────────────────────────────────────────────────────

  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql'
  `);

  const triggeredTables = [
    'users',
    'user_settings',
    'global_settings',
    'media',
    'user_history',
    'download_tasks',
    'artists',
    'playlists',
  ];

  for (const table of triggeredTables) {
    pgm.sql(`
      CREATE TRIGGER update_${table}_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);
  }

  // ── Seed global settings ──────────────────────────────────────────────────

  pgm.sql(`
    INSERT INTO global_settings (setting_key, setting_value, data_type, description, is_public) VALUES
    ('max_concurrent_downloads',          '3',                                                                        'number',  'Maximum number of concurrent downloads',              false),
    ('default_video_quality',             '720p',                                                                     'string',  'Default video quality for downloads',                 true),
    ('default_audio_quality',             '192k',                                                                     'string',  'Default audio quality for downloads',                 true),
    ('max_file_size_mb',                  '500',                                                                      'number',  'Maximum file size for downloads in MB',               true),
    ('allowed_domains',                   '["youtube.com","youtu.be","vimeo.com","soundcloud.com"]',                  'json',    'Allowed domains for downloads',                       false),
    ('registration_enabled',              'true',                                                                     'boolean', 'Whether new user registration is enabled',            false),
    ('require_email_verification',        'false',                                                                    'boolean', 'Whether email verification is required',              false),
    ('max_downloads_per_user_per_day',    '100',                                                                      'number',  'Maximum downloads per user per day',                  true),
    ('cleanup_failed_downloads_after_hours', '24',                                                                   'number',  'Clean up failed downloads after N hours',             false),
    ('app_name',                          'OpenWav',                                                                  'string',  'Application name',                                    true),
    ('app_description',                   'A powerful media streaming application',                                   'string',  'Application description',                             true),
    ('max_auto_downloads',                '10',                                                                       'number',  'Maximum number of videos to auto-download from a search query', false)
    ON CONFLICT (setting_key) DO NOTHING
  `);
};

export const down = (pgm) => {
  const triggeredTables = [
    'users', 'user_settings', 'global_settings', 'media',
    'user_history', 'download_tasks', 'artists', 'playlists',
  ];
  for (const table of triggeredTables) {
    pgm.sql(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table}`);
  }
  pgm.sql(`DROP FUNCTION IF EXISTS update_updated_at_column`);

  pgm.dropTable('media_artists');
  pgm.dropTable('playlist_tracks');
  pgm.dropTable('playlists');
  pgm.dropTable('artists');
  pgm.dropTable('refresh_tokens');
  pgm.dropTable('download_tasks');
  pgm.dropTable('likes');
  pgm.dropTable('user_history');
  pgm.dropTable('media');
  pgm.dropTable('global_settings');
  pgm.dropTable('user_settings');
  pgm.dropTable('users');
};