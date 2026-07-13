import type { MoodDimension } from '../../../config/schemas.ts'
import type { SemanticPrototypeMatch } from './semanticTypes.ts'

export type SemanticPrototype = {
  id: string
  kind: SemanticPrototypeMatch['kind']
  examples: string[]
  payload: Record<string, string | number | boolean>
}

const moodPrototype = (
  mood: MoodDimension,
  examples: string[],
): SemanticPrototype => ({
  id: `mood-${mood}`,
  kind: 'mood',
  examples,
  payload: { mood, strength: 82 },
})

export const semanticPrototypes: SemanticPrototype[] = [
  moodPrototype('peaceful', [
    'quiet music that helps me settle without demanding attention',
    'lagu yang tenang dan lembut untuk berehat',
    'something serene and unhurried',
    'nak vibe santai dan damai',
  ]),
  moodPrototype('happy', [
    'music that feels cheerful bright and optimistic',
    'saya nak rasa ceria dan gembira sikit',
    'a sunny feel good selection',
    'lagu happy yang boleh naikkan mood',
  ]),
  moodPrototype('romantic', [
    'warm romantic music with tenderness',
    'lagu cinta yang manis dan romantik',
    'something affectionate and graceful',
    'romantic sikit untuk suasana mesra',
  ]),
  moodPrototype('confident', [
    'bold assured music with a strong vocal presence',
    'lagu yang buat saya rasa yakin dan kuat',
    'something empowering and poised',
    'nak powerful vocal dan confident vibe',
  ]),
  moodPrototype('energised', [
    'lively upbeat music that gives me energy',
    'lagu rancak dan bertenaga',
    'something active with forward movement',
    'nak yang lebih upbeat untuk semangat',
  ]),
  moodPrototype('nostalgic', [
    'a nostalgic classic that brings back memories',
    'lagu klasik Siti yang penuh kenangan',
    'an old school throwback feeling',
    'nak rasa macam zaman dulu',
  ]),
  moodPrototype('elegant', [
    'refined elegant music for a graceful evening',
    'lagu anggun dan berkelas',
    'something polished and sophisticated',
    'nak suasana elegan tapi tidak terlalu berat',
  ]),
  moodPrototype('comforted', [
    'warm reassuring music that feels like company',
    'lagu yang menenangkan hati dan rasa selesa',
    'something gentle and emotionally safe',
    'nak muzik yang boleh jadi teman',
  ]),
  moodPrototype('dramatic', [
    'emotionally intense music with a sweeping dramatic shape',
    'lagu dramatik dan mendalam dengan vokal besar',
    'a grand powerful ballad',
    'nak sesuatu yang penuh emosi',
  ]),
  {
    id: 'activity-cooking', kind: 'activity', payload: { activity: 'cooking' },
    examples: ['music for cooking dinner', 'lagu untuk masak', 'something lively while I am in the kitchen'],
  },
  {
    id: 'activity-driving', kind: 'activity', payload: { activity: 'driving' },
    examples: ['music for a drive', 'lagu masa memandu', 'a road trip soundtrack'],
  },
  {
    id: 'activity-working', kind: 'activity', payload: { activity: 'working' },
    examples: ['music for focused work', 'lagu untuk buat kerja', 'something steady while studying'],
  },
  {
    id: 'activity-relaxing', kind: 'activity', payload: { activity: 'relaxing' },
    examples: ['music to unwind', 'lagu untuk rehat malam', 'something for a quiet break'],
  },
  {
    id: 'activity-celebration', kind: 'activity', payload: { activity: 'celebration' },
    examples: ['music for a happy celebration', 'lagu untuk majlis dan kenduri', 'a festive gathering'],
  },
  {
    id: 'intent-more-energy', kind: 'intent', payload: { intent: 'more-energetic' },
    examples: ['turn the energy up a little', 'yang macam tadi tapi lebih upbeat', 'make this livelier'],
  },
  {
    id: 'intent-less-intense', kind: 'intent', payload: { intent: 'less-intense' },
    examples: ['keep the idea but soften the emotional intensity', 'macam tadi tapi kurang dramatik', 'tone that down'],
  },
  {
    id: 'intent-similar', kind: 'intent', payload: { intent: 'similar' },
    examples: ['another song with the same feeling', 'nak yang macam tadi', 'more like the previous selection'],
  },
  {
    id: 'intent-different', kind: 'intent', payload: { intent: 'different' },
    examples: ['take me somewhere different', 'bagi sesuatu yang lain sikit', 'change the character completely'],
  },
  {
    id: 'intent-discovery', kind: 'intent', payload: { intent: 'discovery' },
    examples: ['choose something I would not normally hear', 'bagi hidden gem yang jarang dipilih', 'a deeper catalogue discovery'],
  },
  {
    id: 'intent-familiar', kind: 'intent', payload: { intent: 'familiar' },
    examples: ['give me a familiar favourite', 'nak lagu yang saya kenal', 'choose a recognised classic'],
  },
  {
    id: 'intent-traditional', kind: 'intent', payload: { intent: 'traditional' },
    examples: ['traditional Malay character and rhythm', 'nak lagu irama malaysia atau nusantara', 'something with zapin or joget character'],
  },
  {
    id: 'intent-modern', kind: 'intent', payload: { intent: 'modern' },
    examples: ['a newer modern Siti release', 'bagi yang moden dan baru sikit', 'something from her recent era'],
  },
  {
    id: 'clarify-deep-reflective', kind: 'clarification', payload: { clarification: 'calm-reflective' },
    examples: ['deep meaning as calm and reflective', 'mendalam tetapi tenang dan berfikir'],
  },
  {
    id: 'clarify-deep-intense', kind: 'clarification', payload: { clarification: 'emotionally-intense' },
    examples: ['deep meaning emotionally intense', 'mendalam dengan emosi yang kuat'],
  },
  {
    id: 'clarify-power-vocal', kind: 'clarification', payload: { clarification: 'powerful-vocals' },
    examples: ['powerful meaning a commanding vocal performance', 'powerful maksud vokal yang hebat'],
  },
]

export type FlattenedPrototype = {
  id: string
  kind: SemanticPrototype['kind']
  text: string
  payload: SemanticPrototype['payload']
}

export const flattenedSemanticPrototypes = () =>
  semanticPrototypes.flatMap((prototype) =>
    prototype.examples.map((text, index) => ({
      id: `${prototype.id}:${index + 1}`,
      kind: prototype.kind,
      text,
      payload: prototype.payload,
    })),
  )
