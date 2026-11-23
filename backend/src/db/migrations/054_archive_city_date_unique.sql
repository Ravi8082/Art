CREATE UNIQUE INDEX uq_archive_edition_city_start_date
  ON exhibition_archive_editions (city, start_date);
