import { resolve } from 'node:path'
import {
  normaliseTitle,
  readJsonFile,
  writeJsonFile,
} from './catalog-shared.ts'
import {
  catalogSourcesSchema,
  moodDimensionKeys,
  trackSchema,
  type CatalogSources,
  type MoodVector,
  type Track,
} from '../src/config/schemas.ts'

type SnapshotTrack = {
  trackId: number
  title: string
  artist: string
  collectionId: number
  album: string
  releaseDate: string | null
  genre: string
  trackNumber: number | null
  discNumber: number | null
  officialAppleMusicUrl: string
}

type SnapshotRelease = {
  collectionId: number
  album: string
  releaseDate: string | null
  trackCount: number
  genre: string
  officialAppleMusicUrl: string
  tracks: SnapshotTrack[]
}

type AppleSnapshot = {
  schemaVersion: number
  fetchedAt: string
  provider: string
  artist: {
    id: number
    name: string
    officialArtistUrl: string
  }
  releases: SnapshotRelease[]
}

type MoodProfile = {
  moods: MoodVector
  tempoClass: Track['tempoClass']
  intensity: number
  contexts: string[]
  vocalCharacter: string[]
  instrumentalCharacter: string[]
  avoidWhen: string[]
  summary: string
}

const selection: Record<string, string[]> = {
  'Siti Nurhaliza': [
    'Jawapan Di Persimpangan',
    'Mahligai Asmara',
    'Jerat Percintaan',
    'Antara Waktu Dan Usia',
    'Sanggar Bayu',
    'Bicara Luka',
  ],
  'Aku Cinta Padamu': [
    'Aku Cinta Padamu',
    'Wajah Kekasih',
    'Kesilapanku, Keegoanmu',
    'Khayalan Cinta',
    'Usah Diragui',
    'Rindu Di Antara Kita',
  ],
  Cindai: [
    'Cindai',
    'Laksamana Mati Dibunuh',
    'Janji',
    'Lela Manja',
    'Joget Pahang',
    'Joget Berhibur',
  ],
  Adiwarna: [
    'Purnama Merindu',
    'Sendiri',
    'Diari Hatimu',
    'Satu Cinta Dua Jiwa',
    'Tak Boleh Lupa',
    'Gelora Asmara',
  ],
  Pancawarna: [
    'Nian Di Hati',
    'Seribu Kemanisan',
    'Engkau Bagaikan Permata',
    'Lelaki (Warkah Seorang Anak)',
    'Kedamaian',
    'Kau Kekasihku',
  ],
  Sahmura: [
    'Balqis',
    'Joget Kasih Tak Sudah',
    'Zapin Cinta Asmara',
    'Canggai',
    'Pawana Sampaikanlah Salam',
    'Berpantun Kasih',
  ],
  Safa: [
    'Azimat Cinta',
    'Bicara Manis Menghiris Kalbu',
    'Jalinan Cinta',
    'Indah Percintaan',
    'Percayalah',
    'Lakaran Kehidupan',
  ],
  'Sanggar Mustika': [
    'Nirmala',
    'Joget Senyum Memikat',
    'Panas Berteduh Gelap Bersuluh',
    'Kurik Kundi',
    'Badarsila',
    'Syair Kamelia',
  ],
  'E.M.A.S': [
    'Bukan Cinta Biasa',
    'Debaran Cinta',
    'Untuk Selamanya',
    'Oda Bumi Anbia',
    'Janji Kasih',
    'Airmata Ibu',
  ],
  'Prasasti Seni': [
    'Dialah Di Hati',
    'Pendirianku',
    'Cinta Tak Berganti',
    'Cahaya Seribu Liku',
    'Lagu Rindu',
    'Pejam Matamu',
  ],
  Transkripsi: [
    'Siti Situ Sana Sini',
    'Biarlah Rahsia',
    'Destinasi Cinta',
    'Cuba Untuk Mengerti',
    'Hidup Penuh Bicara',
    'Intrig Cinta',
  ],
  'Hadiah Daripada Hati': [
    'Ku Mahu',
    'Melawan Kesepian',
    'Mulanya Cinta',
    'Tanpa Kalian',
    'Wanita',
    'Sekian Lama',
  ],
  'Lentera Timur': [
    'Di Kayangan Kita',
    'Bintang Malam',
    'Cinta Ini',
    'Seloka Budi',
    'Senyum Minang Manis',
    'Joget Menanti Kasih',
  ],
  'Tahajjud Cinta': [
    'Asma Ul Husna',
    'Pintu Rindu',
    'Tahajjud Cinta',
    'Ku Percaya Ada Cinta',
    'Selawat',
  ],
  'All Your Love': [
    'All Your Love',
    'Nobody Else',
    'Falling In Love',
    'Fight for Love',
    'Remember You (feat. Sean Kingston)',
  ],
  Fragmen: [
    'Aku',
    'Jaga Dia Untukku',
    'Mula Dan Akhir',
    'Terbaik Bagimu',
    'Warna Dunia',
    'Lebih Indah',
  ],
  SimetriSiti: [
    'Bersandar Cinta',
    'Penghiburku (feat. Joe Flizzow)',
    'Ikrar Cinta',
    'Segala Perasaan',
    'Aku Bukan Malaikat',
    'Kisah Ku Inginkan',
  ],
  ManifestaSITI2020: [
    'Siapa Tak Mahu',
    'Aku Bidadari Syurgamu',
    'Tertulis Nama Kita',
    '7 Nasihat',
    'Kuasa Cintamu',
    'Terang',
    'Anta Permana',
  ],
  SITISM: [
    'Menyapa Dunia',
    'Tanpa Diri-Mu',
    'Sehebat Matahari (feat. Nao Zumar)',
    'Romansa Kita',
    'Teratas',
    'Menjaga Cintamu (Original Soundtrack From Anwar, The Untold Story)',
    'Magis',
  ],
  'Gema Bumantara': [
    'Kumbang Bunga',
    'Hati Yang Rindu',
    'Rencong',
    'Pesanan Buat Diri',
    'Syurgaloka',
    'Kesuma',
    'Cenderamaya',
  ],
  'Gema Hari Raya': [
    'Aidilfitri Di Alaf Baru',
    'Nikmat Hari Raya',
    'Sesuci Lebaran',
  ],
  'Salam Aidilfitri': ['Nazam Lebaran', 'Bila Hari Raya Menjelma'],
  'Seluruh Cinta - Single': ['Seluruh Cinta'],
  'Dirgahayu - Single': ['Dirgahayu'],
  'You Came to Me (feat. Dato\' Sri Siti Nurhaliza) - Single': [
    'You Came to Me (feat. Dato\' Sri Siti Nurhaliza)',
  ],
  'Dua Dunia (feat. Siti Nurhaliza) - Single': [
    'Dua Dunia (feat. Siti Nurhaliza)',
  ],
  'Muara Hati - Single': ['Muara Hati'],
  'Galau - Single': ['Galau'],
  'Mikraj Cinta - Single': ['Mikraj Cinta'],
  'Milikmu Selamanya - Single': ['Milikmu Selamanya'],
  'Bersandar Cinta (feat. Dato\' Sri Siti Nurhaliza) [From "Aubrey Suwito and Friends with the Malaysian Philharmonic Orchestra"] - Single': [
    'Bersandar Cinta (feat. Dato\' Sri Siti Nurhaliza) [From "Aubrey Suwito and Friends with the Malaysian Philharmonic Orchestra"]',
  ],
  'Ikhlas - Single': ['Ikhlas'],
  'Cinta Tak Mungkin - Single': ['Cinta Tak Mungkin'],
  'Sejarah - Single': ['Sejarah'],
  'Menamakanmu Cinta - Single': ['Menamakanmu Cinta'],
  'SESAL - Single': ['SESAL'],
  'Beraya Dengan Saya - Single': ['Beraya Dengan Saya'],
  '像水一樣 - Single': ['像水一樣'],
}

