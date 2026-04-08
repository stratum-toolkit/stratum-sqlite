# scripts/create_demo_db.R
# Creates docs/data/countries.sqlite
# Run from the project root: Rscript scripts/create_demo_db.R

library(DBI)
library(RSQLite)

db_path <- "docs/data/countries.sqlite"
dir.create(dirname(db_path), recursive = TRUE, showWarnings = FALSE)
con <- dbConnect(SQLite(), db_path)

# ── Tables ──────────────────────────────────────────────────────────────────
dbExecute(con, "DROP TABLE IF EXISTS indicators")
dbExecute(con, "DROP TABLE IF EXISTS languages")
dbExecute(con, "DROP TABLE IF EXISTS countries")

dbExecute(con, "
CREATE TABLE countries (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  iso2        TEXT NOT NULL,
  iso3        TEXT NOT NULL,
  capital     TEXT,
  region      TEXT,
  subregion   TEXT,
  population  INTEGER,
  area_km2    REAL,
  gdp_usd_bn  REAL
)")

dbExecute(con, "
CREATE TABLE languages (
  id          INTEGER PRIMARY KEY,
  country_iso TEXT NOT NULL,
  language    TEXT NOT NULL,
  official    INTEGER NOT NULL DEFAULT 1
)")

dbExecute(con, "
CREATE TABLE indicators (
  id              INTEGER PRIMARY KEY,
  country_iso     TEXT NOT NULL,
  year            INTEGER NOT NULL,
  life_expectancy REAL,
  literacy_pct    REAL,
  internet_pct    REAL
)")

# ── Data ────────────────────────────────────────────────────────────────────
countries <- data.frame(
  id = 1:20,
  name = c("Norway","Sweden","Denmark","Finland","Iceland",
           "Germany","France","United Kingdom","Netherlands",
           "Canada","United States","Japan","South Korea",
           "Australia","New Zealand","Brazil","Argentina",
           "South Africa","Nigeria","Kenya"),
  iso2 = c("NO","SE","DK","FI","IS","DE","FR","GB","NL",
            "CA","US","JP","KR","AU","NZ","BR","AR","ZA","NG","KE"),
  iso3 = c("NOR","SWE","DNK","FIN","ISL","DEU","FRA","GBR","NLD",
            "CAN","USA","JPN","KOR","AUS","NZL","BRA","ARG","ZAF","NGA","KEN"),
  capital = c("Oslo","Stockholm","Copenhagen","Helsinki","Reykjavik",
              "Berlin","Paris","London","Amsterdam","Ottawa",
              "Washington D.C.","Tokyo","Seoul","Canberra","Wellington",
              "Brasilia","Buenos Aires","Pretoria","Abuja","Nairobi"),
  region = c(rep("Europe",9), rep("Americas",3), rep("Asia",2),
             rep("Oceania",2), rep("Americas",2), rep("Africa",2), "Africa"),
  subregion = c(rep("Northern Europe",5), rep("Western Europe",4),
                rep("Northern America",3), rep("Eastern Asia",2),
                rep("Australia and New Zealand",2),
                rep("South America",2), "Southern Africa",
                "Western Africa", "Eastern Africa"),
  population = c(5450000,10500000,5900000,5560000,376000,
                 84000000,68000000,67000000,17900000,
                 38200000,331000000,125700000,51700000,
                 25900000,5100000,215000000,45600000,
                 60000000,218000000,55000000),
  area_km2 = c(385207,450295,43094,338424,103000,
               357114,551695,242495,41543,9984670,
               9833517,377975,100210,7692024,270467,
               8515767,2780400,1221037,923768,580367),
  gdp_usd_bn = c(593,627,406,302,27,4456,3050,3131,1080,
                 2140,25460,4231,1810,1700,246,
                 1920,641,419,477,113)
)

dbWriteTable(con, "countries", countries, append = TRUE)

languages <- data.frame(
  country_iso = c("NOR","NOR","SWE","DNK","FIN","FIN","ISL",
                  "DEU","FRA","GBR","NLD","CAN","CAN","USA","USA",
                  "JPN","KOR","AUS","NZL","NZL","BRA","ARG",
                  "ZAF","ZAF","ZAF","ZAF","NGA","NGA","NGA","KEN","KEN"),
  language    = c("Norwegian","Sami","Swedish","Danish","Finnish","Swedish","Icelandic",
                  "German","French","English","Dutch","English","French","English","Spanish",
                  "Japanese","Korean","English","English","Maori","Portuguese","Spanish",
                  "Zulu","Xhosa","Afrikaans","English","English","Hausa","Yoruba","Swahili","English"),
  official    = c(1,1,1,1,1,1,1, 1,1,1,1,1,1,1,0, 1,1,1,1,1,1,1, 1,1,1,1,1,0,0,1,1)
)
dbWriteTable(con, "languages", languages, append = TRUE)

indicators <- data.frame(
  country_iso     = rep(c("NOR","SWE","DNK","FIN","ISL","DEU","FRA","GBR","NLD",
                           "CAN","USA","JPN","KOR","AUS","NZL","BRA","ARG","ZAF","NGA","KEN"), each=2),
  year            = rep(c(2022,2021), 20),
  life_expectancy = c(83.2,83.0, 83.0,82.7, 81.6,81.4, 82.0,81.8, 83.5,83.1,
                      81.3,81.1, 82.3,82.0, 81.3,81.0, 82.3,82.0, 82.3,82.0,
                      79.1,78.5, 84.3,84.1, 83.6,83.3, 83.5,83.2, 82.5,82.2,
                      75.9,75.3, 76.7,76.5, 64.9,64.5, 55.2,54.8, 68.7,68.0),
  literacy_pct    = c(99,99, 99,99, 99,99, 99,99, 99,99,
                      99,99, 99,99, 99,99, 99,99, 99,99,
                      99,99, 99,99, 99,99, 99,99, 99,99,
                      94.2,94.0, 99,99, 95,94.5, 62,61.5, 82.6,82.0),
  internet_pct    = c(97.3,97.0, 95.0,94.5, 94.0,93.8, 93.0,92.5, 99.0,98.7,
                      91.0,90.5, 88.0,87.5, 94.8,94.2, 95.0,94.5, 93.5,93.0,
                      91.8,91.0, 90.3,90.0, 97.6,97.0, 90.0,89.5, 90.5,90.0,
                      81.0,80.0, 78.5,77.8, 72.0,70.5, 55.4,53.0, 43.0,40.0)
)
dbWriteTable(con, "indicators", indicators, append = TRUE)

dbDisconnect(con)
cat("Created:", db_path, "\n")
cat("Size:", file.size(db_path), "bytes\n")
