// 开场 MG 动画：一个纯函数式的时间线。render(t) 只根据时间 t 计算每个图形的状态，
// 所以可以跟音频时钟精确对齐，也可以直接跳到任意一帧调试。
//
// 0–2s   光圈扇叶打开，在重音上一格格转动
// 2–4s   扇叶缩成胶片盘，胶片带着「生活日常」里的照片划过
// 4–6s   黄色：轨道线 + 花朵扇叶，最后炸成碎片
// 6–8s   钴蓝：一层层圆角卡片组成的隧道向前推进
// 8–10s  白色：雨丝变成 LITTLE THINGS I LOVE，再收拢成一个点
// 10–11s 点变成圆形遮罩打开，露出真正的首页

const NS = 'http://www.w3.org/2000/svg'

export const COLORS = {
	cobalt: '#2340ff',
	sky: '#2fc0ef',
	yellow: '#ffd43f',
	mint: '#2ad6a2',
	white: '#ffffff',
	paper: '#f2f8fd'
}
const C = COLORS

export const END = 11
export const REVEAL = [10, 10.9] as const

type Attrs = Record<string, string | number>

function h<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
	const el = document.createElementNS(NS, tag) as SVGElementTagNameMap[K]
	for (const k in attrs) el.setAttribute(k, String(attrs[k]))
	parent?.appendChild(el)
	return el
}
const set = (el: Element, attrs: Attrs) => {
	for (const k in attrs) el.setAttribute(k, String(attrs[k]))
}

export const E = {
	linear: (x: number) => x,
	out: (x: number) => 1 - Math.pow(1 - x, 3),
	in: (x: number) => x * x * x,
	inOut: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
	outExpo: (x: number) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
	inExpo: (x: number) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
	outBack: (x: number) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2)
}
export const seg = (t: number, a: number, b: number, ease = E.linear) => (t <= a ? 0 : t >= b ? 1 : ease((t - a) / (b - a)))
const pulse = (t: number, t0: number, len: number) => (t <= t0 || t >= t0 + len ? 0 : Math.sin((Math.PI * (t - t0)) / len))
const lerp = (a: number, b: number, p: number) => a + (b - a) * p
const tf = (x: number, y: number, r = 0, s: number | [number, number] = 1) =>
	`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${r.toFixed(2)}) scale(${Array.isArray(s) ? `${s[0].toFixed(4)} ${s[1].toFixed(4)}` : s.toFixed(4)})`
const show = (el: Element, on: boolean) => ((el as SVGElement).style.display = on ? '' : 'none')