const moodProfiles: Record<string, MoodProfile> = {
  'romantic-ballad': {
    moods: {
      peaceful: 62,
      happy: 44,
      romantic: 91,
      confident: 55,
      energised: 33,
      nostalgic: 72,
      elegant: 86,
      comforted: 72,
      dramatic: 70,
    },
    tempoClass: 'slow',
    intensity: 62,
    contexts: ['evening', 'date-night', 'reflecting'],
    vocalCharacter: ['tender', 'expressive', 'poised'],
    instrumentalCharacter: ['ballad setting', 'measured pace'],
    avoidWhen: ['seeking a very energetic background'],
    summary: 'romantic warmth, elegant phrasing and reflective ballad energy',
  },
  'melancholic-reflective': {
    moods: {
      peaceful: 58,
      happy: 23,
      romantic: 67,
      confident: 38,
      energised: 25,
      nostalgic: 82,
      elegant: 82,
      comforted: 60,
      dramatic: 84,
    },
    tempoClass: 'slow',
    intensity: 66,
    contexts: ['night', 'reflecting', 'quiet-listening'],
    vocalCharacter: ['reflective', 'emotionally focused'],
    instrumentalCharacter: ['slow build', 'spacious ballad setting'],
    avoidWhen: ['seeking a carefree or highly upbeat mood'],
    summary: 'reflective emotion, nostalgia and a measured dramatic pull',
  },
  'comforting-inspirational': {
    moods: {
      peaceful: 79,
      happy: 65,
      romantic: 44,
      confident: 72,
      energised: 47,
      nostalgic: 46,
      elegant: 76,
      comforted: 91,
      dramatic: 36,
    },
    tempoClass: 'medium',
    intensity: 48,
    contexts: ['morning', 'self-care', 'relaxing'],
    vocalCharacter: ['warm', 'reassuring'],
    instrumentalCharacter: ['gentle lift', 'balanced pace'],
    avoidWhen: ['seeking high dramatic intensity'],
    summary: 'comforting warmth, steady confidence and an uplifting middle energy',
  },
  'upbeat-pop': {
    moods: {
      peaceful: 26,
      happy: 91,
      romantic: 55,
      confident: 81,
      energised: 91,
      nostalgic: 40,
      elegant: 63,
      comforted: 47,
      dramatic: 46,
    },
    tempoClass: 'fast',
    intensity: 77,
    contexts: ['cooking', 'driving', 'getting-ready', 'daytime'],
    vocalCharacter: ['bright', 'lively'],
    instrumentalCharacter: ['rhythm-led', 'forward-moving'],
    avoidWhen: ['seeking a very quiet or sleepy atmosphere'],
    summary: 'bright pop energy, confidence and a lively forward pulse',
  },
  'traditional-spirited': {
    moods: {
      peaceful: 31,
      happy: 79,
      romantic: 51,
      confident: 89,
      energised: 83,
      nostalgic: 89,
      elegant: 91,
      comforted: 53,
      dramatic: 76,
    },
    tempoClass: 'fast',
    intensity: 80,
    contexts: ['cooking', 'celebration', 'daytime'],
    vocalCharacter: ['ornamented', 'confident', 'animated'],
    instrumentalCharacter: ['traditional rhythmic setting', 'dance-led movement'],
    avoidWhen: ['seeking minimal background music'],
    summary: 'spirited traditional colour, rhythmic motion and confident elegance',
  },
  'traditional-graceful': {
    moods: {
      peaceful: 68,
      happy: 58,
      romantic: 66,
      confident: 71,
      energised: 49,
      nostalgic: 91,
      elegant: 95,
      comforted: 73,
      dramatic: 56,
    },
    tempoClass: 'medium',
    intensity: 57,
    contexts: ['evening', 'cooking', 'heritage-listening'],
    vocalCharacter: ['ornamented', 'graceful', 'poised'],
    instrumentalCharacter: ['traditional setting', 'measured rhythmic flow'],
    avoidWhen: ['seeking contemporary electronic pop'],
    summary: 'graceful traditional colour, nostalgia and measured elegance',
  },
  'power-ballad': {
    moods: {
      peaceful: 36,
      happy: 39,
      romantic: 80,
      confident: 86,
      energised: 61,
      nostalgic: 61,
      elegant: 89,
      comforted: 54,
      dramatic: 95,
    },
    tempoClass: 'medium',
    intensity: 88,
    contexts: ['focused-listening', 'evening', 'singalong'],
    vocalCharacter: ['commanding', 'dramatic', 'expansive'],
    instrumentalCharacter: ['dynamic build', 'large-scale ballad setting'],
    avoidWhen: ['seeking low intensity or unobtrusive background music'],
    summary: 'dramatic vocal scale, confident presence and romantic intensity',
  },
  'modern-confident': {
    moods: {
      peaceful: 29,
      happy: 73,
      romantic: 60,
      confident: 93,
      energised: 85,
      nostalgic: 26,
      elegant: 85,
      comforted: 41,
      dramatic: 81,
    },
    tempoClass: 'fast',
    intensity: 83,
    contexts: ['getting-ready', 'driving', 'daytime'],
    vocalCharacter: ['confident', 'direct', 'polished'],
    instrumentalCharacter: ['contemporary pop setting', 'strong rhythmic lift'],
    avoidWhen: ['seeking a very calm reflective mood'],
    summary: 'modern production energy, confident presence and polished drama',
  },
  'spiritual-calm': {
    moods: {
      peaceful: 93,
      happy: 56,
      romantic: 21,
      confident: 70,
      energised: 31,
      nostalgic: 55,
      elegant: 89,
      comforted: 95,
      dramatic: 36,
    },
    tempoClass: 'slow',
    intensity: 42,
    contexts: ['quiet-morning', 'reflecting', 'relaxing'],
    vocalCharacter: ['serene', 'reverent', 'gentle'],
    instrumentalCharacter: ['unhurried setting', 'restrained accompaniment'],
    avoidWhen: ['seeking a party atmosphere'],
    summary: 'serene reflection, comfort and an unhurried spiritual atmosphere',
  },
  festive: {
    moods: {
      peaceful: 30,
      happy: 97,
      romantic: 30,
      confident: 82,
      energised: 95,
      nostalgic: 76,
      elegant: 56,
      comforted: 72,
      dramatic: 35,
    },
    tempoClass: 'fast',
    intensity: 78,
    contexts: ['celebration', 'family-gathering', 'festive'],
    vocalCharacter: ['bright', 'communal', 'lively'],
    instrumentalCharacter: ['festive rhythm', 'celebratory setting'],
    avoidWhen: ['outside a festive listening context'],
    summary: 'festive joy, communal energy and a familiar celebratory signal',
  },
  'duet-romantic': {
    moods: {
      peaceful: 46,
      happy: 58,
      romantic: 93,
      confident: 76,
      energised: 56,
      nostalgic: 46,
      elegant: 83,
      comforted: 63,
      dramatic: 89,
    },
    tempoClass: 'medium',
    intensity: 79,
    contexts: ['evening', 'date-night', 'focused-listening'],
    vocalCharacter: ['conversational', 'expressive', 'contrasting voices'],
    instrumentalCharacter: ['duet setting', 'dynamic build'],
    avoidWhen: ['seeking a solo vocal performance'],
    summary: 'romantic duet interplay, expressive contrast and dramatic lift',
  },
  'english-pop': {
    moods: {
      peaceful: 35,
      happy: 81,
      romantic: 71,
      confident: 83,
      energised: 79,
      nostalgic: 25,
      elegant: 69,
      comforted: 50,
      dramatic: 56,
    },
    tempoClass: 'fast',
    intensity: 72,
    contexts: ['driving', 'getting-ready', 'daytime'],
    vocalCharacter: ['bright', 'polished'],
    instrumentalCharacter: ['international pop setting', 'rhythmic lift'],
    avoidWhen: ['seeking traditional repertoire'],
    summary: 'English-language pop energy, romantic brightness and confidence',
  },
  'balanced-elegant': {
    moods: {
      peaceful: 66,
      happy: 56,
      romantic: 66,
      confident: 66,
      energised: 46,
      nostalgic: 51,
      elegant: 89,
      comforted: 71,
      dramatic: 51,
    },
    tempoClass: 'medium',
    intensity: 54,
    contexts: ['evening', 'relaxing', 'background-listening'],
    vocalCharacter: ['poised', 'polished'],
    instrumentalCharacter: ['balanced arrangement', 'measured pace'],
    avoidWhen: ['seeking extreme energy or drama'],
    summary: 'balanced emotion, polished elegance and medium energy',
  },
}

