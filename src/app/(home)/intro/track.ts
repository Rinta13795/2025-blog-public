import type { Score } from './score'

// 开场音乐：《锚点》从 51.913s 起截的一段，正好是落点（64.284s）前 5 小节。
// 时间线是按 2 秒一小节写的，这首歌 97 BPM、一小节 2.474s，所以整体拉伸 1.237 倍，
// 每个场景占一小节，揭幕刚好落在 drop 上。设为 null 就退回 score.ts 里合成的 BGM。
export const TRACK: { src: string; stretch: number } | null = {
	src: '/music/intro-anchor.m4a',
	stretch: ((60 / 97) * 4) / 2
}

export const timeStretch = TRACK?.stretch ?? 1

export function loadTrack(ctx: AudioContext, src: string) {
	return fetch(src)
		.then(res => res.arrayBuffer())
		.then(data => ctx.decodeAudioData(data))
}

export function playTrack(ctx: AudioContext, buffer: AudioBuffer, stretch: number): Score {
	const t0 = ctx.currentTime + 0.05
	const gain = ctx.createGain()
	gain.connect(ctx.destination)
	const source = ctx.createBufferSource()
	source.buffer = buffer
	source.connect(gain)
	source.start(t0)

	const latency = () => ((ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0) || ctx.baseLatency || 0

	return {
		now: () => (ctx.currentTime - t0 - latency()) / stretch,
		fadeOut: seconds => {
			const now = ctx.currentTime
			gain.gain.cancelScheduledValues(now)
			gain.gain.setValueAtTime(gain.gain.value, now)
			gain.gain.linearRampToValueAtTime(0.0001, now + seconds)
		},
		close: () => {
			ctx.close().catch(() => {})
		}
	}
}
