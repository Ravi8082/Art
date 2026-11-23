UPDATE event_flow_content
SET kicker='FLAGSHIP NATIONAL ART FAIR · 3-DAY GRAND PRODUCTION',
    title='Where Art, Culture & Celebrated Icons Converge',
    subtitle='Experience the grand choreography of The Haat of Art—from red-carpet inauguration with celebrated stars and cultural patrons to live masterclasses, collector previews, and our national felicitation gala.',
    phases_json=JSON_SET(
      phases_json,
      '$[0].title', 'Curatorial & Spatial Setup',
      '$[0].timeframe', 'Day 0 · Morning – Evening',
      '$[0].introduction', 'A considered spatial plan brings every work, pavilion and visitor journey into focus before the opening.',
      '$[0].activities', JSON_ARRAY(
        'Museum-grade lighting and precision wall presentation',
        'Custom pavilions from 2m × 2m to 10m × 8m',
        '0% commission direct collector tags and artwork cataloguing',
        'Final curatorial readiness audit before the doors open'
      ),
      '$[1].title', 'Red-Carpet Inauguration & VIP Collector Preview',
      '$[1].timeframe', 'Day 1 · 10:30 AM – 1:00 PM',
      '$[1].introduction', 'The opening brings artists together with celebrated guests, cultural patrons, collectors and national media.',
      '$[1].activities', JSON_ARRAY(
        'Star Guests, Chief Guests & Cultural Patrons arrive',
        'Ceremonial lamp lighting and ribbon-cutting',
        'National press and media walkthrough',
        'Private collector acquisition preview'
      ),
      '$[2].title', 'Flagship Exhibition, Live Art & Master Workshops',
      '$[2].timeframe', 'Days 1–3 · 11:00 AM – 8:00 PM',
      '$[2].introduction', 'Three days of multi-hall discovery unite original work, live practice and inclusive public programming.',
      '$[2].activities', JSON_ARRAY(
        'Multi-hall painting, sculpture and 3D installations',
        'Live canvas creation by renowned participating artists',
        'Interactive master workshops and guided gallery visits',
        'Inclusive showcase pavilions for specially-abled artists'
      ),
      '$[3].title', 'Star-Studded Felicitation & National Award Gala',
      '$[3].timeframe', 'Final Day · 4:30 PM – 6:30 PM',
      '$[3].introduction', 'A celebratory gala recognises the artists and partners shaping the national art community.',
      '$[3].activities', JSON_ARRAY(
        'Chief Guests and Celebrities present trophies, mementos and official certificates',
        'National recognition for participating and specially-abled artists',
        'Sponsor and cultural partner honours on the main stage'
      ),
      '$[4].title', 'Grand Closing & Next-City Handover',
      '$[4].timeframe', 'Final Day · 6:30 PM – 8:30 PM',
      '$[4].introduction', 'The final evening closes the edition with a formal address, thoughtful collection handovers and a national curtain-raiser.',
      '$[4].activities', JSON_ARRAY(
        'Closing keynote and final collector conversations',
        '100% direct artist payout settlements',
        'White-glove artwork packing and supported de-installation',
        'Next-city curtain-raiser: Mumbai · Pune · Bengaluru · Delhi · Indore'
      )
    ),
    schedule_json='[{"day":"Day 1","title":"Inauguration & VIP Preview","items":[{"period":"Morning","time":"10:30 AM – 1:00 PM","activity":"Red-carpet arrival, ceremonial lamp lighting, media walkthrough and private collector preview"},{"period":"Afternoon","time":"1:00 PM – 4:30 PM","activity":"Flagship gallery opens across painting, sculpture and 3D art"},{"period":"Evening","time":"4:30 PM – 8:00 PM","activity":"Live art, artist introductions and collector conversations"}]},{"day":"Day 2","title":"Live Art & Master Workshops","items":[{"period":"Morning","time":"11:00 AM – 1:00 PM","activity":"Multi-hall gallery viewing and curated artist walkthroughs"},{"period":"Afternoon","time":"1:00 PM – 4:00 PM","activity":"Live canvas creation, interactive workshops and inclusive showcases"},{"period":"Evening","time":"4:00 PM – 8:00 PM","activity":"Artist talks, public programme and collector visits"}]},{"day":"Day 3","title":"National Award Gala & Grand Closing","items":[{"period":"Morning","time":"11:00 AM – 1:00 PM","activity":"Final-day gallery viewing and collector visits"},{"period":"Afternoon","time":"1:00 PM – 4:30 PM","activity":"Final acquisitions, direct artist settlements and gala preparations"},{"period":"Evening","time":"4:30 PM – 8:30 PM","activity":"Celebrity-led felicitation, national awards, closing keynote and artwork handover"}]}]'
WHERE id=1;
