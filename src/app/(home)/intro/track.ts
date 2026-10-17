import type { Score } from './score'

// 开场音乐：《锚点》从头连续播放，不做任何拼接。歌 97 BPM，一小节 2.4725s（64.284s 的大落点 = 第 26 小节）：
// 第 0 小节是 riser，2.47s 第一次落点，12.36s 低频进入（段落切换）。时间线按 2 秒一小节写，所以整体拉伸 1.236 倍，
// 画面的每个场景占一小节，揭幕落在 12.36s。设为 null 就退回 score.ts 里合成的 BGM。
export const TRACK: { src: string; stretch: number } | null = {
	src: '/music/intro-anchor.m4a',
	stretch: 64.284 / 26 / 2
}

// 音频前 2 小节是歌的原始开头（riser + 第一次落点），之后跳到 51.9s；画面里对应 film.ts 的序章
export const LEAD_FILM_SECONDS = 4

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
		now: () => (ctx.currentTime - t0 - latency()) / stretch - LEAD_FILM_SECONDS,
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
