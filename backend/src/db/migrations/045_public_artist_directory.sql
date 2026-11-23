CREATE TABLE IF NOT EXISTS artist_directory (
  id CHAR(36) PRIMARY KEY,
  slug VARCHAR(180) NOT NULL UNIQUE,
  display_name VARCHAR(160) NOT NULL,
  city VARCHAR(120) NOT NULL DEFAULT '',
  medium VARCHAR(160) NOT NULL DEFAULT '',
  specialty VARCHAR(160) NOT NULL DEFAULT '',
  bio TEXT NOT NULL,
  portrait_url VARCHAR(512) NOT NULL,
  featured_artwork_url VARCHAR(512) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_artist_directory_order(sort_order, display_name)
);

CREATE TABLE IF NOT EXISTS artist_directory_artworks (
  id CHAR(36) PRIMARY KEY,
  artist_id CHAR(36) NOT NULL,
  title VARCHAR(180) NOT NULL,
  medium VARCHAR(160) NOT NULL DEFAULT '',
  dimensions VARCHAR(80) NOT NULL DEFAULT '',
  year_made SMALLINT UNSIGNED NULL,
  description VARCHAR(1000) NOT NULL DEFAULT '',
  image_url VARCHAR(512) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_artist_directory_artwork_order(artist_id, sort_order),
  FOREIGN KEY(artist_id) REFERENCES artist_directory(id) ON DELETE CASCADE
);

INSERT INTO artist_directory
  (id, slug, display_name, city, medium, specialty, bio, portrait_url, featured_artwork_url, sort_order)
