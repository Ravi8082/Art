ALTER TABLE artist_directory
  ADD COLUMN roster_badge VARCHAR(100) NULL DEFAULT NULL,
  ADD COLUMN is_spotlight TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN spotlight_quote VARCHAR(1000) NULL DEFAULT NULL;

UPDATE artist_directory
SET
  medium = CASE WHEN slug = 'vikramaditya-rathore' THEN 'Miniature & Contemporary Heritage' ELSE medium END,
  roster_badge = CASE slug
    WHEN 'pratibha-yadav' THEN 'Mumbai 2026 Exhibitor'
    WHEN 'saroj' THEN 'Collector''s Pick'
    WHEN 'aarav-deshmukh' THEN 'New Roster'
    WHEN 'meera-nair' THEN 'Collector''s Pick'
    WHEN 'vikramaditya-rathore' THEN 'Curator''s Choice'
    WHEN 'ananya-chatterjee' THEN 'New Roster'
    WHEN 'kabir-malhotra' THEN 'Mumbai 2026 Exhibitor'
    WHEN 'neha-kulkarni' THEN 'Collector''s Pick'
    WHEN 'rohan-verma' THEN 'New Roster'
    WHEN 'kavita-joshi' THEN 'Collector''s Pick'
    WHEN 'siddharth-menon' THEN 'Mumbai 2026 Exhibitor'
    WHEN 'priya-sharma' THEN 'New Roster'
    ELSE roster_badge
  END,
  is_spotlight = (slug = 'vikramaditya-rathore'),
  spotlight_quote = CASE
    WHEN slug = 'vikramaditya-rathore' THEN 'A miniature painting is a universe held in stillness: every fine line carries a story, and every colour remembers a place.'
    ELSE NULL
  END;

INSERT INTO artist_directory_artworks
  (id, artist_id, title, medium, dimensions, year_made, description, image_url, sort_order)
SELECT UUID(), artist.id, CONCAT(artist.display_name, ' — ', work.title), artist.medium,
       CASE work.slot WHEN 1 THEN '60 × 80 cm' WHEN 2 THEN '50 × 70 cm' WHEN 3 THEN '40 × 60 cm'
         WHEN 4 THEN '45 × 60 cm' WHEN 5 THEN '30 × 40 cm' ELSE '50 × 50 cm' END,
       2025, work.description, work.image_url, work.slot
FROM artist_directory AS artist
CROSS JOIN (
  SELECT 1 AS slot, 'Monsoon Garden' AS title, 'A study in colour, texture and the changing Indian landscape.' AS description, '/demo/art-bloom.jpg' AS image_url
  UNION ALL SELECT 2, 'City in Motion', 'An expressive composition inspired by the movement of the city.', '/demo/art-city.jpg'
  UNION ALL SELECT 3, 'After the Rains', 'Layered forms and tonal contrasts capture a shifting evening sky.', '/demo/art-dusk.jpg'
  UNION ALL SELECT 4, 'Quiet Observations', 'A considered study of shape, gesture and everyday detail.', '/demo/art-gaze.jpg'
  UNION ALL SELECT 5, 'Garden of Memory', 'Natural forms arranged as a personal reflection on memory.', '/demo/art-lotus.jpg'
  UNION ALL SELECT 6, 'Living Patterns', 'Traditional pattern and contemporary colour meet in this work.', '/demo/art-mandala.jpg'
  UNION ALL SELECT 7, 'Blue Courtyard', 'A quiet architectural scene composed in cool, measured tones.', '/demo/art-tree.jpg'
  UNION ALL SELECT 8, 'Market at Dawn', 'The first light of day settles over a familiar city market.', '/demo/art-city.jpg'
  UNION ALL SELECT 9, 'The Sacred Lake', 'A reflective landscape shaped by water, sky and local memory.', '/demo/art-tidal.jpg'
  UNION ALL SELECT 10, 'A New Season', 'Fresh forms and colour mark the beginning of a new season.', '/demo/art-bloom.jpg'
  UNION ALL SELECT 11, 'The Last Light', 'Warm evening light transforms the edges of an everyday place.', '/demo/art-dusk.jpg'
  UNION ALL SELECT 12, 'Stories in Ochre', 'Earth pigments and layered marks hold a series of small stories.', '/demo/art-mandala.jpg'
  UNION ALL SELECT 13, 'Evening Raga', 'Rhythm and colour gather into a composition inspired by music.', '/demo/art-lotus.jpg'
  UNION ALL SELECT 14, 'Forest of Forms', 'Organic shapes and fine details trace the richness of nature.', '/demo/art-tree.jpg'
  UNION ALL SELECT 15, 'Lotus Study', 'A close study of the lotus as a symbol of renewal and grace.', '/demo/art-lotus.jpg'
  UNION ALL SELECT 16, 'The River Remembers', 'Shifting water becomes a record of movement and memory.', '/demo/art-tidal.jpg'
  UNION ALL SELECT 17, 'Palace in Stillness', 'A measured architectural scene shaped by heritage and silence.', '/demo/art-gaze.jpg'
  UNION ALL SELECT 18, 'A Folk Tale', 'Pattern and narrative meet in a contemporary folk-inspired work.', '/demo/art-mandala.jpg'
) AS work
WHERE work.slot <= CASE artist.slug
  WHEN 'pratibha-yadav' THEN 14
  WHEN 'saroj' THEN 9
  WHEN 'aarav-deshmukh' THEN 18
  WHEN 'meera-nair' THEN 11
  WHEN 'vikramaditya-rathore' THEN 18
  WHEN 'ananya-chatterjee' THEN 7
  WHEN 'kabir-malhotra' THEN 15
  WHEN 'neha-kulkarni' THEN 12
  WHEN 'rohan-verma' THEN 9
  WHEN 'kavita-joshi' THEN 16
  WHEN 'siddharth-menon' THEN 13
  WHEN 'priya-sharma' THEN 10
  ELSE 6
END
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  medium = VALUES(medium),
  dimensions = VALUES(dimensions),
  year_made = VALUES(year_made),
  description = VALUES(description),
  image_url = VALUES(image_url);
