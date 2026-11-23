UPDATE exhibition_archive_media
SET source_url = CASE media_key
      WHEN 'mumbai-2025-painting-02' THEN '/media/visual-art.jpeg'
      WHEN 'bengaluru-2025-artists-01' THEN '/media/installation.jpeg'
      WHEN 'bengaluru-2025-craft-02' THEN '/media/ceramics.jpg'
      WHEN 'delhi-sept-2022-gallery-01' THEN '/art-gallery-visual.png'
      WHEN 'delhi-sept-2022-sculpture-02' THEN '/media/artifacts.jpeg'
      WHEN 'delhi-may-2022-gallery-01' THEN '/media/sculpture.jpeg'
      WHEN 'delhi-may-2022-painting-02' THEN '/media/live-mural.jpeg'
    END,
    alt_text = CASE media_key
      WHEN 'mumbai-2025-painting-02' THEN 'Visitors viewing artwork in a contemporary exhibition gallery'
      WHEN 'bengaluru-2025-artists-01' THEN 'Visitors discovering a large-scale sculpture at an art fair'
      WHEN 'bengaluru-2025-craft-02' THEN 'Hand-painted ceramics presented as exhibition works'
      WHEN 'delhi-sept-2022-gallery-01' THEN 'Visitors viewing artwork in a contemporary exhibition gallery'
      WHEN 'delhi-sept-2022-sculpture-02' THEN 'A sculptural artwork displayed in an exhibition'
      WHEN 'delhi-may-2022-gallery-01' THEN 'A contemporary sculpture presented in a gallery'
      WHEN 'delhi-may-2022-painting-02' THEN 'A large painted mural presented as an exhibition work'
    END
WHERE media_key IN (
  'mumbai-2025-painting-02',
  'bengaluru-2025-artists-01',
  'bengaluru-2025-craft-02',
  'delhi-sept-2022-gallery-01',
  'delhi-sept-2022-sculpture-02',
  'delhi-may-2022-gallery-01',
  'delhi-may-2022-painting-02'
);
