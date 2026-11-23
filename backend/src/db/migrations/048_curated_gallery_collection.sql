CREATE TABLE IF NOT EXISTS curated_gallery_artworks (
  id CHAR(36) PRIMARY KEY,
  artist_id CHAR(36) NOT NULL,
  title VARCHAR(180) NOT NULL,
  medium VARCHAR(160) NOT NULL,
  dimensions VARCHAR(80) NOT NULL,
  year_made SMALLINT UNSIGNED NOT NULL,
  city VARCHAR(120) NOT NULL,
  price_amount INT UNSIGNED NOT NULL,
  status ENUM('AVAILABLE', 'COLLECTORS_PICK', 'SOLD') NOT NULL DEFAULT 'AVAILABLE',
  description TEXT NOT NULL,
  image_url VARCHAR(512) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_curated_gallery_artist_order (artist_id, sort_order),
  INDEX idx_curated_gallery_sort (sort_order, title),
  CONSTRAINT fk_curated_gallery_artist
    FOREIGN KEY (artist_id) REFERENCES artist_directory(id) ON DELETE CASCADE
);

INSERT INTO curated_gallery_artworks
  (id, artist_id, title, medium, dimensions, year_made, city, price_amount, status, description, image_url, sort_order)
SELECT UUID(), artist.id, seed.title, seed.medium, seed.dimensions, seed.year_made, artist.city,
       seed.price_amount, seed.status, seed.description, seed.image_url, seed.sort_order
