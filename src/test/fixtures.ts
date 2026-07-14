import { createDefaultListenerState, type ListenerState } from '../lib/storage'
import {
  giftSchema,
  messagesSchema,
  profileBundleSchema,
  trackSchema,
  type GiftConfig,
  type Messages,
  type MoodPreset,
  type MoodVector,
  type ProfileBundle,
  type Track,
} from '../config/schemas'

export const vector = (overrides: Partial<MoodVector> = {}): MoodVector => ({
  peaceful: 50,
  happy: 50,
  romantic: 50,
  confident: 50,
  energised: 50,
  nostalgic: 50,
  elegant: 50,
  comforted: 50,
  dramatic: 50,
  ...overrides,
})

export const makeTrack = (id: string, overrides: Partial<Track> = {}): Track => trackSchema.parse({
  id,
  title: `Track ${id}`,
  artist: 'Test Artist',
  year: null,
  era: 'test era',
  artwork: null,
  artworkAlt: '',
  active: true,
  officialLinks: {
    youtube: 'https://www.youtube.com/watch?v=N2zJlMofr9Y',
    spotify: 'https://open.spotify.com/track/1AbCdEfGhIjKlMnOpQrStU',
    appleMusic: '',
  },
  embed: { provider: 'none', url: null },
  playback: {
    preferredProvider: 'youtube',
    spotify: { url: 'https://open.spotify.com/track/1AbCdEfGhIjKlMnOpQrStU', entityType: 'track' },
    youtube: { videoId: 'N2zJlMofr9Y', verifiedOfficial: true, sourceId: 'youtube-siti-official' },
    appleMusic: null,
  },
  playbackCoverage: 'full-subscription-free',
  fullPlaybackSources: [{
    id: `${id}-official-youtube`,
    provider: 'youtube',
    videoId: 'N2zJlMofr9Y',
    version: 'music-video',
    authority: 'artist-official',
    channelId: 'UCNq-mu-iXUmiAWyDOcJmZZg',
    channelName: 'Siti Nurhaliza',
    verified: true,
    embeddable: true,
    fullLength: true,
    durationSeconds: 296,
    expectedTrackDurationSeconds: null,
    regionNotes: [],
    verifiedAt: '2026-07-14',
    sourceUrl: 'https://www.youtube.com/watch?v=N2zJlMofr9Y',
    provenanceSourceId: 'youtube-siti-official',
    priority: 1,
  }],
  moods: vector(),
  contexts: ['evening'],
  tempoClass: 'medium',
  intensity: 50,
  familiarity: 50,
  editorialNote: 'A test recommendation note.',
  tags: [],
  ...overrides,
})

export const makeMood = (overrides: Partial<MoodPreset> = {}): MoodPreset => ({
  id: 'peaceful',
  label: 'Peaceful',
  description: 'Gentle and unhurried',
  icon: 'cloud',
  stationName: 'Velvet Calm',
  frequency: '88.4',
  target: vector({ peaceful: 95, comforted: 85, energised: 20 }),
  ...overrides,
})

export const listener = (overrides: Partial<ListenerState> = {}): ListenerState => ({
  ...createDefaultListenerState('spotify'),
  ...overrides,
})

export const makeGift = (overrides: Partial<GiftConfig> = {}): GiftConfig => giftSchema.parse({
  schemaVersion: 1,
  slug: 'test',
  locale: 'en',
  station: {
    name: 'Test FM',
    tagline: 'Personal radio',
    shortName: 'Test FM',
    frequencyLabel: '92.6',
    welcomeHeading: 'Ready',
    welcomeMessage: 'Choose a mood.',
  },
  recipient: { displayName: '', privateGreeting: '', showName: false },
  artist: { name: 'Test Artist', shortName: 'Test', slug: 'test-artist', image: null, imageAlt: '' },
  assistant: { name: 'WisseBot', subtitle: 'Guide', personality: 'Warm', avatar: null },
  creator: {
    name: 'Creator',
    creditLabel: 'Made by',
    showOnAboutPage: true,
    showInMainExperience: false,
  },
  theme: {
    background: '#fff7fa',
    surface: '#ffffff',
    surfaceAlt: '#fce7ef',
    primary: '#d94f83',
    primaryStrong: '#a8275c',
    secondary: '#ef9eba',
    accent: '#c79a55',
    text: '#3f2431',
    mutedText: '#775866',
    plum: '#4a2036',
    speakerCloth: '#e7b8c9',
  },
  features: {
    wisseBot: true,
    dailyFrequency: true,
    listeningStats: true,
    installPrompt: true,
    soundEffects: true,
    mysteryBroadcast: true,
  },
  defaultStreamingService: 'spotify',
  privacyNotice: 'Stored locally.',
  ...overrides,
})

export const makeMessages = (): Messages => messagesSchema.parse({
  schemaVersion: 1,
  loading: { heading: 'Tuning', messages: ['Loading'] },
  welcome: { preparedFor: 'One listener', tuneIn: 'Tune in', frequencyAriaLabel: 'Frequency' },
  mood: { heading: 'How would you like to feel?', intro: 'Choose one.', askAssistant: 'Tell WisseBot instead' },
  radio: { nowTuned: 'Now tuned', matchLabel: 'match strength', playOn: 'Listen on', noLink: 'No official listening destination is configured for this track yet.', another: 'Another choice', energyLabel: 'Energy tuning' },
  feedback: { love: 'Love this', notToday: 'Not today', moreLikeThis: 'More like this', lessIntense: 'Less intense', moreEnergetic: 'More energetic', saved: 'Saved' },
  bot: { greeting: 'Tell me a mood.', placeholder: 'Peaceful…', send: 'Tune', understoodPrefix: 'I’m tuning for', clarification: 'Give me a mood.' },
  library: { heading: 'Library', intro: 'Local records.', loved: 'Loved tracks', recent: 'Recent', insights: 'Insights', empty: 'Nothing yet.' },
  settings: { heading: 'Settings', privacyHeading: 'Privacy', installHeading: 'Install', installInstructions: 'Use Add to Home Screen.' },
  errors: { profileMissing: 'Missing', profileInvalid: 'Invalid', retry: 'Retry' },
  stationIds: ['Test station'],
})

export const makeProfile = (overrides: Partial<ProfileBundle> = {}): ProfileBundle => profileBundleSchema.parse({
  gift: makeGift(),
  moods: {
    schemaVersion: 1,
    moods: [
      makeMood(),
      makeMood({ id: 'energised', label: 'Energised', stationName: 'Voltage', frequency: '96.8', icon: 'zap', target: vector({ energised: 95, happy: 80, peaceful: 20 }) }),
    ],
  },
  tracks: {
    schemaVersion: 1,
    tracks: [
      makeTrack('calm', { moods: vector({ peaceful: 95, comforted: 85, energised: 24 }) }),
      makeTrack('energy', { moods: vector({ peaceful: 20, happy: 82, energised: 96 }) }),
    ],
  },
  messages: makeMessages(),
  ...overrides,
})