function rng(seed: number) {
	return () => {
		seed |= 0
		seed = (seed + 0x6d2b79f5) | 0
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

const polar = (r: number, deg: number) => {
	const a = ((deg - 90) * Math.PI) / 180
	return [r * Math.cos(a), r * Math.sin(a)]
}
function sector(r0: number, r1: number, a0: number, a1: number) {
	const large = a1 - a0 > 180 ? 1 : 0
	const [x0, y0] = polar(r1, a0)
	const [x1, y1] = polar(r1, a1)
	const [x2, y2] = polar(r0, a1)
	const [x3, y3] = polar(r0, a0)
	return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`
}
const sparkle = (s: number) => {
	const k = s * 0.14
	return `M0 ${-s}Q${k} ${-k} ${s} 0Q${k} ${k} 0 ${s}Q${-k} ${k} ${-s} 0Q${-k} ${-k} 0 ${-s}Z`
}

// tagline：落点前逐个翻出来的英文；subline：下面那行中文（不传就显示名字）
export type FilmOptions = { photos: string[]; tagline: string; name: string; subline?: string }

export function createFilm(svg: SVGSVGElement, { photos, tagline, name, subline }: FilmOptions) {
	svg.innerHTML = ''
	const defs = h('defs', {}, svg)

	const bg = h('rect', { x: -5000, y: -5000, width: 10000, height: 10000, fill: C.paper }, svg)

	// ================= 场景 1：光圈扇叶 =================
	const g1 = h('g', {}, svg)
	const fan = h('g', {}, g1)
	const fanColors = [C.sky, C.mint, C.yellow, C.cobalt, C.sky, C.yellow]
	const blades = fanColors.map((fill, i) => {
		const g = h('g', {}, fan)
		h('path', { d: sector(70, 540, i * 60 + 8, i * 60 + 52), fill }, g)
		h('path', { d: sector(560, 600, i * 60 + 14, i * 60 + 46), fill: C.cobalt, opacity: 0.9 }, g)
		return { g, mid: i * 60 + 30 }
	})
	const fanRing = h('circle', { r: 660, fill: 'none', stroke: C.cobalt, 'stroke-width': 2, 'stroke-dasharray': '4 16' }, fan)
	h('circle', { r: 70, fill: C.white }, fan)
	h('circle', { r: 70, fill: 'none', stroke: C.cobalt, 'stroke-width': 6 }, fan)
	const fanStar = h('path', { d: sparkle(38), fill: C.mint }, fan)

	// ================= 场景 2：胶片盘 + 胶片带 =================
	const g2 = h('g', {}, svg)
	const cam2 = h('g', {}, g2)
	const reel = (r: number, fill: string, parent: Element) => {
		const g = h('g', {}, parent)
		h('circle', { r, fill, stroke: C.cobalt, 'stroke-width': r * 0.05 }, g)
		h('circle', { r: r * 0.86, fill: 'none', stroke: C.white, 'stroke-width': 2, 'stroke-dasharray': '3 10' }, g)
		for (let i = 0; i < 6; i++) {
			const [x, y] = polar(r * 0.56, i * 60)
			h('circle', { cx: x, cy: y, r: r * 0.22, fill: C.white, stroke: C.cobalt, 'stroke-width': 3 }, g)
		}
		h('circle', { r: r * 0.16, fill: C.yellow, stroke: C.cobalt, 'stroke-width': 4 }, g)
		h('path', { d: sparkle(r * 0.1), fill: C.cobalt }, g)
		return g
	}
	const reelA = reel(170, C.sky, cam2)
	const reelB = reel(105, C.yellow, cam2)
	const tape = h('path', { d: 'M-300 0 C -120 160, 40 40, 60 200', fill: 'none', stroke: C.cobalt, 'stroke-width': 8, 'stroke-linecap': 'round' }, cam2)

	const holes = h('pattern', { id: 'intro-holes', width: 44, height: 232, patternUnits: 'userSpaceOnUse', x: 0, y: -116 }, defs)
	h('rect', { x: 12, y: 10, width: 20, height: 14, rx: 3, fill: C.white }, holes)
	h('rect', { x: 12, y: 208, width: 20, height: 14, rx: 3, fill: C.white }, holes)
	const stripWrap = h('g', {}, cam2)
	const strip = h('g', {}, stripWrap)
	const frameCount = 9
	const stripLen = frameCount * 300 + 300
	h('rect', { x: -stripLen / 2, y: -116, width: stripLen, height: 232, fill: C.cobalt }, strip)
	h('rect', { x: -stripLen / 2, y: -116, width: stripLen, height: 232, fill: 'url(#intro-holes)' }, strip)
	const pics = photos.length ? photos : []
	for (let i = 0; i < frameCount; i++) {
		const x = -stripLen / 2 + 170 + i * 300
		const id = `intro-frame-${i}`
		const clip = h('clipPath', { id }, defs)
		h('rect', { x, y: -78, width: 260, height: 156, rx: 10 }, clip)
		const fill = [C.sky, C.yellow, C.mint, C.white][i % 4]
		h('rect', { x, y: -78, width: 260, height: 156, rx: 10, fill }, strip)
		if (pics.length) {
			h('image', { href: pics[i % pics.length], x, y: -78, width: 260, height: 156, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${id})` }, strip)
		} else {
			h('path', { d: sparkle(30), fill: C.cobalt, transform: `translate(${x + 130} 0)` }, strip)
		}
		h('rect', { x, y: -78, width: 260, height: 156, rx: 10, fill: 'none', stroke: C.white, 'stroke-width': 5 }, strip)
	}
	const r2 = rng(7)
	const sparks2 = Array.from({ length: 8 }, (_, i) => {
		const el = h('path', { d: sparkle(20 + r2() * 26), fill: i % 2 ? C.mint : C.yellow, stroke: C.cobalt, 'stroke-width': 2 }, cam2)
		return { el, x: lerp(-460, 460, r2()), y: lerp(-380, 380, r2()), t: 2 + [0.75, 1, 1.25, 1.5][i % 4] + (i > 3 ? 0.02 : 0) }
	})
	const wipeYellow = h('circle', { r: 0, fill: C.yellow }, g2)

	// ================= 场景 3：黄色轨道 + 花 =================
	const g3 = h('g', {}, svg)
	const orbits = [0, 45, 90, 135].map(rot => {
		const rx = 470
		const ry = 150
		const len = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)))
		const el = h(
			'ellipse',
			{ rx, ry, fill: 'none', stroke: C.cobalt, 'stroke-width': 2.5, transform: `rotate(${rot})`, 'stroke-dasharray': len, 'stroke-dashoffset': len },
			g3
		)
		return { el, rot, rx, ry, len }
	})
	const orbitDots = [C.mint, C.white, C.cobalt, C.sky].map(fill => h('circle', { r: 10, fill, stroke: C.cobalt, 'stroke-width': 3 }, g3))
	const flower = h('g', {}, g3)
	const petalColors = [C.cobalt, C.sky, C.mint, C.white, C.cobalt, C.sky, C.mint, C.white]
	const petals = petalColors.map((fill, i) => {
		const g = h('g', {}, flower)
		h('path', { d: sector(66, 250, i * 45 + 5, i * 45 + 40), fill, stroke: C.cobalt, 'stroke-width': fill === C.white ? 3 : 0 }, g)
		h('path', { d: sector(150, 170, i * 45 + 12, i * 45 + 33), fill: C.white, opacity: fill === C.white ? 0 : 0.55 }, g)
		return { g, mid: i * 45 + 22.5 }
	})
	h('circle', { r: 62, fill: C.sky, stroke: C.cobalt, 'stroke-width': 5 }, flower)
	h('path', { d: sparkle(34), fill: C.white }, flower)
	const r3 = rng(11)
	const shards = Array.from({ length: 22 }, (_, i) => {
		const kind = i % 3
		const s = 18 + r3() * 30
		const d =
			kind === 0
				? `M0 ${-s}L${s} ${s}L${-s} ${s}Z`
				: kind === 1
					? `M${-s} ${-s}H${s}V${s}H${-s}Z`
					: `M0 0L${s * 1.4} 0A${s * 1.4} ${s * 1.4} 0 0 1 0 ${s * 1.4}Z`
		const el = h('path', { d, fill: [C.cobalt, C.sky, C.mint, C.white][i % 4], stroke: C.cobalt, 'stroke-width': 2 }, g3)
		return { el, a: r3() * 360, dist: 260 + r3() * 520, spin: (r3() - 0.5) * 540 }
	})
	const wipeCobalt = h('rect', { fill: C.cobalt }, g3)

	// ================= 场景 4：卡片隧道 =================
	const g4 = h('g', {}, svg)
	const tunnel = h('g', {}, g4)
	const layerStyles = [
		{ fill: C.white, stroke: C.cobalt },
		{ fill: C.sky, stroke: C.white },
		{ fill: C.cobalt, stroke: C.white },
		{ fill: '#b9c4ff', stroke: C.cobalt }
	]
	const layers = Array.from({ length: 10 }, (_, i) => {
		const st = layerStyles[i % layerStyles.length]
		const g = h('g', {}, tunnel)
		const body = h('rect', { fill: st.fill }, g)
		const line = h('rect', { fill: 'none', stroke: st.stroke, 'stroke-width': 2, 'stroke-dasharray': '10 8', 'vector-effect': 'non-scaling-stroke' }, g)
		return { g, body, line, i }
	})
	const rings4 = [0.75, 1, 1.25].map(() => h('circle', { r: 0, fill: 'none', stroke: C.sky, 'stroke-width': 4 }, g4))
	const core4 = h('path', { d: sparkle(42), fill: C.mint, stroke: C.white, 'stroke-width': 3 }, g4)
	const wipeWhite = h('rect', { fill: C.paper }, g4)

	// ================= 场景 5：文字 =================
	const g5 = h('g', {}, svg)
	const chars = [...tagline]
	const cell = Math.min(42, 820 / Math.max(1, chars.length - 1))
	const letters = chars
		.map((ch, i) => ({ ch, x: (i - (chars.length - 1) / 2) * cell }))
		.filter(l => l.ch !== ' ')
		.map((l, i) => {
			const el = h(
				'text',
				{
					x: 0,
					y: 0,
					'text-anchor': 'middle',
					'dominant-baseline': 'central',
					'font-size': 46,
					'font-family': "'SF Mono','JetBrains Mono',Menlo,monospace",
					'font-weight': 500,
					fill: C.cobalt
				},
				g5
			)
			el.textContent = l.ch
			return { el, x: l.x, i }
		})
	const r5 = rng(23)
	const dashes = letters.map((_, i) => {
		const el = h('line', { x1: -22, y1: 0, x2: 22, y2: 0, stroke: C.cobalt, 'stroke-width': 4, 'stroke-linecap': 'round' }, g5)
		const row = i % 2
		return { el, x: lerp(-430, 430, i / (letters.length - 1)) + (r5() - 0.5) * 30, y: row ? 70 : -60, d: r5() * 0.25 }
	})
	const nameEl = h(
		'text',
		{
			y: 92,
			'text-anchor': 'middle',
			'font-size': subline ? 36 : 30,
			'font-weight': subline ? 600 : 400,
			'letter-spacing': subline ? 14 : 10,
			'font-family': "'Averia Gruesa Libre','PingFang SC',sans-serif",
			fill: C.cobalt
		},
		g5
	)
	nameEl.textContent = subline ?? `— ${name.toUpperCase()} —`
	const ripple = h('ellipse', { cx: 0, cy: 34, rx: 0, ry: 0, fill: 'none', stroke: C.cobalt, 'stroke-width': 2 }, g5)
	const ripple2 = h('ellipse', { cx: 0, cy: 34, rx: 0, ry: 0, fill: 'none', stroke: C.sky, 'stroke-width': 2 }, g5)
	const dot = h('circle', { r: 0, fill: C.mint }, g5)

	function resize(width: number, height: number) {
		// 短边固定 1000 个单位，横竖屏都能完整看到中心 1000×1000 的区域
		const aspect = width / height
		const W = aspect >= 1 ? 1000 * aspect : 1000
		const H = aspect >= 1 ? 1000 : 1000 / aspect
		svg.setAttribute('viewBox', `${-W / 2} ${-H / 2} ${W} ${H}`)
	}

	function render(t: number) {
		bg.setAttribute('fill', t < 4 ? C.paper : t < 6 ? C.yellow : t < 8 ? C.cobalt : C.paper)

		// ---------- 场景 1 ----------
		show(g1, t < 2)
		if (t < 2) {
			const pop = seg(t, 0, 0.6, E.outBack)
			const steps = [0.75, 1, 1.25].reduce((sum, h0) => sum + seg(t, h0, h0 + 0.14, E.out), 0)
			const exit = seg(t, 1.5, 2, E.inOut)
			const rot = -120 * (1 - seg(t, 0, 0.6, E.out)) + steps * 30 + exit * 220
			set(fan, { transform: tf(lerp(0, -300, exit), lerp(0, -200, exit), rot, Math.max(0.0001, pop * (1 - 0.69 * exit))), opacity: 1 - seg(t, 1.85, 2) })
			blades.forEach(({ g, mid }) => {
				const kick = 34 * Math.max(...[0.75, 1, 1.25, 1.5].map(h0 => pulse(t, h0, 0.24)))
				const [dx, dy] = polar(kick, mid)
				g.setAttribute('transform', `translate(${dx} ${dy})`)
			})
			set(fanRing, { transform: `rotate(${-t * 40})`, opacity: seg(t, 0.3, 0.7) })
			set(fanStar, { transform: `rotate(${t * 90}) scale(${1 + 0.4 * pulse(t, 1, 0.3)})` })
		}

		// ---------- 场景 2 ----------
		show(g2, t >= 1.85 && t < 4)
		if (t >= 1.85 && t < 4) {
			const push = seg(t, 3.55, 4, E.in)
			set(cam2, { transform: tf(0, 0, push * 8, 1 + push * 1.6) })
			const inA = seg(t, 1.85, 2.05, E.out)
			set(reelA, { transform: tf(-300, -200, t * 260, 0.9 + inA * 0.1), opacity: inA })
			const inB = seg(t, 2.05, 2.45, E.outBack)
			set(reelB, { transform: tf(60, -300, -t * 300, Math.max(0.0001, inB)) })
			set(tape, { 'stroke-dasharray': 900, 'stroke-dashoffset': 900 * (1 - seg(t, 2.1, 2.6, E.out)), transform: 'translate(0 -170)' })
			const slide = seg(t, 2.05, 3.95, E.inOut)
			set(stripWrap, { transform: tf(0, 170, -14) })
			set(strip, { transform: `translate(${lerp(1500, -1300, slide)} 0)` })
			sparks2.forEach(s => {
				const p = seg(t, s.t, s.t + 0.35, E.outBack) * (1 - seg(t, s.t + 0.5, s.t + 0.8))
				set(s.el, { transform: tf(s.x, s.y, (t - s.t) * 120, Math.max(0.0001, p)) })
			})
			wipeYellow.setAttribute('r', String(1600 * seg(t, 3.65, 4, E.in)))
		}

		// ---------- 场景 3 ----------
		show(g3, t >= 4 && t < 6)
		if (t >= 4 && t < 6) {
			orbits.forEach((o, i) => {
				o.el.setAttribute('stroke-dashoffset', String(o.len * (1 - seg(t, 4 + i * 0.08, 4.9 + i * 0.08, E.out))))
				const a = t * 2.2 + i * 1.7
				const x = o.rx * Math.cos(a)
				const y = o.ry * Math.sin(a)
				const rr = (o.rot * Math.PI) / 180
				set(orbitDots[i], { cx: x * Math.cos(rr) - y * Math.sin(rr), cy: x * Math.sin(rr) + y * Math.cos(rr), opacity: seg(t, 4.5, 4.7) })
			})
			const pop = seg(t, 4, 4.45, E.outBack)
			const steps = [4.75, 5, 5.25].reduce((sum, h0) => sum + seg(t, h0, h0 + 0.14, E.out), 0)
			const burst = seg(t, 5.5, 5.95, E.outExpo)
			set(flower, { transform: tf(0, 0, (t - 4) * 18 + steps * 22.5, Math.max(0.0001, pop)) })
			petals.forEach(({ g, mid }) => {
				const kick = 26 * Math.max(...[4.75, 5, 5.25].map(h0 => pulse(t, h0, 0.22))) + burst * 900
				const [dx, dy] = polar(kick, mid)
				g.setAttribute('transform', `translate(${dx} ${dy}) rotate(${burst * 140})`)
			})
			shards.forEach(s => {
				const p = seg(t, 5.25, 5.95, E.outExpo)
				const [x, y] = polar(s.dist * p, s.a)
				set(s.el, { transform: tf(x, y, s.spin * p, p > 0 ? 1 - 0.3 * p : 0.0001), opacity: 1 - seg(t, 5.7, 6) })
			})
			const w = 2600 * seg(t, 5.6, 6, E.in)
			set(wipeCobalt, { x: -w / 2, y: -w / 2, width: w, height: w, transform: `rotate(${45 * (1 - seg(t, 5.6, 6))})` })
		}

		// ---------- 场景 4 ----------
		show(g4, t >= 6 && t < 8)
		if (t >= 6 && t < 8) {
			const n = layers.length
			const speed = 2.3
			const depth = layers.map(l => ({ l, z: (((l.i + (t - 6) * speed) % n) + n) % n }))
			depth.sort((a, b) => b.z - a.z)
			depth.forEach(({ l, z }) => {
				tunnel.appendChild(l.g)
				const s = 34 * Math.pow(1.45, z)
				const r = s * 0.14
				set(l.body, { x: -s / 2, y: -s / 2, width: s, height: s, rx: r })
				set(l.line, { x: -s / 2 + s * 0.05, y: -s / 2 + s * 0.05, width: s * 0.9, height: s * 0.9, rx: r * 0.8 })
				set(l.g, { transform: `rotate(${z * 11 + (t - 6) * 32})`, opacity: seg(z, 0, 0.8) })
			})
			;[0.75, 1, 1.25].forEach((h0, i) => {
				const p = seg(t, 6 + h0, 6 + h0 + 0.5, E.out)
				set(rings4[i], { r: 30 + p * 420, opacity: p > 0 ? 1 - p : 0 })
			})
			const beat = Math.max(...[0, 0.75, 1, 1.25, 1.5].map(h0 => pulse(t, 6 + h0, 0.2)))
			set(core4, { transform: tf(0, 0, (t - 6) * 120, 1 + beat * 0.5) })
			const w = 2800 * seg(t, 7.55, 8, E.in)
			set(wipeWhite, { x: -w / 2, y: -w / 2, width: w, height: w, rx: w * 0.12 * (1 - seg(t, 7.55, 8)), transform: `rotate(${-45 * (1 - seg(t, 7.55, 8))})` })
		}

		// ---------- 场景 5 ----------
		show(g5, t >= 8)
		if (t >= 8) {
			const collapse = (i: number) => seg(t, 9.45 + Math.abs(i - letters.length / 2) * 0.012, 9.8, E.in)
			dashes.forEach((d, i) => {
				const draw = seg(t, 8 + d.d, 8.25 + d.d, E.out)
				const move = seg(t, 8.3, 8.6, E.inOut)
				const L = letters[i]
				set(d.el, {
					transform: tf(lerp(d.x, L.x, move), lerp(d.y, 0, move), lerp(-35, 90, move), Math.max(0.0001, draw * (1 - move * 0.5))),
					opacity: 1 - seg(t, 8.55, 8.7)
				})
			})
			letters.forEach(L => {
				const p = seg(t, 8.5 + L.i * 0.03, 8.85 + L.i * 0.03, E.outBack)
				const c = collapse(L.i)
				set(L.el, {
					transform: tf(lerp(L.x, 0, c), 0, (1 - p) * -40, [Math.max(0.0001, 1 - c), Math.max(0.0001, p * (1 - c))]),
					opacity: p > 0 ? 1 : 0
				})
			})
			set(nameEl, { opacity: seg(t, 9, 9.3) * (1 - seg(t, 9.4, 9.6)), transform: `translate(0 ${lerp(16, 0, seg(t, 9, 9.3, E.out))})` })
			const dp = seg(t, 9.7, 9.95, E.outBack)
			dot.setAttribute('r', String(Math.max(0, dp * 13 + seg(t, 9.95, 10.2, E.in) * 30)))
			const rp = seg(t, 9.8, 10.6, E.out)
			set(ripple, { rx: rp * 140, ry: rp * 26, opacity: rp > 0 ? 1 - rp : 0 })
			const rp2 = seg(t, 9.95, 10.8, E.out)
			set(ripple2, { rx: rp2 * 220, ry: rp2 * 40, opacity: rp2 > 0 ? 1 - rp2 : 0 })
		}
	}

	// 揭幕时圆形遮罩的半径（像素），从屏幕中心的那个点长出来
	function irisRadius(t: number, width: number, height: number) {
		return seg(t, REVEAL[0], REVEAL[1], E.inOut) * Math.hypot(width, height) * 0.55
	}

	return {
		resize,
		render,
		irisRadius
	}
}
