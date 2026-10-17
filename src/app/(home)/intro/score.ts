// 开场 BGM：纯 WebAudio 合成，没有任何音频文件。120 BPM，每 2 秒一小节，和画面的切换点一一对齐。

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

// 每小节里的重音位置（秒），画面上的「卡点」也用这一组
export const HITS = [0, 0.75, 1, 1.25, 1.5]

export type Score = {
	now: () => number
	fadeOut: (seconds: number) => void
	close: () => void
}

function impulse(ctx: AudioContext, seconds: number, decay: number) {
	const length = Math.floor(ctx.sampleRate * seconds)
	const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
	for (let ch = 0; ch < 2; ch++) {
		const data = buffer.getChannelData(ch)
		for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
	}
	return buffer
}

export function playScore(ctx: AudioContext): Score {
	const t0 = ctx.currentTime + 0.12
	const at = (t: number) => t0 + t

	const master = ctx.createGain()
	master.gain.setValueAtTime(0.0001, ctx.currentTime)
	master.gain.exponentialRampToValueAtTime(0.6, t0 + 0.05)
	master.gain.setValueAtTime(0.6, at(11))
	master.gain.linearRampToValueAtTime(0.0001, at(14.5))
	const comp = ctx.createDynamicsCompressor()
	// 当作限幅器用，防止鼓点叠在一起时爆音
	comp.threshold.value = -12
	comp.knee.value = 4
	comp.ratio.value = 10
	comp.attack.value = 0.003
	comp.release.value = 0.25
	master.connect(comp).connect(ctx.destination)

	const reverb = ctx.createConvolver()
	reverb.buffer = impulse(ctx, 2.8, 2.6)
	const reverbOut = ctx.createGain()
	reverbOut.gain.value = 0.38
	reverb.connect(reverbOut).connect(master)

	// 附点八分的回声，让拨弦有空间感
	const delay = ctx.createDelay(1)
	delay.delayTime.value = 0.375
	const feedback = ctx.createGain()
	feedback.gain.value = 0.3
	const delayTone = ctx.createBiquadFilter()
	delayTone.type = 'lowpass'
	delayTone.frequency.value = 2600
	delay.connect(delayTone).connect(feedback).connect(delay)
	const delayOut = ctx.createGain()
	delayOut.gain.value = 0.22
	delayTone.connect(delayOut).connect(master)

	const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
	const nd = noise.getChannelData(0)
	for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
	const noiseSource = (start: number, duration: number) => {
		const src = ctx.createBufferSource()
		src.buffer = noise
		src.loop = true
		src.start(start)
		src.stop(start + duration)
		return src
	}

	// ---------- 乐器 ----------
	const pad = (notes: number[], start: number, duration: number, level: number, cutoff: [number, number]) => {
		const s = at(start)
		const filter = ctx.createBiquadFilter()
		filter.type = 'lowpass'
		filter.Q.value = 0.6
		filter.frequency.setValueAtTime(cutoff[0], s)
		filter.frequency.linearRampToValueAtTime(cutoff[1], s + duration)
		const env = ctx.createGain()
		env.gain.setValueAtTime(0, s)
		env.gain.linearRampToValueAtTime(level, s + 0.35)
		env.gain.setValueAtTime(level, s + duration)
		env.gain.linearRampToValueAtTime(0, s + duration + 0.9)
		filter.connect(env)
		env.connect(master)
		env.connect(reverb)
		for (const n of notes) {
			for (const detune of [-8, 8]) {
				const osc = ctx.createOscillator()
				osc.type = 'sawtooth'
				osc.frequency.value = freq(n)
				osc.detune.value = detune
				const g = ctx.createGain()
				g.gain.value = 1 / (notes.length * 2.4)
				osc.connect(g).connect(filter)
				osc.start(s)
				osc.stop(s + duration + 1)
			}
		}
	}

	const bass = (note: number, start: number, duration: number, level = 0.32) => {
		const s = at(start)
		const osc = ctx.createOscillator()
		osc.type = 'triangle'
		osc.frequency.value = freq(note)
		const lp = ctx.createBiquadFilter()
		lp.type = 'lowpass'
		lp.frequency.value = 380
		const env = ctx.createGain()
		env.gain.setValueAtTime(0, s)
		env.gain.linearRampToValueAtTime(level, s + 0.04)
		env.gain.setValueAtTime(level, s + duration - 0.1)
		env.gain.linearRampToValueAtTime(0, s + duration + 0.2)
		osc.connect(lp).connect(env).connect(master)
		osc.start(s)
		osc.stop(s + duration + 0.3)
	}

	const pluck = (note: number, time: number, level = 0.22) => {
		const s = at(time)
		const env = ctx.createGain()
		env.gain.setValueAtTime(0, s)
		env.gain.linearRampToValueAtTime(level, s + 0.005)
		env.gain.exponentialRampToValueAtTime(0.0001, s + 0.7)
		const lp = ctx.createBiquadFilter()
		lp.type = 'lowpass'
		lp.frequency.value = 3600
		env.connect(lp)
		lp.connect(master)
		lp.connect(delay)
		lp.connect(reverb)
		for (const [type, mul, amp] of [
			['triangle', 1, 1],
			['sine', 2, 0.3]
		] as const) {
			const osc = ctx.createOscillator()
			osc.type = type
			osc.frequency.value = freq(note) * mul
			const g = ctx.createGain()
			g.gain.value = amp
			osc.connect(g).connect(env)
			osc.start(s)
			osc.stop(s + 0.8)
		}
	}

	const bell = (note: number, time: number, level = 0.16) => {
		const s = at(time)
		const partials = [
			[1, 1, 2.6],
			[2.76, 0.42, 1.3],
			[5.4, 0.22, 0.7],
			[8.93, 0.08, 0.35]
		]
		for (const [ratio, amp, decay] of partials) {
			const osc = ctx.createOscillator()
			osc.type = 'sine'
			osc.frequency.value = freq(note) * ratio
			const g = ctx.createGain()
			g.gain.setValueAtTime(0, s)
			g.gain.linearRampToValueAtTime(level * amp, s + 0.004)
			g.gain.exponentialRampToValueAtTime(0.0001, s + decay)
			osc.connect(g)
			g.connect(master)
			g.connect(reverb)
			osc.start(s)
			osc.stop(s + decay + 0.1)
		}
	}

	const kick = (time: number, level = 0.85) => {
		const s = at(time)
		const osc = ctx.createOscillator()
		osc.frequency.setValueAtTime(140, s)
		osc.frequency.exponentialRampToValueAtTime(42, s + 0.13)
		const env = ctx.createGain()
		env.gain.setValueAtTime(level, s)
		env.gain.exponentialRampToValueAtTime(0.0001, s + 0.38)
		osc.connect(env).connect(master)
		osc.start(s)
		osc.stop(s + 0.4)
	}

	const snap = (time: number, level = 0.28) => {
		const s = at(time)
		const bp = ctx.createBiquadFilter()
		bp.type = 'bandpass'
		bp.frequency.value = 1900
		bp.Q.value = 1.1
		const env = ctx.createGain()
		env.gain.setValueAtTime(level, s)
		env.gain.exponentialRampToValueAtTime(0.0001, s + 0.12)
		noiseSource(s, 0.15).connect(bp).connect(env)
		env.connect(master)
		env.connect(reverb)
	}

	const hat = (time: number, level = 0.05) => {
		const s = at(time)
		const hp = ctx.createBiquadFilter()
		hp.type = 'highpass'
		hp.frequency.value = 7500
		const env = ctx.createGain()
		env.gain.setValueAtTime(level, s)
		env.gain.exponentialRampToValueAtTime(0.0001, s + 0.04)
		noiseSource(s, 0.05).connect(hp).connect(env).connect(master)
	}

	const sweep = (start: number, end: number, from: number, to: number, level: number) => {
		const s = at(start)
		const e = at(end)
		const bp = ctx.createBiquadFilter()
		bp.type = 'bandpass'
		bp.Q.value = 3
		bp.frequency.setValueAtTime(from, s)
		bp.frequency.exponentialRampToValueAtTime(to, e)
		const env = ctx.createGain()
		env.gain.setValueAtTime(0.0001, s)
		env.gain.exponentialRampToValueAtTime(level, e - 0.02)
		env.gain.linearRampToValueAtTime(0, e + 0.03)
		noiseSource(s, end - start + 0.1)
			.connect(bp)
			.connect(env)
		env.connect(master)
		env.connect(reverb)
	}

	const boom = (time: number) => {
		const s = at(time)
		const osc = ctx.createOscillator()
		osc.frequency.setValueAtTime(70, s)
		osc.frequency.exponentialRampToValueAtTime(38, s + 1.2)
		const env = ctx.createGain()
		env.gain.setValueAtTime(0.7, s)
		env.gain.exponentialRampToValueAtTime(0.0001, s + 1.6)
		osc.connect(env).connect(master)
		osc.start(s)
		osc.stop(s + 1.7)
	}

	// ---------- 编曲 ----------
	// 和弦：Fmaj9 → Am7 → Dm9 → B♭maj7 / Csus → Fmaj9（文字段落安静下来）→ 揭幕时的大和弦
	pad([53, 57, 60, 64, 67], 0, 2, 0.26, [700, 1500])
	pad([57, 60, 64, 67], 2, 2, 0.22, [1100, 1800])
	pad([50, 53, 57, 60, 64], 4, 2, 0.22, [1300, 2100])
	pad([46, 50, 53, 57, 60], 6, 1, 0.22, [1500, 2200])
	pad([48, 53, 55, 60, 65], 7, 1, 0.24, [1800, 3200])
	pad([53, 57, 60, 64, 67], 8, 2, 0.12, [500, 700])
	pad([41, 48, 57, 64, 67, 72], 10, 2.6, 0.26, [1400, 2600])

	bass(45, 2, 2)
	bass(38, 4, 2)
	bass(34, 6, 1)
	bass(36, 7, 1)
	bass(29, 10, 2.4, 0.4)

	const melody = [
		[72, 69, 67, 69, 76],
		[76, 72, 69, 72, 79],
		[77, 74, 69, 72, 81],
		[77, 74, 72, 74, 79]
	]
	melody.forEach((bar, b) => bar.forEach((n, i) => pluck(n, b * 2 + HITS[i], 0.22)))

	// 文字一个个翻出来时的上行琶音，收拢成点时下行
	;[72, 76, 79, 84, 88].forEach((n, i) => pluck(n, 8.45 + i * 0.11, 0.14))
	bell(84, 9.0, 0.12)
	;[88, 84, 79].forEach((n, i) => pluck(n, 9.45 + i * 0.09, 0.12))
	bell(91, 9.85, 0.12)
	;[72, 79, 84, 88, 91].forEach((n, i) => bell(n, 10 + i * 0.06, 0.15))

	for (let t = 2; t < 8; t += 1) kick(t, t < 4 ? 0.6 : 0.85)
	;[4.75, 6.75, 7.25].forEach(t => kick(t, 0.6))
	;[4.5, 5.5, 6.5, 7.5].forEach(t => snap(t))
	for (let t = 2; t < 8; t += 0.25) hat(t, t % 0.5 === 0 ? 0.05 : 0.025)

	sweep(3.55, 4, 400, 5000, 0.18)
	sweep(5.55, 6, 400, 5000, 0.18)
	sweep(7, 8, 300, 8000, 0.28)
	boom(10)
	snap(10, 0.2)

	const latency = () => ((ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0) || ctx.baseLatency || 0

	return {
		now: () => ctx.currentTime - t0 - latency(),
		fadeOut: seconds => {
			const now = ctx.currentTime
			master.gain.cancelScheduledValues(now)
			master.gain.setValueAtTime(master.gain.value, now)
			master.gain.linearRampToValueAtTime(0.0001, now + seconds)
		},
		close: () => {
			ctx.close().catch(() => {})
		}
	}
}
