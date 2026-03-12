-- Ensure the global loan feature setting exists and is enabled
INSERT INTO platform_settings (key, value)
VALUES ('loan_feature_enabled', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true';

-- Verify the settings
SELECT * FROM platform_settings WHERE key = 'loan_feature_enabled';
