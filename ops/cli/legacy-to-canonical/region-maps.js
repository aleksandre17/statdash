/* region-maps.js — curated, canonical EN names for file-3 (ka-only source).
 * These are official territorial/activity names, NOT guesses (ADR-0030 §9-A). */
'use strict';

// Official region EN names, keyed by cleaned KA region name.
const REGION_EN = {
  'თბილისი': 'Tbilisi',
  'აჭარის ა.რ.': 'Adjara A.R.',
  'გურია': 'Guria',
  'იმერეთი': 'Imereti',
  'კახეთი': 'Kakheti',
  'მცხეთა-მთიანეთი': 'Mtskheta-Mtianeti',
  'რაჭა-ლეჩხუმი და ქვემო სვანეთი': 'Racha-Lechkhumi and Kvemo Svaneti',
  'სამეგრელო-ზემო სვანეთი': 'Samegrelo-Zemo Svaneti',
  'სამცხე-ჯავახეთი': 'Samtskhe-Javakheti',
  'ქვემო ქართლი': 'Kvemo Kartli',
  'შიდა ქართლი': 'Shida Kartli',
  'აფხაზეთი': 'Abkhazia',
};

// Curated activity EN names, keyed by source activity id (col B). 'OTH' = residual.
const ACTIVITY_EN = {
  '1': 'Agriculture, forestry and fishing',
  '3': 'Manufacturing',
  '6': 'Construction',
  '7': 'Wholesale and retail trade; repair of motor vehicles and motorcycles',
  '8': 'Transportation and storage',
  '12': 'Real estate activities',
  '15': 'Public administration and defence; compulsory social security',
  '16': 'Education',
  'OTH': 'Other',
};

module.exports = { REGION_EN, ACTIVITY_EN };