const reviewedAssignments: Record<string, string[]> = {
  'romantic-ballad': [
    'Mahligai Asmara',
    'Jerat Percintaan',
    'Aku Cinta Padamu',
    'Wajah Kekasih',
    'Kesilapanku, Keegoanmu',
    'Khayalan Cinta',
    'Purnama Merindu',
    'Diari Hatimu',
    'Satu Cinta Dua Jiwa',
    'Seribu Kemanisan',
    'Kau Kekasihku',
    'Azimat Cinta',
    'Jalinan Cinta',
    'Percayalah',
    'Bukan Cinta Biasa',
    'Debaran Cinta',
    'Janji Kasih',
    'Cinta Tak Berganti',
    'Lagu Rindu',
    'Pejam Matamu',
    'Biarlah Rahsia',
    'Melawan Kesepian',
    'Mulanya Cinta',
    'Lebih Indah',
    'Ikrar Cinta',
    'Romansa Kita',
    'Menjaga Cintamu (Original Soundtrack From Anwar, The Untold Story)',
    'Menamakanmu Cinta',
  ],
  'melancholic-reflective': [
    'Bicara Luka',
    'Sendiri',
    'Gelora Asmara',
    'Bicara Manis Menghiris Kalbu',
    'Airmata Ibu',
    'Cuba Untuk Mengerti',
    'Tanpa Kalian',
    'Galau',
    'Jaga Dia Untukku',
    'Segala Perasaan',
    'SESAL',
  ],
  'traditional-spirited': [
    'Cindai',
    'Laksamana Mati Dibunuh',
    'Joget Pahang',
    'Joget Berhibur',
    'Balqis',
    'Joget Kasih Tak Sudah',
    'Zapin Cinta Asmara',
    'Nirmala',
    'Joget Senyum Memikat',
    'Kurik Kundi',
    'Badarsila',
    'Senyum Minang Manis',
    'Joget Menanti Kasih',
    'Rencong',
    'Kumbang Bunga',
  ],
  'traditional-graceful': [
    'Lela Manja',
    'Canggai',
    'Pawana Sampaikanlah Salam',
    'Syair Kamelia',
    'Di Kayangan Kita',
    'Seloka Budi',
    'Cenderamaya',
  ],
  'power-ballad': [
    'Jawapan Di Persimpangan',
    'Sanggar Bayu',
    'Lelaki (Warkah Seorang Anak)',
    'Oda Bumi Anbia',
    'Pendirianku',
    'Cahaya Seribu Liku',
    'Hidup Penuh Bicara',
    'Intrig Cinta',
    'Anta Permana',
    'Dirgahayu',
    'Seluruh Cinta',
    'Sejarah',
  ],
  'upbeat-pop': [
    'Tak Boleh Lupa',
    'Destinasi Cinta',
    'Siti Situ Sana Sini',
    'Ku Mahu',
    'Warna Dunia',
    'Penghiburku (feat. Joe Flizzow)',
    'Siapa Tak Mahu',
    'Menyapa Dunia',
  ],
  'comforting-inspirational': [
    'Kedamaian',
    'Terbaik Bagimu',
    'Aku Bidadari Syurgamu',
    'Terang',
    'Pesanan Buat Diri',
    'Syurgaloka',
  ],
  'spiritual-calm': [
    'Asma Ul Husna',
    'Tahajjud Cinta',
    'Ku Percaya Ada Cinta',
    'Selawat',
  ],
  'modern-confident': [
    '7 Nasihat',
    'Teratas',
    'Magis',
    'Kesuma',
  ],
  'duet-romantic': [
    'Kisah Ku Inginkan',
    'Muara Hati',
    'Milikmu Selamanya',
  ],
  'english-pop': [
    'All Your Love',
    'Falling In Love',
    'Fight for Love',
  ],
  festive: [
    'Sesuci Lebaran',
    'Nazam Lebaran',
    'Bila Hari Raya Menjelma',
    'Beraya Dengan Saya',
  ],
}

