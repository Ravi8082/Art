UPDATE site_settings
SET value_json = JSON_SET(
  value_json,
  '$.testimonials[2].message',
  'It was wonderful to see inclusive participation, especially the support for specially-abled artists — it is truly inspiring.'
)
WHERE setting_key = 'homepage'
  AND JSON_UNQUOTE(JSON_EXTRACT(value_json, '$.testimonials[2].authorName')) = 'Anjali Verma'
  AND JSON_UNQUOTE(JSON_EXTRACT(value_json, '$.testimonials[2].message')) = 'It was happy to see inclusive participation, especially the support for specially-abled artists — it is truly inspiring.';
