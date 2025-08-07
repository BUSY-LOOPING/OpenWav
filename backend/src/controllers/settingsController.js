const { query } = require('../config/database');
const { logger } = require('../config/logger');
const { validationResult } = require('express-validator');

const getUserSettings = async (req, res) => {
  try {
    const userId = req.user.id;

    const userSettingsResult = await query(
      'SELECT setting_key, setting_value, data_type FROM user_settings WHERE user_id = $1',
      [userId]
    );

    const globalSettingsResult = await query(
      'SELECT setting_key, setting_value, data_type FROM global_settings WHERE is_public = true'
    );

    const settings = {};
    
    globalSettingsResult.rows.forEach(row => {
      settings[row.setting_key] = parseSettingValue(row.setting_value, row.data_type);
    });

    userSettingsResult.rows.forEach(row => {
      settings[row.setting_key] = parseSettingValue(row.setting_value, row.data_type);
    });

    res.json({
      success: true,
      data: { settings }
    });

  } catch (error) {
    logger.error('Get user settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const updateUserSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const userId = req.user.id;

    if (value === null || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Setting value is required'
      });
    }

    const allowedUserSettings = [
      'theme',
      'language',
      'default_video_quality',
      'default_audio_quality',
      'auto_play',
      'show_thumbnails',
      'notifications_enabled',
      'email_notifications',
      'privacy_mode',
      'playback_speed',
      'volume_level',
      'subtitle_language',
      'download_location_preference'
    ];

    if (!allowedUserSettings.includes(key)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid setting key'
      });
    }

    const { dataType, validatedValue } = validateSettingValue(key, value);

    const result = await query(
      `INSERT INTO user_settings (user_id, setting_key, setting_value, data_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, setting_key)
       DO UPDATE SET 
         setting_value = $3,
         data_type = $4,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, key, validatedValue, dataType]
    );

    const setting = result.rows[0];

    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: {
        setting: {
          key: setting.setting_key,
          value: parseSettingValue(setting.setting_value, setting.data_type),
          updatedAt: setting.updated_at
        }
      }
    });

  } catch (error) {
    logger.error('Update user setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update setting',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const deleteUserSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const userId = req.user.id;

    await query(
      'DELETE FROM user_settings WHERE user_id = $1 AND setting_key = $2',
      [userId, key]
    );

    const globalResult = await query(
      'SELECT setting_value, data_type FROM global_settings WHERE setting_key = $1 AND is_public = true',
      [key]
    );

    let defaultValue = null;
    if (globalResult.rows.length > 0) {
      const globalSetting = globalResult.rows[0];
      defaultValue = parseSettingValue(globalSetting.setting_value, globalSetting.data_type);
    }

    res.json({
      success: true,
      message: 'Setting reset to default',
      data: {
        setting: {
          key,
          value: defaultValue
        }
      }
    });

  } catch (error) {
    logger.error('Delete user setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset setting',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const updateUserSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    const userId = req.user.id;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Settings object is required'
      });
    }

    const allowedUserSettings = [
      'theme',
      'language',
      'default_video_quality',
      'default_audio_quality',
      'auto_play',
      'show_thumbnails',
      'notifications_enabled',
      'email_notifications',
      'privacy_mode',
      'playback_speed',
      'volume_level',
      'subtitle_language',
      'download_location_preference'
    ];

    const updatedSettings = {};
    const errors = [];

    for (const [key, value] of Object.entries(settings)) {
      try {
        if (!allowedUserSettings.includes(key)) {
          errors.push(`Invalid setting key: ${key}`);
          continue;
        }

        const { dataType, validatedValue } = validateSettingValue(key, value);

        const result = await query(
          `INSERT INTO user_settings (user_id, setting_key, setting_value, data_type)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, setting_key)
           DO UPDATE SET 
             setting_value = $3,
             data_type = $4,
             updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [userId, key, validatedValue, dataType]
        );

        const setting = result.rows[0];
        updatedSettings[key] = parseSettingValue(setting.setting_value, setting.data_type);

      } catch (error) {
        errors.push(`Failed to update ${key}: ${error.message}`);
      }
    }

    res.json({
      success: errors.length === 0,
      message: errors.length === 0 ? 'Settings updated successfully' : 'Some settings failed to update',
      data: {
        settings: updatedSettings,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    logger.error('Update user settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getUserPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const userSettingsResult = await query(
      'SELECT setting_key, setting_value, data_type, updated_at FROM user_settings WHERE user_id = $1',
      [userId]
    );

    const globalSettingsResult = await query(
      'SELECT setting_key, setting_value, data_type, description FROM global_settings WHERE is_public = true'
    );

    const settingCategories = {
      playback: {
        title: 'Playback Settings',
        settings: {
          default_video_quality: {
            title: 'Default Video Quality',
            type: 'select',
            options: ['144p', '240p', '360p', '480p', '720p', '1080p'],
            default: '720p'
          },
          default_audio_quality: {
            title: 'Default Audio Quality',
            type: 'select',
            options: ['96k', '128k', '192k', '256k', '320k'],
            default: '192k'
          },
          auto_play: {
            title: 'Auto-play Next Media',
            type: 'boolean',
            default: false
          },
          playback_speed: {
            title: 'Default Playback Speed',
            type: 'select',
            options: ['0.5', '0.75', '1.0', '1.25', '1.5', '2.0'],
            default: '1.0'
          },
          volume_level: {
            title: 'Default Volume Level',
            type: 'number',
            min: 0,
            max: 100,
            default: 80
          }
        }
      },
      interface: {
        title: 'Interface Settings',
        settings: {
          theme: {
            title: 'Theme',
            type: 'select',
            options: ['light', 'dark', 'auto'],
            default: 'auto'
          },
          language: {
            title: 'Language',
            type: 'select',
            options: ['en', 'es', 'fr', 'de', 'ja', 'ko'],
            default: 'en'
          },
          show_thumbnails: {
            title: 'Show Thumbnails',
            type: 'boolean',
            default: true
          }
        }
      },
      notifications: {
        title: 'Notifications',
        settings: {
          notifications_enabled: {
            title: 'Enable Notifications',
            type: 'boolean',
            default: true
          },
          email_notifications: {
            title: 'Email Notifications',
            type: 'boolean',
            default: false
          }
        }
      },
      privacy: {
        title: 'Privacy Settings',
        settings: {
          privacy_mode: {
            title: 'Privacy Mode',
            type: 'boolean',
            description: 'Hide your activity from other users',
            default: false
          }
        }
      }
    };

    const preferences = {};
    
    const userSettings = {};
    userSettingsResult.rows.forEach(row => {
      userSettings[row.setting_key] = parseSettingValue(row.setting_value, row.data_type);
    });

    const globalSettings = {};
    globalSettingsResult.rows.forEach(row => {
      globalSettings[row.setting_key] = parseSettingValue(row.setting_value, row.data_type);
    });

    for (const [categoryKey, category] of Object.entries(settingCategories)) {
      preferences[categoryKey] = {
        title: category.title,
        settings: {}
      };

      for (const [settingKey, settingMeta] of Object.entries(category.settings)) {
        const currentValue = userSettings[settingKey] !== undefined 
          ? userSettings[settingKey] 
          : (globalSettings[settingKey] !== undefined 
            ? globalSettings[settingKey] 
            : settingMeta.default);

        preferences[categoryKey].settings[settingKey] = {
          ...settingMeta,
          value: currentValue,
          isCustom: userSettings[settingKey] !== undefined
        };
      }
    }

    res.json({
      success: true,
      data: { preferences }
    });

  } catch (error) {
    logger.error('Get user preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user preferences',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getPublicSettings = async (req, res) => {
  try {
    const result = await query(
      'SELECT setting_key, setting_value, data_type FROM global_settings WHERE is_public = true'
    );

    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = parseSettingValue(row.setting_value, row.data_type);
    });

    res.json({
      success: true,
      data: { settings }
    });

  } catch (error) {
    logger.error('Get public settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get public settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

function parseSettingValue(value, dataType) {
  if (!value) return null;

  switch (dataType) {
    case 'number':
      return parseFloat(value);
    case 'boolean':
      return value === 'true' || value === true;
    case 'json':
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    default:
      return value;
  }
}

function validateSettingValue(key, value) {
  let dataType = 'string';
  let validatedValue = value;

  const validationRules = {
    theme: {
      type: 'string',
      options: ['light', 'dark', 'auto']
    },
    language: {
      type: 'string',
      options: ['en', 'es', 'fr', 'de', 'ja', 'ko']
    },
    default_video_quality: {
      type: 'string',
      options: ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p']
    },
    default_audio_quality: {
      type: 'string',
      options: ['96k', '128k', '192k', '256k', '320k']
    },
    auto_play: {
      type: 'boolean'
    },
    show_thumbnails: {
      type: 'boolean'
    },
    notifications_enabled: {
      type: 'boolean'
    },
    email_notifications: {
      type: 'boolean'
    },
    privacy_mode: {
      type: 'boolean'
    },
    playback_speed: {
      type: 'string',
      options: ['0.5', '0.75', '1.0', '1.25', '1.5', '2.0']
    },
    volume_level: {
      type: 'number',
      min: 0,
      max: 100
    },
    subtitle_language: {
      type: 'string'
    },
    download_location_preference: {
      type: 'string'
    }
  };

  const rule = validationRules[key];
  if (!rule) {
    throw new Error('Unknown setting key');
  }

  dataType = rule.type;

  switch (rule.type) {
    case 'boolean':
      validatedValue = String(Boolean(value));
      break;
    
    case 'number':
      if (isNaN(value)) {
        throw new Error('Value must be a number');
      }
      const numValue = Number(value);
      if (rule.min !== undefined && numValue < rule.min) {
        throw new Error(`Value must be at least ${rule.min}`);
      }
      if (rule.max !== undefined && numValue > rule.max) {
        throw new Error(`Value must be at most ${rule.max}`);
      }
      validatedValue = String(numValue);
      break;
    
    case 'string':
      if (rule.options && !rule.options.includes(value)) {
        throw new Error(`Value must be one of: ${rule.options.join(', ')}`);
      }
      validatedValue = String(value);
      break;
    
    case 'json':
      if (typeof value === 'object') {
        validatedValue = JSON.stringify(value);
      } else {
        try {
          JSON.parse(value);
          validatedValue = String(value);
        } catch (e) {
          throw new Error('Invalid JSON value');
        }
      }
      break;
    
    default:
      validatedValue = String(value);
  }

  return { dataType, validatedValue };
}

module.exports = {
  getUserSettings,
  updateUserSetting,
  deleteUserSetting,
  updateUserSettings,
  getUserPreferences,
  getPublicSettings
};