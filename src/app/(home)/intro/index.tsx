'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useConfigStore } from '../stores/config-store'
import dailyList from '@/app/daily/list.json'
import { useIntroStore } from './intro-store'
import { createFilm, END, LEAD as FILM_LEAD, COLORS } from './film'
import { playScore, type Score } from './score'
import { TRACK, LEAD_FILM_SECONDS, loadTrack, playTrack, timeStretch } from './track'

const SEEN_KEY = 'rinta-intro-v1'
const TAGLINE = 'LITTLE THINGS ANCHOR ME'
const SUBLINE = '小事，是我的锚点'

type Stage = 'off' | 'gate' | 'play' | 'leaving'

const photos = (dailyList as { type: string; src?: string; poster?: string }[])
	.map(m => (m.type === 'image' ? m.src : m.poster))
	.filter((src): src is string => !!src)

// 首次访问首页时播放；?intro=1 强制播放，?intro=0 关闭；开发时 ?intro=1&t=4.5 可以冻结在某一帧调试
export default function Intro() {
	const [stage, setStage] = useState<Stage>('off')
	const setHomeVisible = useIntroStore(s => s.setHomeVisible)
	const name = useConfigStore(s => s.siteContent.meta.username) || 'Rinta'
	const rootRef = useRef<HTMLDivElement>(null)
	const svgRef = useRef<SVGSVGElement>(null)
	const clockRef = useRef<(() => number) | null>(null)
	const scoreRef = useRef<Score | null>(null)
	const freezeRef = useRef<number | null>(null)
	const audioRef = useRef<{ ctx: AudioContext; buffer: Promise<AudioBuffer> } | null>(null)
	const [starting, setStarting] = useState(false)

	useLayoutEffect(() => {
		const params = new URLSearchParams(location.search)
		const query = params.get('intro')
		let seen = false
		try {
			seen = localStorage.getItem(SEEN_KEY) === '1'
		} catch {}
		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
		if (query === '1' || (query !== '0' && !seen && !reduced)) {
			setHomeVisible(false)
			const freeze = Number(params.get('t'))
			if (process.env.NODE_ENV !== 'production' && params.has('t') && !Number.isNaN(freeze)) {
				freezeRef.current = freeze
				clockRef.current = () => freezeRef.current ?? 0
				setStage('play')
			} else {
				setStage('gate')
			}
		}
	}, [setHomeVisible])

	// 停在入口页时就先把音乐下载解码好，点击后能立刻开始
	useEffect(() => {
		if (stage !== 'gate' || !TRACK || audioRef.current) return
		try {
			const ctx = new AudioContext()
			const buffer = loadTrack(ctx, TRACK.src)
			buffer.catch(() => {})
			audioRef.current = { ctx, buffer }
		} catch {}
	}, [stage])

	const finish = useCallback(() => {
		try {
			localStorage.setItem(SEEN_KEY, '1')
		} catch {}
		setHomeVisible(true)
		setStage('off')
		const score = scoreRef.current
		scoreRef.current = null
		if (score) setTimeout(() => score.close(), 12000)
		else audioRef.current?.ctx.close().catch(() => {})
	}, [setHomeVisible])

	const skip = useCallback(() => {
		scoreRef.current?.fadeOut(0.6)
		setHomeVisible(true)
		setStage('leaving')
		setTimeout(finish, 500)
	}, [finish, setHomeVisible])

	const start = async (withSound: boolean) => {
		if (starting) return
		setStarting(true)
		clockRef.current = null
		if (withSound) {
			try {
				if (TRACK && audioRef.current) {
					const { ctx, buffer } = audioRef.current
					await ctx.resume()
					scoreRef.current = playTrack(ctx, await buffer, TRACK.stretch)
				} else {
					const ctx = new AudioContext()
					await ctx.resume()
					scoreRef.current = playScore(ctx)
				}
				clockRef.current = scoreRef.current.now
			} catch {}
		}
		if (!clockRef.current) {
			const t0 = performance.now()
			clockRef.current = () => (performance.now() - t0) / 1000 / timeStretch - LEAD_FILM_SECONDS
		}
		setStage('play')
	}

	// 播放：每帧从时钟取时间，交给时间线渲染
	useEffect(() => {
		if (stage !== 'play' || !svgRef.current) return
		const svg = svgRef.current
		const film = createFilm(svg, { photos, tagline: TAGLINE, subline: SUBLINE, name })
		const fit = () => film.resize(innerWidth, innerHeight)
		fit()
		addEventListener('resize', fit)

		let raf = 0
		let homeShown = false
		const frame = () => {
			const t = Math.max(-FILM_LEAD, clockRef.current?.() ?? -FILM_LEAD)
			film.render(t)
			const r = film.irisRadius(t, innerWidth, innerHeight)
			const root = rootRef.current
			if (root) {
				const mask = r > 0 ? `radial-gradient(circle at 50% 50%, transparent ${r}px, #000 ${r + 1}px)` : 'none'
				root.style.maskImage = mask
				root.style.webkitMaskImage = mask
			}
			if (!homeShown && t >= 5.6) {
				homeShown = true
				setHomeVisible(true)
			}
			if (freezeRef.current !== null) return
			if (t >= END) return finish()
			raf = requestAnimationFrame(frame)
		}
		frame()

		// 开发时给录屏脚本用：seek 逐帧定格，playFrom 从某一刻开始按真实时间播放
		if (process.env.NODE_ENV !== 'production' && freezeRef.current !== null) {
			;(window as unknown as { __intro?: object }).__intro = {
				seek: (t: number) => {
					freezeRef.current = t
					frame()
				},
				playFrom: (t: number) => {
					const t0 = performance.now()
					freezeRef.current = null
					clockRef.current = () => t + (performance.now() - t0) / 1000 / timeStretch
					raf = requestAnimationFrame(frame)
				}
			}
		}
		return () => {
			cancelAnimationFrame(raf)
			removeEventListener('resize', fit)
		}
	}, [stage, name, finish, setHomeVisible])

	useEffect(() => {
		if (stage !== 'play' && stage !== 'gate') return
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && skip()
		addEventListener('keydown', onKey)
		const overflow = document.documentElement.style.overflow
		document.documentElement.style.overflow = 'hidden'
		return () => {
			removeEventListener('keydown', onKey)
			document.documentElement.style.overflow = overflow
		}
	}, [stage, skip])

	if (stage === 'off') return null

	return createPortal(
		<div
			ref={rootRef}
			className='fixed inset-0 z-[1000] overflow-hidden transition-opacity duration-500'
			style={{ background: COLORS.paper, opacity: stage === 'leaving' ? 0 : 1 }}>
			{stage === 'gate' ? (
				<div className='absolute inset-0 flex cursor-pointer flex-col items-center justify-center select-none' onClick={() => start(true)}>
					<div className='relative mb-10 h-10 w-40'>
						<span
							className='absolute top-0 left-1/2 size-4 rounded-full'
							style={{ background: COLORS.mint, animation: 'intro-bob 1.6s ease-in-out infinite' }}
						/>
						<span
							className='absolute bottom-0 left-1/2 h-4 w-28 rounded-[50%] border-2'
							style={{ borderColor: COLORS.cobalt, animation: 'intro-ripple 1.6s ease-out infinite' }}
						/>
					</div>
					<div className='font-averia text-6xl tracking-[0.25em] max-sm:text-5xl' style={{ color: COLORS.cobalt }}>
						{name.toUpperCase()}
					</div>
					<div className='mt-4 font-mono text-xs tracking-[0.45em]' style={{ color: COLORS.cobalt, opacity: 0.6 }}>
						{TAGLINE}
					</div>
					<button className='mt-12 rounded-full px-8 py-3 text-sm text-white shadow-[0_12px_30px_-12px_#2340ff]' style={{ background: COLORS.cobalt }}>
						{starting ? '音乐加载中…' : '▶ 点击进入 · 有声音'}
					</button>
					<button
						className='mt-4 text-xs tracking-wider'
						style={{ color: COLORS.cobalt, opacity: 0.55 }}
						onClick={e => {
							e.stopPropagation()
							start(false)
						}}>
						静音进入
					</button>
				</div>
			) : (
				<svg ref={svgRef} className='absolute inset-0 h-full w-full' preserveAspectRatio='xMidYMid slice' />
			)}

			<button
				onClick={skip}
				className='absolute top-5 right-6 rounded-full px-3 py-1.5 text-xs tracking-wider backdrop-blur-sm'
				style={{ color: COLORS.cobalt, background: '#ffffff99' }}>
				跳过 ›
			</button>

			<style>{`
				@keyframes intro-bob { 0%,100% { transform: translate(-50%, 0) } 50% { transform: translate(-50%, 14px) } }
				@keyframes intro-ripple { 0% { transform: translateX(-50%) scale(.4); opacity: 1 } 100% { transform: translateX(-50%) scale(1.3); opacity: 0 } }
			`}</style>
		</div>,
		document.body
	)
}
