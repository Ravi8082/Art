UPDATE curated_gallery_artworks
SET image_url = CASE title
  WHEN 'The Blue Courtyard' THEN '/media/homepage-reference/gallery2.png'
  WHEN 'City Fragments: Monsoon at Five' THEN '/media/live-mural.jpeg'
  WHEN 'The City in Impasto' THEN '/art-detail-painting.png'
  WHEN 'Monsoon Herbarium' THEN '/media/homepage-reference/gallery5.png'
  WHEN 'Blue Hour, Reassembled' THEN '/media/visual-art.jpeg'
  WHEN 'Between Two Silences' THEN '/media/homepage-reference/gallery3.png'
  WHEN 'First Rain Vessel' THEN '/media/ceramics.jpg'
  WHEN 'The Tree Remembers' THEN '/media/homepage-reference/exhibition2.png'
  WHEN 'Lotus at Dawn' THEN '/media/installation.jpeg'
  WHEN 'Lake Pichola, First Light' THEN '/media/homepage-reference/exhibition3.png'
  WHEN 'Garden of the Monsoon Court' THEN '/media/artifacts.jpeg'
  WHEN 'Tidal Memory' THEN '/art-gallery-visual.png'
  WHEN 'A Line Through Indore' THEN '/media/sculpture.jpeg'
  WHEN 'A Quiet Bloom' THEN '/media/homepage-reference/highlight2.png'
  WHEN 'Nocturne in Ochre' THEN '/art-sculpture-detail.png'
  WHEN 'Clay Chorus' THEN '/haat-hero-art.png'
  ELSE image_url
END
WHERE title IN (
  'The Blue Courtyard',
  'City Fragments: Monsoon at Five',
  'The City in Impasto',
  'Monsoon Herbarium',
  'Blue Hour, Reassembled',
  'Between Two Silences',
  'First Rain Vessel',
  'The Tree Remembers',
  'Lotus at Dawn',
  'Lake Pichola, First Light',
  'Garden of the Monsoon Court',
  'Tidal Memory',
  'A Line Through Indore',
  'A Quiet Bloom',
  'Nocturne in Ochre',
  'Clay Chorus'
);
