import type { MoodDimension } from '../../../config/schemas'

export type PhraseResource = {
  id: string
  phrases: string[]
}

export const moodLanguage: Record<MoodDimension, string[]> = {
  peaceful: [
    'peaceful', 'calm', 'gentle', 'quiet', 'relaxing', 'relaxed', 'serene', 'soothing',
    'chill', 'tranquil', 'soft', 'tenang', 'damai', 'lembut', 'santai', 'menenangkan',
    'rileks', 'slow sikit',
  ],
  happy: [
    'happy', 'cheerful', 'bright', 'joyful', 'uplifting', 'sunny', 'fun', 'positive',
    'feel good', 'gembira', 'ceria', 'riang', 'seronok', 'bahagia', 'happy sikit',
  ],
  romantic: [
    'romantic', 'romance', 'love', 'loving', 'tender', 'affectionate', 'sweet',
    'romantik', 'cinta', 'kasih', 'mesra', 'manis',
  ],
  confident: [
    'confident', 'powerful', 'strong', 'bold', 'assured', 'poised', 'empowering',
    'yakin', 'berani', 'kuat', 'bersemangat', 'power', 'powerful vocal', 'vokal kuat',
  ],
  energised: [
    'energised', 'energized', 'energy', 'energetic', 'lively', 'upbeat', 'active',
    'dance', 'bouncy', 'fast', 'bertenaga', 'rancak', 'ceria rancak', 'upbeat sikit',
    'lebih laju', 'semangat',
  ],
  nostalgic: [
    'nostalgic', 'nostalgia', 'classic', 'memories', 'old school', 'throwback',
    'klasik', 'nostalgia', 'kenangan', 'lama', 'zaman dulu', 'old siti', 'siti lama',
  ],
  elegant: [
    'elegant', 'classy', 'refined', 'graceful', 'polished', 'sophisticated',
    'anggun', 'elegan', 'berkelas', 'halus', 'mewah',
  ],
  comforted: [
    'comforted', 'comforting', 'comfort', 'cosy', 'cozy', 'warm', 'reassuring',
    'safe', 'dipujuk', 'menyentuh', 'nyaman', 'hangat', 'teman', 'menenangkan hati',
  ],
  dramatic: [
    'dramatic', 'grand', 'intense', 'theatrical', 'sweeping', 'epic', 'emotional',
    'dramatik', 'mendalam', 'emosi', 'hebat', 'besar', 'power ballad',
  ],
}

export const negators = [
  'not', 'no', 'without', 'dont', 'do not', 'never', 'less',
  'jangan', 'tak', 'tidak', 'tanpa', 'bukan', 'kurang',
]

export const intensityModifiers = {
  stronger: ['very', 'really', 'super', 'extremely', 'sangat', 'betul betul', 'amat'],
  softer: ['a bit', 'slightly', 'not too', 'not very', 'sikit', 'sedikit', 'jangan terlalu', 'tak terlalu'],
}

export const activities: Array<PhraseResource & { context: string; moods: Partial<Record<MoodDimension, number>> }> = [
  { id: 'cooking', context: 'cooking', phrases: ['cooking', 'cook', 'in the kitchen', 'masak', 'memasak', 'dapur'], moods: { happy: 78, energised: 67, confident: 58, peaceful: 38 } },
  { id: 'cleaning', context: 'cleaning', phrases: ['cleaning', 'housework', 'kemas rumah', 'mengemas'], moods: { happy: 72, energised: 88, confident: 68 } },
  { id: 'driving', context: 'driving', phrases: ['driving', 'road trip', 'drive', 'memandu', 'dalam kereta'], moods: { happy: 66, energised: 74, confident: 70 } },
  { id: 'getting-ready', context: 'getting-ready', phrases: ['getting ready', 'dress up', 'bersiap', 'siap siap'], moods: { confident: 86, energised: 78, elegant: 70 } },
  { id: 'working', context: 'working', phrases: ['working', 'focus', 'study', 'belajar', 'kerja', 'buat kerja'], moods: { confident: 70, energised: 52, peaceful: 58, dramatic: 24 } },
  { id: 'relaxing', context: 'relaxing', phrases: ['relaxing', 'unwind', 'resting', 'rehat', 'santai', 'nak rehat'], moods: { peaceful: 90, comforted: 86, energised: 22, dramatic: 18 } },
  { id: 'dinner', context: 'dinner', phrases: ['dinner', 'dining', 'makan malam'], moods: { elegant: 76, romantic: 64, peaceful: 57 } },
  { id: 'celebration', context: 'celebration', phrases: ['party', 'celebration', 'celebrate', 'majlis', 'kenduri', 'meraikan'], moods: { happy: 88, energised: 82, confident: 65 } },
  { id: 'reflecting', context: 'reflecting', phrases: ['reflecting', 'thinking', 'merenung', 'fikir fikir'], moods: { peaceful: 72, nostalgic: 69, comforted: 62 } },
]

