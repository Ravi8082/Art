ALTER TABLE artist_directory
  ADD COLUMN state VARCHAR(120) NOT NULL DEFAULT '',
  ADD COLUMN artist_statement VARCHAR(1000) NOT NULL DEFAULT '',
  ADD COLUMN practice_detail TEXT NULL,
  ADD COLUMN active_since SMALLINT UNSIGNED NOT NULL DEFAULT 2020,
  ADD COLUMN core_themes TEXT NULL,
  ADD COLUMN exhibition_history TEXT NULL;

ALTER TABLE artist_directory_artworks
  ADD COLUMN status ENUM('AVAILABLE', 'EXHIBITION_PIECE', 'SOLD') NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN price_amount INT UNSIGNED NULL DEFAULT NULL;

UPDATE artist_directory
SET
  state = CASE city
    WHEN 'Mumbai' THEN 'Maharashtra'
    WHEN 'Indore' THEN 'Madhya Pradesh'
    WHEN 'Bengaluru' THEN 'Karnataka'
    WHEN 'Jaipur' THEN 'Rajasthan'
    WHEN 'Kolkata' THEN 'West Bengal'
    WHEN 'New Delhi' THEN 'Delhi'
    WHEN 'Pune' THEN 'Maharashtra'
    WHEN 'Bhopal' THEN 'Madhya Pradesh'
    WHEN 'Kochi' THEN 'Kerala'
    WHEN 'Udaipur' THEN 'Rajasthan'
    ELSE ''
  END,
  artist_statement = CASE slug
    WHEN 'pratibha-yadav' THEN 'I collect fragments of the everyday city and let colour, paper and memory find their own arrangement.'
    WHEN 'saroj' THEN 'I paint the natural world as it is remembered: luminous, changing and full of quiet detail.'
    WHEN 'aarav-deshmukh' THEN 'The surface is part of the story; each impasto mark holds a moment of movement and light.'
    WHEN 'meera-nair' THEN 'A botanical study begins with looking slowly, then making room for the life held in every leaf.'
    WHEN 'vikramaditya-rathore' THEN 'A miniature painting is a universe held in stillness: every fine line carries a story, and every colour remembers a place.'
    WHEN 'ananya-chatterjee' THEN 'Charcoal lets me stay close to the human gesture, where a quiet shift of tone can say everything.'
    WHEN 'kabir-malhotra' THEN 'I build a painting through layers and pauses, leaving space for the viewer to complete its movement.'
    WHEN 'neha-kulkarni' THEN 'Clay remembers the hand; I leave those traces visible as a record of touch and time.'
    WHEN 'rohan-verma' THEN 'My sketchbook is a way of paying attention to the ordinary places that make a city feel lived in.'
    WHEN 'kavita-joshi' THEN 'I carry inherited patterns forward by allowing their forms to speak to the present.'
    WHEN 'siddharth-menon' THEN 'Transparent layers hold the changing light of the coast and the memories it brings to the surface.'
    WHEN 'priya-sharma' THEN 'I return to the landscape to follow the changing edge between stone, water and sky.'
    ELSE ''
  END,
  practice_detail = CASE slug
    WHEN 'pratibha-yadav' THEN 'Working between painting, collage and found materials, Yadav builds each surface gradually. Torn edges and translucent layers echo the way a city is continually remade, while intimate details invite viewers to recognise their own daily journeys.'
    WHEN 'saroj' THEN 'Her process moves between measured observation and intuitive mark-making. Watercolour washes, acrylic passages and collected textures come together in compositions that hold the warmth of familiar gardens and domestic memory.'
    WHEN 'aarav-deshmukh' THEN 'Deshmukh works directly into the paint, using palette knife and brush to create a surface that catches changing light. His compositions balance the density of the metropolis with moments of open colour and stillness.'
    WHEN 'meera-nair' THEN 'Nair combines field notes with studio studies, returning to the same plants across seasons. Fine drawing and transparent washes preserve the structure of each specimen without losing its sense of movement and growth.'
    WHEN 'vikramaditya-rathore' THEN 'Rathore studies traditional miniature techniques while composing scenes with a contemporary point of view. Precise line, layered natural pigments and jewel-toned details make each work a close-reading experience.'
    WHEN 'ananya-chatterjee' THEN 'Chatterjee develops a portrait through repeated looking, allowing the paper to remain active within the image. Her restrained tonal range gives particular attention to posture, expression and the space between people.'
    WHEN 'kabir-malhotra' THEN 'Malhotra builds his abstract surfaces through successive applications of pigment and texture. The process is open-ended: a form may be covered, recovered and transformed until the painting finds its own rhythm.'
    WHEN 'neha-kulkarni' THEN 'Kulkarni hand-builds and fires her forms in small series, preserving the irregularities of the making process. Earth, ritual and the familiar objects of daily life inform her quietly sculptural language.'
    WHEN 'rohan-verma' THEN 'Verma works on location with a compact set of drawing tools, recording buildings, street life and passing light. These observations become an evolving archive of places seen from within.'
    WHEN 'kavita-joshi' THEN 'Joshi approaches folk pattern as a living language rather than a fixed motif. Repetition, natural forms and a considered palette create works that hold both cultural memory and present-day experience.'
    WHEN 'siddharth-menon' THEN 'Menon layers pigment, resin and found material to create depth without concealing the process. Reflections, coastal textures and shifting colour connect his studio work to the waters around Kochi.'
    WHEN 'priya-sharma' THEN 'Sharma returns to familiar sites at different hours, using oil paint to follow the changing quality of light. Her measured compositions leave room for the atmosphere and silence of the landscape.'
    ELSE ''
  END,
  active_since = CASE slug
    WHEN 'pratibha-yadav' THEN 2019
    WHEN 'saroj' THEN 2017
    WHEN 'aarav-deshmukh' THEN 2015
    WHEN 'meera-nair' THEN 2020
    WHEN 'vikramaditya-rathore' THEN 2014
    WHEN 'ananya-chatterjee' THEN 2018
    WHEN 'kabir-malhotra' THEN 2016
    WHEN 'neha-kulkarni' THEN 2019
    WHEN 'rohan-verma' THEN 2021
    WHEN 'kavita-joshi' THEN 2016
    WHEN 'siddharth-menon' THEN 2018
    WHEN 'priya-sharma' THEN 2017
    ELSE 2020
  END,
  core_themes = CASE slug
    WHEN 'pratibha-yadav' THEN 'Urban life|Memory|Found forms'
    WHEN 'saroj' THEN 'Nature|Seasonal change|Home'
    WHEN 'aarav-deshmukh' THEN 'Movement|City light|Architecture'
    WHEN 'meera-nair' THEN 'Botany|Growth|Observation'
    WHEN 'vikramaditya-rathore' THEN 'Heritage|Storytelling|Nature'
    WHEN 'ananya-chatterjee' THEN 'Gesture|Presence|Human connection'
    WHEN 'kabir-malhotra' THEN 'Abstraction|Materiality|Movement'
    WHEN 'neha-kulkarni' THEN 'Earth|Ritual|Touch'
    WHEN 'rohan-verma' THEN 'City life|Place|Daily ritual'
    WHEN 'kavita-joshi' THEN 'Living tradition|Pattern|Identity'
    WHEN 'siddharth-menon' THEN 'Water|Reflection|Coastal memory'
    WHEN 'priya-sharma' THEN 'Landscape|Light|Stillness'
    ELSE ''
  END,
  exhibition_history = CASE slug
    WHEN 'pratibha-yadav' THEN 'The Haat of Art — Mumbai 2026|The Haat of Art — 2026 Curated Roster'
    WHEN 'saroj' THEN 'The Haat of Art — 2026 Curated Roster|The Haat of Art — Pan-India Digital Showcase'
    WHEN 'aarav-deshmukh' THEN 'The Haat of Art — Mumbai 2026|The Haat of Art — 2026 Curated Roster'
    WHEN 'meera-nair' THEN 'The Haat of Art — Bengaluru 2026|The Haat of Art — 2026 Curated Roster'
    WHEN 'vikramaditya-rathore' THEN 'The Haat of Art — 2026 Curator’s Spotlight|The Haat of Art — 2026 Curated Roster'
    WHEN 'ananya-chatterjee' THEN 'The Haat of Art — 2026 Curated Roster|The Haat of Art — Pan-India Digital Showcase'
    WHEN 'kabir-malhotra' THEN 'The Haat of Art — Mumbai 2026|The Haat of Art — 2026 Curated Roster'
    WHEN 'neha-kulkarni' THEN 'The Haat of Art — 2026 Curated Roster|The Haat of Art — Pan-India Digital Showcase'
    WHEN 'rohan-verma' THEN 'The Haat of Art — Indore 2026|The Haat of Art — 2026 Curated Roster'
    WHEN 'kavita-joshi' THEN 'The Haat of Art — 2026 Curated Roster|The Haat of Art — Pan-India Digital Showcase'
    WHEN 'siddharth-menon' THEN 'The Haat of Art — 2026 Curated Roster|The Haat of Art — Pan-India Digital Showcase'
    WHEN 'priya-sharma' THEN 'The Haat of Art — 2026 Curated Roster|The Haat of Art — Pan-India Digital Showcase'
    ELSE ''
  END;

ALTER TABLE artist_directory
  MODIFY COLUMN practice_detail TEXT NOT NULL,
  MODIFY COLUMN core_themes TEXT NOT NULL,
  MODIFY COLUMN exhibition_history TEXT NOT NULL;

UPDATE artist_directory_artworks
SET
  status = CASE
    WHEN MOD(sort_order, 7) = 0 THEN 'SOLD'
    WHEN MOD(sort_order, 3) = 0 THEN 'EXHIBITION_PIECE'
    ELSE 'AVAILABLE'
  END,
  price_amount = CASE
    WHEN MOD(sort_order, 7) = 0 THEN NULL
    ELSE 42000 + (sort_order * 3500)
  END;
