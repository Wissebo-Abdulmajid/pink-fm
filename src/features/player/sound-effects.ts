export type UiSound = 'power' | 'click' | 'tick' | 'confirm' | 'static'

let audioContext: AudioContext | null = null

const getContext = () => {
  const AudioContextConstructor = window.AudioContext
  audioContext ??= new AudioContextConstructor()
  return audioContext
}

export const playUiSound = (sound: UiSound, volumeScale = 1) => {
  if (typeof window === 'undefined' || !window.AudioContext) return
  try {
    const context = getContext()
    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const settings: Record<UiSound, { start: number; end: number; duration: number; volume: number; type: OscillatorType }> = {
      power: { start: 185, end: 390, duration: 0.2, volume: 0.028, type: 'sine' },
      click: { start: 280, end: 210, duration: 0.045, volume: 0.018, type: 'triangle' },
      tick: { start: 430, end: 360, duration: 0.025, volume: 0.012, type: 'square' },
      confirm: { start: 330, end: 520, duration: 0.16, volume: 0.024, type: 'sine' },
      static: { start: 95, end: 65, duration: 0.07, volume: 0.008, type: 'sawtooth' },
    }
    const chosen = settings[sound]
    oscillator.type = chosen.type
    oscillator.frequency.setValueAtTime(chosen.start, now)
    oscillator.frequency.exponentialRampToValueAtTime(chosen.end, now + chosen.duration)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, chosen.volume * volumeScale), now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + chosen.duration)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + chosen.duration + 0.01)
  } catch {
    // Sound effects are optional enhancement only.
  }
}
