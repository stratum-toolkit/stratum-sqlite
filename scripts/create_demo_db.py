#!/usr/bin/env python3
"""
scripts/create_demo_db.py
Creates docs/data/countries.sqlite
Run from project root: python3 scripts/create_demo_db.py
"""
import sqlite3, os

os.makedirs("docs/data", exist_ok=True)
db_path = "docs/data/countries.sqlite"
if os.path.exists(db_path):
    os.remove(db_path)

con = sqlite3.connect(db_path)
cur = con.cursor()

cur.executescript("""
CREATE TABLE countries (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, iso2 TEXT NOT NULL,
  iso3 TEXT NOT NULL, capital TEXT, region TEXT, subregion TEXT,
  population INTEGER, area_km2 REAL, gdp_usd_bn REAL
);
CREATE TABLE languages (
  id INTEGER PRIMARY KEY, country_iso TEXT NOT NULL,
  language TEXT NOT NULL, official INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE indicators (
  id INTEGER PRIMARY KEY, country_iso TEXT NOT NULL, year INTEGER NOT NULL,
  life_expectancy REAL, literacy_pct REAL, internet_pct REAL
);
""")

countries = [
  (1,'Norway','NO','NOR','Oslo','Europe','Northern Europe',5450000,385207,593.0),
  (2,'Sweden','SE','SWE','Stockholm','Europe','Northern Europe',10500000,450295,627.0),
  (3,'Denmark','DK','DNK','Copenhagen','Europe','Northern Europe',5900000,43094,406.0),
  (4,'Finland','FI','FIN','Helsinki','Europe','Northern Europe',5560000,338424,302.0),
  (5,'Iceland','IS','ISL','Reykjavik','Europe','Northern Europe',376000,103000,27.0),
  (6,'Germany','DE','DEU','Berlin','Europe','Western Europe',84000000,357114,4456.0),
  (7,'France','FR','FRA','Paris','Europe','Western Europe',68000000,551695,3050.0),
  (8,'United Kingdom','GB','GBR','London','Europe','Northern Europe',67000000,242495,3131.0),
  (9,'Netherlands','NL','NLD','Amsterdam','Europe','Western Europe',17900000,41543,1080.0),
  (10,'Canada','CA','CAN','Ottawa','Americas','Northern America',38200000,9984670,2140.0),
  (11,'United States','US','USA','Washington D.C.','Americas','Northern America',331000000,9833517,25460.0),
  (12,'Japan','JP','JPN','Tokyo','Asia','Eastern Asia',125700000,377975,4231.0),
  (13,'South Korea','KR','KOR','Seoul','Asia','Eastern Asia',51700000,100210,1810.0),
  (14,'Australia','AU','AUS','Canberra','Oceania','Australia and New Zealand',25900000,7692024,1700.0),
  (15,'New Zealand','NZ','NZL','Wellington','Oceania','Australia and New Zealand',5100000,270467,246.0),
  (16,'Brazil','BR','BRA','Brasilia','Americas','South America',215000000,8515767,1920.0),
  (17,'Argentina','AR','ARG','Buenos Aires','Americas','South America',45600000,2780400,641.0),
  (18,'South Africa','ZA','ZAF','Pretoria','Africa','Southern Africa',60000000,1221037,419.0),
  (19,'Nigeria','NG','NGA','Abuja','Africa','Western Africa',218000000,923768,477.0),
  (20,'Kenya','KE','KEN','Nairobi','Africa','Eastern Africa',55000000,580367,113.0),
]
cur.executemany("INSERT INTO countries VALUES (?,?,?,?,?,?,?,?,?,?)", countries)

languages = [
  ('NOR','Norwegian',1),('NOR','Sami',1),('SWE','Swedish',1),('DNK','Danish',1),
  ('FIN','Finnish',1),('FIN','Swedish',1),('ISL','Icelandic',1),('DEU','German',1),
  ('FRA','French',1),('GBR','English',1),('NLD','Dutch',1),('CAN','English',1),
  ('CAN','French',1),('USA','English',1),('USA','Spanish',0),('JPN','Japanese',1),
  ('KOR','Korean',1),('AUS','English',1),('NZL','English',1),('NZL','Maori',1),
  ('BRA','Portuguese',1),('ARG','Spanish',1),('ZAF','Zulu',1),('ZAF','Xhosa',1),
  ('ZAF','Afrikaans',1),('ZAF','English',1),('NGA','English',1),('NGA','Hausa',0),
  ('NGA','Yoruba',0),('KEN','Swahili',1),('KEN','English',1),
]
cur.executemany("INSERT INTO languages(country_iso,language,official) VALUES (?,?,?)", languages)

indicators = [
  ('NOR',2022,83.2,99.0,97.3),('NOR',2021,83.0,99.0,97.0),
  ('SWE',2022,83.0,99.0,95.0),('SWE',2021,82.7,99.0,94.5),
  ('DNK',2022,81.6,99.0,94.0),('DNK',2021,81.4,99.0,93.8),
  ('FIN',2022,82.0,99.0,93.0),('FIN',2021,81.8,99.0,92.5),
  ('ISL',2022,83.5,99.0,99.0),('ISL',2021,83.1,99.0,98.7),
  ('DEU',2022,81.3,99.0,91.0),('DEU',2021,81.1,99.0,90.5),
  ('FRA',2022,82.3,99.0,88.0),('FRA',2021,82.0,99.0,87.5),
  ('GBR',2022,81.3,99.0,94.8),('GBR',2021,81.0,99.0,94.2),
  ('NLD',2022,82.3,99.0,95.0),('NLD',2021,82.0,99.0,94.5),
  ('CAN',2022,82.3,99.0,93.5),('CAN',2021,82.0,99.0,93.0),
  ('USA',2022,79.1,99.0,91.8),('USA',2021,78.5,99.0,91.0),
  ('JPN',2022,84.3,99.0,90.3),('JPN',2021,84.1,99.0,90.0),
  ('KOR',2022,83.6,99.0,97.6),('KOR',2021,83.3,99.0,97.0),
  ('AUS',2022,83.5,99.0,90.0),('AUS',2021,83.2,99.0,89.5),
  ('NZL',2022,82.5,99.0,90.5),('NZL',2021,82.2,99.0,90.0),
  ('BRA',2022,75.9,94.2,81.0),('BRA',2021,75.3,94.0,80.0),
  ('ARG',2022,76.7,99.0,78.5),('ARG',2021,76.5,99.0,77.8),
  ('ZAF',2022,64.9,95.0,72.0),('ZAF',2021,64.5,94.5,70.5),
  ('NGA',2022,55.2,62.0,55.4),('NGA',2021,54.8,61.5,53.0),
  ('KEN',2022,68.7,82.6,43.0),('KEN',2021,68.0,82.0,40.0),
]
cur.executemany(
  "INSERT INTO indicators(country_iso,year,life_expectancy,literacy_pct,internet_pct) VALUES (?,?,?,?,?)",
  indicators
)

con.commit()
con.close()
print(f"Created: {db_path}  ({os.path.getsize(db_path):,} bytes)")