FROM artist_directory AS artist
JOIN (
  SELECT 'vikramaditya-rathore' AS slug, 1 AS sort_order, 'The Blue Courtyard' AS title,
         'Miniature & Gold Leaf' AS medium, '24 × 36 in' AS dimensions, 2026 AS year_made,
         65000 AS price_amount, 'COLLECTORS_PICK' AS status,
         'A finely observed courtyard at the hour when Jaipur stone turns blue. Layered pigment, precise line and restrained gold leaf bring architectural detail into a contemporary composition.' AS description,
         '/media/installation.jpeg' AS image_url
  UNION ALL SELECT 'pratibha-yadav', 1, 'City Fragments: Monsoon at Five', 'Mixed Media on Canvas', '24 × 36 in', 2026, 42000, 'AVAILABLE',
         'Paint, paper and found textures gather the shifting light of a Mumbai monsoon. The layered surface moves between a remembered street and the city as it is lived today.',
         '/art-detail-painting.png'
  UNION ALL SELECT 'aarav-deshmukh', 1, 'The City in Impasto', 'Oil & Impasto on Canvas', '30 × 40 in', 2025, 78000, 'COLLECTORS_PICK',
         'A bold, tactile cityscape built with loaded brushwork. Dense architectural color opens into a luminous band of evening sky.',
         '/media/visual-art.jpeg'
  UNION ALL SELECT 'meera-nair', 1, 'Monsoon Herbarium', 'Watercolor on Archival Paper', '18 × 24 in', 2026, 28000, 'AVAILABLE',
         'A measured botanical study of leaves gathered after rain, painted in transparent washes that preserve the delicacy of each vein and stem.',
         '/media/visual-art.jpeg'
  UNION ALL SELECT 'kabir-malhotra', 1, 'Blue Hour, Reassembled', 'Acrylic & Texture on Canvas', '24 × 30 in', 2025, 52000, 'AVAILABLE',
         'Layered acrylic shapes move between the geometry of the capital and the open rhythm of abstraction. Raised pigment gives the surface a changing, low light.',
         '/media/hero-exhibition.jpg'
  UNION ALL SELECT 'ananya-chatterjee', 1, 'Between Two Silences', 'Charcoal on Cotton Paper', '20 × 28 in', 2026, 36000, 'COLLECTORS_PICK',
         'A quiet figurative study built from soft charcoal transitions. The unmarked paper is left visible as an active part of the portrait.',
         '/art-detail-painting.png'
  UNION ALL SELECT 'neha-kulkarni', 1, 'First Rain Vessel', 'Bronze & Terracotta', '14 × 18 × 12 in', 2025, 48000, 'AVAILABLE',
         'A hand-built vessel with a warm, mineral surface. Its uneven rim and finger marks retain the intimate rhythm of making.',
         '/media/ceramics.jpg'
  UNION ALL SELECT 'kavita-joshi', 1, 'The Tree Remembers', 'Madhubani & Natural Pigment', '24 × 30 in', 2026, 34000, 'AVAILABLE',
         'A living tree becomes a map of kinship, season and place. Repeated forms draw on folk pattern while opening a new, contemporary story.',
         '/media/installation.jpeg'
  UNION ALL SELECT 'saroj', 1, 'Lotus at Dawn', 'Acrylic on Canvas', '24 × 36 in', 2026, 18000, 'COLLECTORS_PICK',
         'A calm lotus pond at first light, painted in soft pinks and golds. Reflected color and open water create a moment of stillness.',
         '/media/visual-art.jpeg'
  UNION ALL SELECT 'priya-sharma', 1, 'Lake Pichola, First Light', 'Oil on Canvas', '24 × 36 in', 2025, 65000, 'AVAILABLE',
         'The first light of day settles over the water and pale stone of Udaipur. A restrained palette holds the landscape in a quiet, atmospheric balance.',
         '/media/exhibition-gallery.jpeg'
  UNION ALL SELECT 'vikramaditya-rathore', 2, 'Garden of the Monsoon Court', 'Miniature & Mineral Pigment', '18 × 24 in', 2025, 54000, 'AVAILABLE',
         'A garden scene unfolds through small, deliberate details: flowering vines, rain-darkened stone and a distant pavilion rendered in mineral color.',
         '/media/artifacts.jpeg'
  UNION ALL SELECT 'siddharth-menon', 1, 'Tidal Memory', 'Mixed Media & Resin', '30 × 40 in', 2026, 72000, 'COLLECTORS_PICK',
         'Transparent resin and layered pigment recall the shifting surface of Kerala’s coast. The work changes character as light moves across its reflective depths.',
         '/media/sculpture.jpeg'
  UNION ALL SELECT 'rohan-verma', 1, 'A Line Through Indore', 'Ink & Watercolor on Paper', '18 × 24 in', 2025, 22000, 'AVAILABLE',
         'A brisk city observation in ink and diluted color, tracing the layered signs, walls and passing life of an Indore street.',
         '/media/live-mural.jpeg'
  UNION ALL SELECT 'meera-nair', 2, 'A Quiet Bloom', 'Watercolor on Archival Paper', '16 × 20 in', 2025, 24000, 'SOLD',
         'A small botanical portrait of a flower just opening. Thin washes and carefully held white space give the study its soft luminosity.',
         '/media/ceramics.jpg'
  UNION ALL SELECT 'aarav-deshmukh', 2, 'Nocturne in Ochre', 'Oil on Canvas', '24 × 30 in', 2026, 59000, 'AVAILABLE',
         'A nocturnal city reduced to a few warm planes of color. The layered surface catches the last light against a deep, atmospheric ground.',
         '/media/hero-exhibition.jpg'
  UNION ALL SELECT 'neha-kulkarni', 2, 'Clay Chorus', 'Terracotta Sculpture', '12 × 16 × 10 in', 2026, 32000, 'SOLD',
         'A compact sculptural grouping of hand-built forms. Variations in the fired surface make each curve and indentation feel distinctly handmade.',
         '/art-sculpture-detail.png'
) AS seed ON seed.slug = artist.slug
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  medium = VALUES(medium),
  dimensions = VALUES(dimensions),
  year_made = VALUES(year_made),
  city = VALUES(city),
  price_amount = VALUES(price_amount),
  status = VALUES(status),
  description = VALUES(description),
  image_url = VALUES(image_url);
