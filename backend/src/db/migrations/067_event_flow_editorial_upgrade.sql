UPDATE event_flow_content
SET kicker='EXHIBITION BLUEPRINT · END-TO-END SCHEDULE',
    subtitle='From considered curatorial preparation and a distinguished opening preview to a public programme of art, dialogue and recognition, discover the journey behind every Haat of Art edition.',
    phases_json=JSON_SET(
      phases_json,
      '$[0].title', 'Setup & Curatorial Check-In',
      '$[0].introduction', 'A precise setup establishes a considered presentation for every participating artist and artwork.',
      '$[0].activities', JSON_ARRAY(
        'Artist registration, identity verification and stall handover',
        'Stall configurations from 2m × 2m to 10m × 8m, with professional lighting and wall presentation',
        'Artwork cataloguing and 0% commission direct-pricing labels',
        'Final curatorial walkthrough and readiness review'
      ),
      '$[1].title', 'Inauguration & Collector Preview',
      '$[1].introduction', 'The opening convenes artists, collectors, cultural leaders and exhibition partners.',
      '$[1].activities', JSON_ARRAY(
        'Arrival of Chief Guests, Cultural Patrons & Celebrated Luminaries',
        'Traditional lamp-lighting and ribbon-cutting ceremony',
        'Curated preview for invited collectors and media',
        'Inaugural gallery walkthrough with participating artists'
      ),
      '$[2].title', 'Exhibition, Live Art & Workshops',
      '$[2].introduction', 'A public programme brings original work, live practice and shared learning into one gallery.',
      '$[2].activities', JSON_ARRAY(
        'Curated presentation of painting, sculpture, 3D art and artifacts',
        'Live demonstrations by participating and master artists',
        'Hands-on workshops and guided visitor experiences',
        'Inclusive presentation for specially-abled artists'
      ),
      '$[3].title', 'Felicitation & Certificate Distribution',
      '$[3].introduction', 'The final-day programme recognises artistic achievement and the partners who make each edition possible.',
      '$[3].activities', JSON_ARRAY(
        'Artist felicitation, awards and official participation certificates',
        'Special recognition for emerging and specially-abled creators',
        'Acknowledgement of event partners and sponsors'
      ),
      '$[4].title', 'Grand Closing & Exhibition Wrap-Up',
      '$[4].introduction', 'A formal close brings the edition to completion and prepares the transition to the next city.',
      '$[4].activities', JSON_ARRAY(
        'Closing address and final collector conversations',
        'Direct artist settlements and confirmed purchases',
        'Safe artwork packing and supported de-installation',
        'Announcement of the next edition across Indore, Mumbai, Pune or Bengaluru'
      )
    ),
    schedule_json='[{"day":"Day 1","title":"Inauguration & Preview","items":[{"period":"Morning","time":"10:30 AM – 1:00 PM","activity":"Chief Guests, Cultural Patrons & Celebrated Luminaries; lamp lighting and collector preview"},{"period":"Afternoon","time":"1:00 PM – 4:30 PM","activity":"Public gallery opening, curated viewing and artist introductions"},{"period":"Evening","time":"4:30 PM – 8:00 PM","activity":"Live art, workshops and collector conversations"}]},{"day":"Day 2","title":"Exhibition & Workshops","items":[{"period":"Morning","time":"11:00 AM – 1:00 PM","activity":"Gallery opens; guided viewing across painting, sculpture and artifacts"},{"period":"Afternoon","time":"1:00 PM – 4:00 PM","activity":"Live demonstrations, workshops and inclusive artist showcases"},{"period":"Evening","time":"4:00 PM – 8:00 PM","activity":"Open exhibition, artist talks and visitor programme"}]},{"day":"Day 3","title":"Felicitation & Grand Closing","items":[{"period":"Morning","time":"11:00 AM – 1:00 PM","activity":"Final-day gallery viewing and collector visits"},{"period":"Afternoon","time":"1:00 PM – 4:30 PM","activity":"Final purchases, direct artist settlements and closing preparations"},{"period":"Evening","time":"4:30 PM – 8:30 PM","activity":"Artist felicitation, certificates, closing address and artwork wrap-up"}]}]'
WHERE id=1;