VALUES
  ('a4500000-0000-4000-8000-000000000001', 'pratibha-yadav', 'Pratibha Yadav', 'Mumbai', 'Mixed Media', 'Layered mixed-media compositions inspired by everyday city life',
   'Mumbai-based artist Pratibha Yadav builds expressive mixed-media compositions from colour, texture and found forms. Her practice explores the quiet poetry of familiar streets, changing neighbourhoods and the small details people carry with them.',
   '/demo/artist2.jpg', '/demo/art-bloom.jpg', 1),
  ('a4500000-0000-4000-8000-000000000002', 'saroj', 'Saroj', 'Indore', 'Acrylic, Watercolor & Mixed Media', 'Luminous studies of nature, memory and Indian colour',
   'Indore artist Saroj moves between acrylic, watercolour and mixed media to create vivid, intimate studies of the natural world. Delicate washes meet confident marks in work shaped by memory, seasonal change and the visual language of home.',
   '/demo/artist6.jpg', '/demo/art-lotus.jpg', 2),
  ('a4500000-0000-4000-8000-000000000003', 'aarav-deshmukh', 'Aarav Deshmukh', 'Mumbai', 'Contemporary Oil & Impasto', 'Expressive oil paintings built through bold, tactile impasto',
   'Aarav Deshmukh is a Mumbai-based painter whose contemporary oil practice gives gesture and material a central role. Built in confident layers of impasto, his canvases translate the city’s changing light, movement and architecture into richly tactile compositions.',
   '/demo/artist1.jpg', '/demo/art-city.jpg', 3),
  ('a4500000-0000-4000-8000-000000000004', 'meera-nair', 'Meera Nair', 'Bengaluru', 'Watercolor & Botanical Art', 'Botanical watercolours attentive to the rhythms of growing things',
   'Bengaluru artist Meera Nair paints botanical forms with patience and precision, allowing translucent watercolour to preserve the delicacy of each leaf, seed and bloom. Her work is a continuing field journal of Indian gardens and their changing seasons.',
   '/demo/artist4.jpg', '/demo/art-tree.jpg', 4),
  ('a4500000-0000-4000-8000-000000000005', 'vikramaditya-rathore', 'Vikramaditya Rathore', 'Jaipur', 'Miniature & Heritage Folk', 'Contemporary narratives rooted in miniature painting traditions',
   'Working in Jaipur, Vikramaditya Rathore draws on the discipline of miniature painting and the storytelling traditions of Rajasthan. Fine line, jewel-like colour and carefully observed detail meet contemporary subjects in his heritage-informed practice.',
   '/demo/artist3.jpg', '/demo/art-mandala.jpg', 5),
  ('a4500000-0000-4000-8000-000000000006', 'ananya-chatterjee', 'Ananya Chatterjee', 'Kolkata', 'Charcoal & Figurative Realism', 'Intimate charcoal portraits exploring gesture and presence',
   'Kolkata-based Ananya Chatterjee works primarily in charcoal, building figurative studies from subtle shifts of tone and line. Her portraits focus on gesture and presence, balancing close observation with an empathetic, contemporary point of view.',
   '/demo/artist5.jpg', '/demo/art-gaze.jpg', 6),
  ('a4500000-0000-4000-8000-000000000007', 'kabir-malhotra', 'Kabir Malhotra', 'New Delhi', 'Abstract Acrylic & Texture', 'Textural abstractions shaped by colour, memory and movement',
   'Kabir Malhotra is a New Delhi abstract artist whose acrylic paintings are built through repeated gestures, layered pigment and tactile surfaces. His compositions take cues from urban rhythms while leaving space for each viewer to find a personal reading.',
   '/demo/artist1.jpg', '/demo/art-dusk.jpg', 7),
  ('a4500000-0000-4000-8000-000000000008', 'neha-kulkarni', 'Neha Kulkarni', 'Pune', 'Ceramic & Terracotta Sculpture', 'Hand-built sculptural forms inspired by earth and everyday rituals',
   'Pune artist Neha Kulkarni works with clay and terracotta to create hand-built sculptures that celebrate material, touch and everyday ritual. Her forms preserve the marks of making, bringing a grounded, contemporary sensibility to an ancient medium.',
   '/demo/artist4.jpg', '/media/ceramics.jpg', 8),
  ('a4500000-0000-4000-8000-000000000009', 'rohan-verma', 'Rohan Verma', 'Indore', 'Urban Sketching & Ink', 'Observational ink drawings of streets, people and changing places',
   'Rohan Verma documents Indore and the places beyond it through quick, observant ink drawings. A practice rooted in looking closely, his sketchbooks gather street corners, passing figures and architectural details into an evolving portrait of everyday life.',
   '/demo/artist3.jpg', '/demo/art-city.jpg', 9),
  ('a4500000-0000-4000-8000-000000000010', 'kavita-joshi', 'Kavita Joshi', 'Bhopal', 'Madhubani & Tribal Contemporary', 'A contemporary dialogue with folk pattern and living tradition',
   'Bhopal-based Kavita Joshi brings the pattern, rhythm and symbolism of folk traditions into a contemporary visual language. Her detailed works honour the knowledge carried through generations while making room for the stories and concerns of the present.',
   '/demo/artist6.jpg', '/demo/art-mandala.jpg', 10),
  ('a4500000-0000-4000-8000-000000000011', 'siddharth-menon', 'Siddharth Menon', 'Kochi', 'Mixed Media & Resin Art', 'Reflective mixed-media surfaces inspired by Kerala’s coast',
   'Kochi artist Siddharth Menon combines mixed media and resin to explore reflection, depth and the changing character of water. Pigment, found materials and transparent layers recall the shifting light and textures of Kerala’s coast.',
   '/demo/artist1.jpg', '/demo/art-tidal.jpg', 11),
  ('a4500000-0000-4000-8000-000000000012', 'priya-sharma', 'Priya Sharma', 'Udaipur', 'Landscape Oil on Canvas', 'Atmospheric landscapes shaped by the light of Rajasthan',
   'Priya Sharma paints the landscapes around Udaipur in oil, attentive to the subtle transitions between stone, water and sky. Her canvases gather the warmth of Rajasthan’s light into quiet compositions that reward unhurried looking.',
   '/demo/artist5.jpg', '/demo/art-dusk.jpg', 12)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  city = VALUES(city),
  medium = VALUES(medium),
  specialty = VALUES(specialty),
  bio = VALUES(bio),
  portrait_url = VALUES(portrait_url),
  featured_artwork_url = VALUES(featured_artwork_url),
  sort_order = VALUES(sort_order);

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
) AS work
WHERE artist.id IS NOT NULL
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  medium = VALUES(medium),
  dimensions = VALUES(dimensions),
  year_made = VALUES(year_made),
  description = VALUES(description),
  image_url = VALUES(image_url);
