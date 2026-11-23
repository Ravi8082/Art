UPDATE site_settings
SET value_json = JSON_SET(
  value_json,
  '$.mentor.name', 'Vinod Dara Singh',
  '$.mentor.bio', 'Strategic guidance and cultural mentorship for India’s emerging and established artists.'
)
WHERE setting_key = 'homepage'
  AND JSON_UNQUOTE(JSON_EXTRACT(value_json, '$.mentor.name')) = 'Vindu Dara Singh';
