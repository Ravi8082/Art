UPDATE site_settings
SET value_json = JSON_SET(
  value_json,
  '$.highlights',
  JSON_ARRAY(
    JSON_OBJECT('title', 'Art Exhibitions', 'description', 'Curated showcases of contemporary and traditional art.'),
    JSON_OBJECT('title', 'Live Painting', 'description', 'Witness creativity in action by renowned artists.'),
    JSON_OBJECT('title', 'Sculpture & 3D Art', 'description', 'From classical to modern, exploring dimensional art forms.'),
    JSON_OBJECT('title', 'Visitor Workshops', 'description', 'Hands-on sessions to learn, create and experience art.'),
    JSON_OBJECT('title', 'Curated Collector Previews', 'description', 'A considered first look at featured works, artist stories and new collections.')
  ),
  '$.venuePartners',
  JSON_ARRAY(
    JSON_OBJECT('name', 'BIEC · Bangalore International Exhibition Centre'),
    JSON_OBJECT('name', 'PIEC · Pune International Exhibition Centre'),
    JSON_OBJECT('name', 'Pragati Maidan · New Delhi'),
    JSON_OBJECT('name', 'NESCO · Bombay Exhibition Centre, Mumbai'),
    JSON_OBJECT('name', 'Abhay Prashal · Indore')
  ),
  '$.testimonials[2].authorRole', 'Collector'
)
WHERE setting_key = 'homepage';