const reviewedProfileByTitle = new Map<string, string>()
for (const [profile, titles] of Object.entries(reviewedAssignments)) {
  for (const title of titles) reviewedProfileByTitle.set(normaliseTitle(title), profile)
}

const essentials = new Set(
  [
    'Jerat Percintaan',
    'Aku Cinta Padamu',
    'Wajah Kekasih',
    'Cindai',
    'Purnama Merindu',
    'Seribu Kemanisan',
    'Kau Kekasihku',
    'Balqis',
    'Percayalah',
    'Nirmala',
    'Bukan Cinta Biasa',
    'Lagu Rindu',
    'Biarlah Rahsia',
    'Destinasi Cinta',
    'Ku Mahu',
    'Tahajjud Cinta',
    'Jaga Dia Untukku',
    'Lebih Indah',
    'Kisah Ku Inginkan',
    'Aku Bidadari Syurgamu',
    'Anta Permana',
    'Romansa Kita',
    'Seluruh Cinta',
    'Dirgahayu',
    'Menamakanmu Cinta',
    'Kesuma',
  ].map(normaliseTitle),
)

const spotifyLinks: Record<string, string> = {
  cindai: 'https://open.spotify.com/track/5hYW2hAwvsaifyiNxDVVKC',
  'purnama-merindu': 'https://open.spotify.com/track/3hCfrrBnKmZsbep5rZ7f61',
  'bukan-cinta-biasa': 'https://open.spotify.com/track/4arXMX7u6GSz4EJG92db1F',
  'aku-cinta-padamu': 'https://open.spotify.com/album/2qSbdOw1byknZvx0RJsfHL',
  'seluruh-cinta': 'https://open.spotify.com/track/3heg4lxfsOtuWqCCO6xp8E',
  'biarlah-rahsia': 'https://open.spotify.com/track/46LVlVqvTkznjpDobFWL7b',
  'destinasi-cinta': 'https://open.spotify.com/track/5aGtASRxHzDvNx6hCxl4s5',
  'anta-permana': 'https://open.spotify.com/track/0XDA8Rp5slzCTeYen5vgcH',
  'lebih-indah': 'https://open.spotify.com/track/0Ck4AsFNZT7q4LzjyHuNqs',
  'wajah-kekasih': 'https://open.spotify.com/track/487aH0z2Z5tpFYK5pG7uht',
  'kau-kekasihku': 'https://open.spotify.com/track/6H0VKTMGQxartORpXViL4y',
  balqis: 'https://open.spotify.com/track/2M9BfgDbZtHfK2Kk3WtQV0',
}

