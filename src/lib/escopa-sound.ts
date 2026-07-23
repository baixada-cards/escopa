import { useCallback, useEffect, useRef } from 'react'

type EscopaSoundCue = 'card_play' | 'score'

type EscopaSoundOptions = {
  enabled: boolean
  volume: number
}

type EscopaSoundPlaybackOptions = {
  scorePoints?: number
}

type EscopaTonePlan = {
  delaySeconds: number
  duration: number
  endFrequency: number
  frequency: number
  gainScale: number
  type: OscillatorType
}

function clampVolume(volume: number): number {
  return Math.max(0, Math.min(1, volume))
}

export function createEscopaSoundPlan(
  cue: EscopaSoundCue,
  options: EscopaSoundPlaybackOptions = {},
): EscopaTonePlan[] {
  if (cue === 'card_play') {
    return [
      {
        delaySeconds: 0,
        frequency: 145,
        endFrequency: 72,
        duration: 0.085,
        gainScale: 1,
        type: 'triangle',
      },
      {
        delaySeconds: 0.012,
        frequency: 780,
        endFrequency: 260,
        duration: 0.045,
        gainScale: 0.34,
        type: 'sine',
      },
    ]
  }

  const strokes = Math.max(1, Math.min(5, options.scorePoints ?? 1))
  return Array.from({ length: strokes }, (_, index) => ({
    delaySeconds: index * 0.11,
    frequency: 440 + index * 28,
    endFrequency: 330 + index * 20,
    duration: 0.075,
    gainScale: 0.64,
    type: 'sine' as const,
  }))
}

function scheduleTone(
  context: AudioContext,
  startAt: number,
  {
    frequency,
    endFrequency,
    duration,
    gain,
    type,
  }: {
    frequency: number
    endFrequency: number
    duration: number
    gain: number
    type: OscillatorType
  },
) {
  const oscillator = context.createOscillator()
  const envelope = context.createGain()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startAt)
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startAt + duration)
  envelope.gain.setValueAtTime(0.0001, startAt)
  envelope.gain.linearRampToValueAtTime(gain, startAt + 0.005)
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  oscillator.connect(envelope)
  envelope.connect(context.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration + 0.02)
}

export function useEscopaSoundFx({ enabled, volume }: EscopaSoundOptions) {
  const contextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    return () => {
      if (contextRef.current != null) {
        void contextRef.current.close()
        contextRef.current = null
      }
    }
  }, [])

  const playSound = useCallback(
    (cue: EscopaSoundCue, options: EscopaSoundPlaybackOptions = {}) => {
      if (!enabled || typeof window === 'undefined') return

      const context = contextRef.current ?? new AudioContext()
      contextRef.current = context
      if (context.state === 'suspended') {
        void context.resume()
      }

      const gain = clampVolume(volume) * 0.1
      const startAt = context.currentTime + 0.01

      for (const tone of createEscopaSoundPlan(cue, options)) {
        scheduleTone(context, startAt + tone.delaySeconds, {
          frequency: tone.frequency,
          endFrequency: tone.endFrequency,
          duration: tone.duration,
          gain: gain * tone.gainScale,
          type: tone.type,
        })
      }
    },
    [enabled, volume],
  )

  return { playSound }
}
