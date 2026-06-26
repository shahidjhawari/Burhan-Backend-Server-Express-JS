/**
 * Maps Islamic terms across English, Urdu and Roman Urdu.
 * A search for "namaz" also matches "salah", "prayer", "نماز" etc.
 */

const islamicWordMap = {
  // Pillars / Worship
  namaz:    ["salah","salat","prayer","prayers","نماز","صلاۃ"],
  roza:     ["fasting","saum","sawm","روزہ","صوم","fast"],
  zakat:    ["charity","zakah","زکوٰۃ","zakaat","sadqah obligatory"],
  hajj:     ["pilgrimage","حج","haj","kaaba visit"],
  umrah:    ["umra","عمرہ","minor pilgrimage"],
  kalima:   ["shahadah","shahada","کلمہ","testimony of faith","kalma"],
  tawheed:  ["oneness of allah","monotheism","توحید","tawhid"],
  iman:     ["faith","belief","ایمان","emaan"],
  // Purification
  wuzu:     ["ablution","wudu","وضو","wazu"],
  ghusl:    ["bath","ritual bath","غسل","major purification"],
  tayammum: ["dry ablution","تیمم","sand purification"],
  taharat:  ["purity","cleanliness","طہارت"],
  // Quran
  quran:    ["qur'an","koran","قرآن","holy quran","quran majeed"],
  surah:    ["chapter","سورہ","سورت","sura"],
  ayah:     ["verse","آیت","ayat","aya"],
  tilawat:  ["recitation","تلاوت","reading quran"],
  tajweed:  ["quran pronunciation","تجوید","rules of recitation"],
  // Hadith
  hadith:   ["hadees","حدیث","sayings of prophet","hadeeth"],
  sunnah:   ["sunnat","سنت","way of prophet","prophet tradition"],
  bukhari:  ["sahih bukhari","بخاری","imam bukhari"],
  // Islamic Law
  farz:     ["obligatory","compulsory","فرض","mandatory"],
  wajib:    ["necessary","واجب","required"],
  haram:    ["forbidden","حرام","prohibited","not allowed"],
  halal:    ["permissible","حلال","allowed","lawful"],
  makruh:   ["disliked","مکروہ","discouraged"],
  shariah:  ["islamic law","شریعت","fiqh","islamic rulings"],
  fatwa:    ["islamic ruling","فتویٰ","religious verdict"],
  // Prophets / People
  prophet:  ["nabi","rasool","نبی","رسول","messenger","paigambar","پیغمبر"],
  allah:    ["god","رب","khuda","خدا","ilah"],
  muhammad: ["prophet muhammad","محمد","hazrat muhammad","pbuh"],
  sahaba:   ["companions","صحابہ","sahabah","sahabi"],
  imam:     ["leader","امام","religious leader"],
  // Afterlife
  jannat:   ["paradise","heaven","جنت","jannah"],
  jahannam: ["hell","hellfire","جہنم","jahanam","naar"],
  qiyamat:  ["judgment day","قیامت","day of judgement","last day"],
  maut:     ["death","موت","dying","wafat","وفات"],
  // Daily Life
  akhlaq:   ["character","اخلاق","morals","ethics","good manners"],
  sadaqah:  ["voluntary charity","صدقہ","sadqa"],
  dua:      ["supplication","دعا","prayer request","asking allah"],
  zikr:     ["remembrance","ذکر","dhikr","remembering allah"],
  tawbah:   ["repentance","توبہ","seeking forgiveness"],
  shukr:    ["gratitude","شکر","thankfulness"],
  sabr:     ["patience","صبر","perseverance"],
  // Places
  kaaba:    ["kaba","کعبہ","house of allah","baitullah","بیت اللہ","mecca"],
  masjid:   ["mosque","مسجد","masjed"],
  madina:   ["medina","مدینہ","city of prophet"],
  makkah:   ["mecca","مکہ","makka","holy city"],
};

/**
 * Expand a search query using Islamic word synonyms.
 * Returns array of unique terms including synonyms.
 */
const expandQuery = (query) => {
  if (!query) return [];
  const q = query.toLowerCase().trim();
  const terms = new Set(q.split(/\s+/).filter(Boolean));

  for (const [canonical, synonyms] of Object.entries(islamicWordMap)) {
    const allTerms = [canonical, ...synonyms.map((s) => s.toLowerCase())];
    const matched  = allTerms.some((t) => q.includes(t) || t.includes(q));
    if (matched) allTerms.forEach((t) => terms.add(t));
  }
  return [...terms];
};

module.exports = { islamicWordMap, expandQuery };