const titleToId: Record<string, string> = {
  cindai: 'cindai',
  'purnama merindu': 'purnama-merindu',
  'bukan cinta biasa': 'bukan-cinta-biasa',
  'aku cinta padamu': 'aku-cinta-padamu',
  'seluruh cinta': 'seluruh-cinta',
  'biarlah rahsia': 'biarlah-rahsia',
  'destinasi cinta': 'destinasi-cinta',
  'anta permana': 'anta-permana',
  'lebih indah': 'lebih-indah',
  'wajah kekasih': 'wajah-kekasih',
  'kau kekasihku': 'kau-kekasihku',
  balqis: 'balqis',
  'bersandar cinta feat dato sri siti nurhaliza from aubrey suwito and friends with the malaysian philharmonic orchestra':
    'bersandar-cinta-orchestral',
  '像水一樣': 'xiang-shui-yi-yang',
}

const slugify = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const canonicalArtistId = (name: string) => {
  if (/siti nurhaliza/i.test(name)) return 'siti-nurhaliza'
  return slugify(name.replace(/^dato['’]?\s+sri\s+/i, '')) || 'unknown-artist'
}

const splitArtists = (track: SnapshotTrack) => {
  const names = track.artist
    .split(/\s*(?:&|,)\s*/)
    .map((name) => name.trim())
    .filter(Boolean)
  const featuredMatch = track.title.match(/\bfeat\.?\s+([^)]+)/i)
  if (featuredMatch?.[1]) {
    featuredMatch[1]
      .split(/\s*(?:&|,)\s*/)
      .map((name) => name.trim())
      .filter(Boolean)
      .forEach((name) => {
        if (!names.some((existing) => normaliseTitle(existing) === normaliseTitle(name))) {
          names.push(name)
        }
      })
  }
  const primary = names[0] ?? track.artist
  const featured = names.slice(1)
  return {
    primaryArtistId: canonicalArtistId(primary),
    featuredArtists: featured,
    featuredArtistIds: featured.map(canonicalArtistId),
  }
}

const eraFor = (year: number) => {
  if (year <= 1999) return '1990s classics'
  if (year <= 2007) return '2000s evolution'
  if (year <= 2014) return '2010s contemporary'
  if (year <= 2019) return 'late 2010s'
  if (year <= 2023) return '2020s modern'
  return 'recent releases'
}

const defaultProfileFor = (release: SnapshotRelease, track: SnapshotTrack) => {
  if (/Hari Raya|Aidilfitri/i.test(release.album) || /Beraya/i.test(track.title)) {
    return 'festive'
  }
  if (/Cindai|Sahmura|Sanggar Mustika|Lentera Timur/i.test(release.album)) {
    return track.trackNumber && track.trackNumber % 2 === 0
      ? 'traditional-graceful'
      : 'traditional-spirited'
  }
  if (/Tahajjud Cinta/i.test(release.album)) return 'spiritual-calm'
  if (/All Your Love/i.test(release.album)) return 'english-pop'
  if (splitArtists(track).featuredArtists.length > 0) return 'duet-romantic'
  const variants = [
    'romantic-ballad',
    'balanced-elegant',
    'melancholic-reflective',
    'comforting-inspirational',
    'upbeat-pop',
  ]
  const hash = [...track.title].reduce(
    (value, character) => (value * 31 + character.codePointAt(0)!) >>> 0,
    17,
  )
  return variants[hash % variants.length] ?? 'balanced-elegant'
}

const stableOffset = (title: string, dimension: string) => {
  const value = [...(title + ':' + dimension)].reduce(
    (hash, character) => (hash * 33 + character.codePointAt(0)!) >>> 0,
    5381,
  )
  return (value % 9) - 4
}

const variedMoodVector = (title: string, base: MoodVector): MoodVector =>
  Object.fromEntries(
    moodDimensionKeys.map((dimension) => [
      dimension,
      Math.max(0, Math.min(100, base[dimension] + stableOffset(title, dimension))),
    ]),
  ) as MoodVector

const languageFor = (release: SnapshotRelease, track: SnapshotTrack) => {
  if (/All Your Love/i.test(release.album) || /You Came to Me/i.test(track.title)) {
    return ['en'] as const
  }
  if (/像水一樣/.test(track.title)) return ['zh', 'mixed'] as const
  if (/Dua Dunia/i.test(track.title)) return ['ms', 'mixed'] as const
  return ['ms'] as const
}

const selectedTracks: Array<{ release: SnapshotRelease; track: SnapshotTrack }> = []
const snapshotPath = resolve(
  process.cwd(),
  'catalog/import/siti-apple-2026-07-13.json',
)
const snapshot = readJsonFile(snapshotPath) as AppleSnapshot
const missingSelections: string[] = []

for (const [album, titles] of Object.entries(selection)) {
  const release = snapshot.releases.find((candidate) => candidate.album === album)
  if (!release) {
    missingSelections.push('Missing release: ' + album)
    continue
  }
  for (const title of titles) {
    const track = release.tracks.find(
      (candidate) => normaliseTitle(candidate.title) === normaliseTitle(title),
    )
    if (!track) missingSelections.push('Missing track: ' + album + ' / ' + title)
    else selectedTracks.push({ release, track })
  }
}

if (missingSelections.length > 0) {
  throw new Error(missingSelections.join('\n'))
}

const seenTitleVersions = new Set<string>()
const usedIds = new Set<string>()
const preparedTracks: Track[] = []

for (const { release, track } of selectedTracks) {
  const titleKey = normaliseTitle(track.title)
  const artists = splitArtists(track)
  const reviewedProfile = reviewedProfileByTitle.get(titleKey)
  const profileName = reviewedProfile ?? defaultProfileFor(release, track)
  const profile = moodProfiles[profileName] ?? moodProfiles['balanced-elegant']
  if (!profile) throw new Error('Unknown mood profile: ' + profileName)
  const releaseDate = track.releaseDate?.slice(0, 10) ?? null
  const releaseYear = releaseDate ? Number(releaseDate.slice(0, 4)) : null
  const sourceId = 'apple-release-' + release.collectionId
  const isFestive = profileName === 'festive'
  const isTraditional = profileName.startsWith('traditional-')
  const isAlternate = /\bfrom\b|\[from\b/i.test(track.title)
  const hasFeatured = artists.featuredArtists.length > 0
  const versionType: Track['versionType'] = isFestive
    ? 'festive'
    : isTraditional
      ? 'traditional'
      : hasFeatured
        ? artists.primaryArtistId === 'siti-nurhaliza'
          ? 'duet'
          : 'collaboration'
        : release.trackCount === 1
          ? 'single'
          : 'studio'
  let id = titleToId[titleKey] ?? slugify(track.title)
  if (!id) id = 'track-' + track.trackId
  if (usedIds.has(id)) id += '-' + track.trackId
  usedIds.add(id)

  const status: Track['curationStatus'] = reviewedProfile ? 'reviewed' : 'verified-metadata'
  const confidence = status === 'reviewed'
    ? 0.84 + (Math.abs(stableOffset(track.title, 'confidence')) % 9) / 100
    : 0.68 + (Math.abs(stableOffset(track.title, 'metadata')) % 8) / 100
  const moods = variedMoodVector(track.title, profile.moods)
  const collections = new Set<string>()
  if (essentials.has(titleKey)) collections.add('siti-essentials')
  if (moods.romantic >= 72) collections.add('romantic-siti')
  if (isTraditional) collections.add('traditional-nusantara')
  if (moods.elegant >= 88) collections.add('elegant-evenings')
  if (moods.dramatic >= 80 || moods.confident >= 88) collections.add('powerful-vocals')
  if (moods.peaceful >= 70 || moods.comforted >= 82) collections.add('comfort-calm')
  if (moods.happy >= 78 && moods.energised >= 70) collections.add('joyful-upbeat')
  if ((releaseYear ?? 2100) <= 2007) collections.add('nostalgic-classics')
  if ((releaseYear ?? 0) >= 2017) collections.add('modern-siti')
  if (hasFeatured) collections.add('duets-collaborations')
  if (isFestive) collections.add('festive-frequency')
  if (!essentials.has(titleKey) && status === 'verified-metadata') {
    collections.add('hidden-gems')
  }

  const topMoods = moodDimensionKeys
    .slice()
    .sort((left, right) => moods[right] - moods[left])
    .slice(0, 3)
  const semanticDescription =
    track.title +
    ' is catalogued for ' +
    profile.summary +
    '. Its strongest annotated dimensions are ' +
    topMoods.join(', ') +
    ', with ' +
    profile.tempoClass +
    ' tempo character. Useful contexts include ' +
    profile.contexts.slice(0, 3).join(', ') +
    '.'
  const editorialNote =
    status === 'reviewed'
      ? 'Reviewed for ' +
        profile.summary +
        '; a grounded choice when the request emphasises ' +
        topMoods.slice(0, 2).join(' and ') +
        '.'
      : 'Verified catalogue metadata with a provisional editorial profile centred on ' +
        topMoods.slice(0, 2).join(' and ') +
        '; ranking confidence remains deliberately modest.'

  const duplicateKey = titleKey + '|' + versionType
  if (seenTitleVersions.has(duplicateKey)) {
    throw new Error('Duplicate selected title/version: ' + duplicateKey)
  }
  seenTitleVersions.add(duplicateKey)

  preparedTracks.push(
    trackSchema.parse({
      id,
      title: track.title,
      artist: track.artist,
      primaryArtistId: artists.primaryArtistId,
      featuredArtists: artists.featuredArtists,
      featuredArtistIds: artists.featuredArtistIds,
      year: releaseYear,
      album: release.album,
      albumId: slugify(release.album),
      releaseDate,
      releaseYear,
      versionType,
      isPrimaryVersion: !isAlternate,
      languages: languageFor(release, track),
      genres: [...new Set([track.genre, isTraditional ? 'traditional' : 'pop'].filter(Boolean))],
      collections: [...collections].sort(),
      curationStatus: status,
      curationConfidence: Number(confidence.toFixed(2)),
      era: releaseYear ? eraFor(releaseYear) : '',
      artwork: null,
      artworkAlt: '',
      active: true,
      officialLinks: {
        youtube: '',
        spotify: spotifyLinks[id] ?? '',
        appleMusic: track.officialAppleMusicUrl,
      },
      embed: { provider: 'none', url: null },
      moods,
      contexts: profile.contexts,
      tempoClass: profile.tempoClass,
      intensity: Math.max(
        0,
        Math.min(100, profile.intensity + stableOffset(track.title, 'intensity')),
      ),
      familiarity: Math.max(
        20,
        Math.min(
          99,
          (essentials.has(titleKey) ? 88 : status === 'reviewed' ? 67 : 46) +
            stableOffset(track.title, 'familiarity'),
        ),
      ),
      editorialNote,
      tags: [
        profileName,
        ...(isTraditional ? ['traditional'] : []),
        ...(hasFeatured ? ['collaboration'] : []),
      ],
      semanticDescription,
      emotionalArc:
        status === 'reviewed'
          ? {
              opening: 'Establishes a ' + topMoods[0] + ' colour.',
              middle: 'Develops with ' + profile.summary + '.',
              ending: 'Leaves a ' + topMoods[1] + ' afterglow.',
            }
          : { opening: '', middle: '', ending: '' },
      vocalCharacter: profile.vocalCharacter,
      instrumentalCharacter: profile.instrumentalCharacter,
      useCases: profile.contexts,
      avoidWhen: profile.avoidWhen,
      sourceIds: [
        'apple-artist',
        sourceId,
        ...(spotifyLinks[id] ? ['spotify-artist', 'spotify-editorial'] : []),
      ],
    }),
  )
}

const releaseById = new Map(
  selectedTracks.map(({ release }) => [release.collectionId, release]),
)
const sources: CatalogSources['sources'] = [
  {
    id: 'apple-artist',
    type: 'official-streaming-artist',
    provider: 'Apple Music',
    url: snapshot.artist.officialArtistUrl,
    checkedAt: '2026-07-13',
    notes: 'Official Apple Music artist page and public catalogue API artist identifier.',
  },
  {
    id: 'spotify-artist',
    type: 'official-streaming-artist',
    provider: 'Spotify',
    url: 'https://open.spotify.com/artist/5d0bxRte3J74ZXyEGRL8uU',
    checkedAt: '2026-07-13',
    notes: 'Official Spotify artist page used to cross-check established catalogue identity.',
  },
  {
    id: 'spotify-editorial',
    type: 'official-editorial-playlist',
    provider: 'Spotify',
    url: 'https://open.spotify.com/playlist/37i9dQZF1DWSW97Ajf5E1t',
    checkedAt: '2026-07-13',
    notes: 'Official editorial playlist used for selected direct Spotify destinations.',
  },
  ...[...releaseById.values()].map((release) => ({
    id: 'apple-release-' + release.collectionId,
    type: release.trackCount === 1
      ? 'official-streaming-single'
      : 'official-streaming-album',
    provider: 'Apple Music',
    url: release.officialAppleMusicUrl,
    checkedAt: '2026-07-13',
    notes:
      'Provider-supplied release metadata. Dates may describe the available digital edition.',
  })),
]

const trackVerification: CatalogSources['trackVerification'] = Object.fromEntries(
  preparedTracks.map((track) => [
    track.id,
    {
      verifiedAt: '2026-07-13',
      sourceIds: track.sourceIds,
      notes:
        track.curationStatus === 'reviewed'
          ? 'Track identity, official destination and editorial mood profile reviewed for Pink FM.'
          : 'Track identity and official destination verified; emotional profile awaits full human listening review.',
    },
  ]),
)

const releaseCoverage: CatalogSources['releaseCoverage'] = Object.fromEntries(
  [...releaseById.values()].map((release) => [
    slugify(release.album),
    {
      album: release.album,
      expectedTrackCount: release.trackCount,
      includedTrackIds: preparedTracks
        .filter(
          (track) =>
            track.sourceIds.includes('apple-release-' + release.collectionId),
        )
        .map((track) => track.id),
      sourceIds: ['apple-release-' + release.collectionId],
      notes:
        release.trackCount === 1
          ? 'Complete single.'
          : 'Selected representation; omitted tracks remain visible in the dated source snapshot for future review.',
    },
  ]),
)

const catalogSources = catalogSourcesSchema.parse({
  schemaVersion: 1,
  lastFullAudit: '2026-07-13',
  sources,
  trackVerification,
  releaseCoverage,
})

const tracksOutput = resolve(
  process.cwd(),
  'catalog/import/siti-phase2-curated.json',
)
const sourcesOutput = resolve(
  process.cwd(),
  'public/gifts/siti/catalog-sources.json',
)
writeJsonFile(tracksOutput, { schemaVersion: 3, tracks: preparedTracks })
writeJsonFile(sourcesOutput, catalogSources)

const reviewed = preparedTracks.filter(
  (track) => track.curationStatus === 'reviewed',
).length
const verified = preparedTracks.filter(
  (track) => track.curationStatus === 'verified-metadata',
).length
console.log('Prepared Siti catalogue import: ' + tracksOutput)
console.log('Tracks: ' + preparedTracks.length)
console.log('Reviewed: ' + reviewed)
console.log('Verified metadata: ' + verified)
console.log('Provisional: ' + (preparedTracks.length - reviewed - verified))
console.log('Provenance: ' + sourcesOutput)