export const followUpLanguage: Record<string, string[]> = {
  moreEnergy: ['more energetic', 'more energy', 'more upbeat', 'livelier', 'lebih bertenaga', 'lagi rancak', 'lebih upbeat', 'upbeat lagi'],
  lessEnergy: ['less energetic', 'calmer', 'slow it down', 'lebih tenang', 'kurang rancak', 'perlahan sikit'],
  moreIntensity: ['more intense', 'more dramatic', 'go bigger', 'lebih dramatik', 'lagi mendalam'],
  lessIntensity: ['less intense', 'less dramatic', 'softer', 'tone it down', 'kurang intense', 'kurang dramatik', 'lembut sikit'],
  similar: ['similar', 'more like this', 'more like that', 'more like the last song', 'more like tadi', 'like the last one', 'like that', 'same feeling', 'same mood', 'macam tadi', 'macam yang tadi', 'lebih kurang tadi', 'mood yang sama'],
  different: ['something different', 'different one', 'not similar', 'lain sikit', 'yang lain', 'berbeza'],
  another: ['another', 'another choice', 'something else', 'next one', 'satu lagi', 'lagu lain', 'bagi lagi'],
  rejectTrack: ['not this song', 'not that song', 'dont play that', 'jangan lagu itu', 'jangan yang tadi', 'tak nak lagu ini'],
  rejectAlbum: ['not that album', 'different album', 'another album', 'jangan album itu', 'album lain'],
  differentEra: ['different era', 'another era', 'same mood different era', 'era lain', 'zaman lain'],
  startOver: ['start over', 'start again', 'new request', 'reset request', 'mula semula', 'permintaan baru'],
}

export const requestLanguage = {
  surprise: ['surprise me', 'surprise saya', 'random', 'mystery', 'unexpected', 'pilihkan apa apa'],
  familiar: ['familiar', 'favourite', 'favorite', 'well known', 'popular', 'classic hit', 'yang saya kenal', 'kegemaran', 'favourite saya'],
  discovery: ['discovery', 'new to me', 'unfamiliar', 'deep cut', 'hidden gem', 'do not usually choose', 'dont usually choose', 'jarang dengar', 'tak biasa pilih', 'lagu tersembunyi'],
  older: ['older', 'old era', 'earlier', 'from the 90s', 'klasik siti', 'siti lama', 'yang lama', 'zaman dulu', '90an', '2000an'],
  modern: ['modern', 'newer', 'recent', 'latest', 'contemporary', 'moden', 'terbaru', 'baru sikit', 'siti moden'],
  traditional: ['traditional', 'tradisional', 'irama malaysia', 'nusantara', 'asli', 'zapin', 'joget'],
  duet: ['duet', 'collaboration', 'collab', 'duetkan', 'lagu duet', 'kolaborasi'],
  festive: ['festive', 'hari raya', 'raya', 'aidilfitri', 'celebration song'],
}

export const timeLanguage: Record<'morning' | 'daytime' | 'evening' | 'night', string[]> = {
  morning: ['morning', 'breakfast', 'pagi'],
  daytime: ['afternoon', 'daytime', 'siang', 'tengah hari', 'petang awal'],
  evening: ['evening', 'sunset', 'senja', 'petang'],
  night: ['night', 'late night', 'bedtime', 'malam', 'tengah malam'],
}

export const unsupportedPatterns = [
  /\b(private life|personal secrets?|gossip|rumou?rs?|relationship history)\b/,
  /\b(kehidupan peribadi|rahsia peribadi|gosip|cerita rumah tangga)\b/,
  /\b(give|show|write|quote|continue|sing)\b.{0,30}\b(lyrics?|lirik)\b/,
  /\b(lirik penuh|sambung lirik|nyanyi lirik)\b/,
  /\b(diagnose|therapy|depression|anxiety disorder|medical advice)\b/,
  /\b(diagnos|kemurungan|nasihat perubatan)\b/,
  /\b(invent|fabricate|make up|hallucinate)\b.{0,40}\b(song|track|title|album|fact|story)\b/,
  /\b(reka|cipta|tokok tambah)\b.{0,40}\b(lagu|tajuk|album|fakta|cerita)\b/,
  /\b(pretend|act as|impersonate)\b.{0,25}\b(siti|artist|singer)\b/,
  /\b(pura pura|menyamar)\b.{0,25}\b(siti|artis|penyanyi)\b/,
  /\bignore\b.{0,30}\b(instructions?|catalogue|rules?)\b/,
]

export const ambiguousConcepts: Record<string, { question: string; choices: string[] }> = {
  deep: {
    question: 'Would you like something emotionally powerful, calm and reflective, or vocally powerful?',
    choices: ['Emotionally intense', 'Calm and reflective', 'Powerful vocals'],
  },
  powerful: {
    question: 'Should “powerful” mean stronger vocals, more energy, or greater emotional intensity?',
    choices: ['Powerful vocals', 'More energetic', 'Emotionally intense'],
  },
  mendalam: {
    question: 'Adakah “mendalam” bermaksud emosi yang kuat, tenang dan reflektif, atau vokal yang hebat?',
    choices: ['Emosi yang kuat', 'Tenang dan reflektif', 'Vokal yang hebat'],
  },
}

export const typoAliases: Record<string, string> = {
  peacful: 'peaceful', peacfull: 'peaceful', romantik: 'romantic', romatic: 'romantic',
  cheerfull: 'cheerful', cheerfl: 'cheerful', energatic: 'energetic', energtic: 'energetic',
  nostaljik: 'nostalgic', nostagic: 'nostalgic', ellegant: 'elegant', dramtic: 'dramatic',
  tenag: 'tenang', tnang: 'tenang', mengantok: 'mengantuk', mengantukkk: 'mengantuk',
  rancakk: 'rancak', romantikk: 'romantik', sedi: 'sedih', duettt: 'duet', modenn: 'moden',
  cam: 'macam', mcm: 'macam', sy: 'saya', xnak: 'tak nak', x: 'tak', tk: 'tak',
}
