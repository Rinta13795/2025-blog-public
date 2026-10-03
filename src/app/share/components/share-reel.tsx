'use client'

import { useEffect, useRef } from 'react'
import type { Share } from './share-card'
import styles from './share-reel.module.css'

/** Original implementation inspired by Reel Flux's velocity-reactive ribbon.
 * Keep links in the DOM: titles stay readable and keyboard navigation stays native.
 */
export default function ShareReel({ shares }: { shares: Share[] }) {
	const viewportRef = useRef<HTMLDivElement>(null)
	const previousRef = useRef<HTMLButtonElement>(null)
	const nextRef = useRef<HTMLButtonElement>(null)
	const counterRef = useRef<HTMLSpanElement>(null)

	useEffect(() => {
		const viewport = viewportRef.current
		if (!viewport) return
		const panels = Array.from(viewport.querySelectorAll<HTMLElement>('[data-reel-panel]'))
		const links = Array.from(viewport.querySelectorAll<HTMLAnchorElement>('a'))
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
		let frame = 0
		let lastTime = 0
		let lastScroll = viewport.scrollLeft
		let wave = 0
		let momentum = 0
		let suppressClick = false
		let drag: { id: number; x: number; y: number; scroll: number; lastX: number; time: number; speed: number; moved: boolean } | null = null

		const updateControls = () => {
			const maximum = viewport.scrollWidth - viewport.clientWidth
			if (previousRef.current) previousRef.current.disabled = viewport.scrollLeft < 2
			if (nextRef.current) nextRef.current.disabled = maximum - viewport.scrollLeft < 2
			const center = viewport.scrollLeft + viewport.clientWidth / 2
			let nearest = 0
			let distance = Infinity
			links.forEach((link, index) => {
				const difference = Math.abs(link.offsetLeft + link.offsetWidth / 2 - center)
				if (difference < distance) {
					nearest = index
					distance = difference
				}
			})
			if (counterRef.current) counterRef.current.textContent = `${nearest + 1} / ${shares.length}`
		}

		const animate = (time: number) => {
			const dt = Math.min(32, lastTime ? time - lastTime : 16.67)
			lastTime = time
			if (motion.matches) momentum = 0
			if (!drag && Math.abs(momentum) > 0.02 && !motion.matches) {
				const before = viewport.scrollLeft
				viewport.scrollLeft += momentum * dt
				momentum *= Math.pow(0.93, dt / 16.67)
				if (viewport.scrollLeft === before) momentum = 0
			}
			const position = viewport.scrollLeft
			const velocity = (position - lastScroll) / Math.max(dt, 1)
			lastScroll = position
			const target = motion.matches ? 0 : Math.max(-1, Math.min(1, velocity / 2.4))
			wave += (target - wave) * (1 - Math.exp(-dt / 100))
			panels.forEach(panel => {
				const center = panel.parentElement!.offsetLeft + panel.offsetWidth / 2 - position
				const phase = (center - viewport.clientWidth / 2) / 180
				panel.style.transform = motion.matches
					? ''
					: `perspective(900px) translate3d(0, ${Math.sin(phase) * wave * 32}px, ${Math.cos(phase) * Math.abs(wave) * 36}px) rotateY(${Math.sin(phase) * wave * 12}deg) rotateZ(${Math.cos(phase) * wave * 3}deg)`
			})
			updateControls()
			if (Math.abs(wave) > 0.002 || Math.abs(velocity) > 0.005 || Math.abs(momentum) > 0.02 || drag?.moved) {
				frame = requestAnimationFrame(animate)
			} else {
				panels.forEach(panel => {
					panel.style.transform = ''
				})
				frame = 0
				lastTime = 0
			}
		}
		const wake = () => {
			if (!frame) frame = requestAnimationFrame(animate)
		}
		const onScroll = () => {
			wake()
		}
		const onWheel = (event: WheelEvent) => {
			if (event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
			const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientWidth : 1
			const delta = event.deltaY * multiplier
			const maximum = viewport.scrollWidth - viewport.clientWidth
			if (maximum <= 0 || (delta < 0 && viewport.scrollLeft <= 0) || (delta > 0 && viewport.scrollLeft >= maximum - 1)) return
			event.preventDefault()
			momentum = 0
			viewport.scrollBy({ left: delta, behavior: motion.matches ? 'instant' : 'smooth' })
			wake()
		}
		const onDown = (event: PointerEvent) => {
			suppressClick = false
			momentum = 0
			// Touch uses native horizontal scrolling, including its inertia and pan-y escape.
			if (event.pointerType === 'touch' || event.button !== 0) return
			drag = {
				id: event.pointerId,
				x: event.clientX,
				y: event.clientY,
				scroll: viewport.scrollLeft,
				lastX: event.clientX,
				time: event.timeStamp,
				speed: 0,
				moved: false
			}
		}
		const onMove = (event: PointerEvent) => {
			if (!drag || drag.id !== event.pointerId) return
			const dx = event.clientX - drag.x
			const dy = event.clientY - drag.y
			if (!drag.moved && Math.hypot(dx, dy) < 6) return
			if (!drag.moved) {
				viewport.setPointerCapture(event.pointerId)
				drag.moved = true
			}
			event.preventDefault()
			suppressClick = true
			viewport.dataset.dragging = 'true'
			const elapsed = Math.max(1, event.timeStamp - drag.time)
			drag.speed = Math.max(-3, Math.min(3, (drag.lastX - event.clientX) / elapsed))
			drag.lastX = event.clientX
			drag.time = event.timeStamp
			viewport.scrollLeft = drag.scroll - dx
			wake()
		}
		const finish = (event: PointerEvent) => {
			if (!drag || drag.id !== event.pointerId) return
			momentum = event.type === 'pointerup' && drag.moved && event.timeStamp - drag.time < 100 ? drag.speed : 0
			const id = drag.id
			drag = null
			delete viewport.dataset.dragging
			if (viewport.hasPointerCapture(id)) viewport.releasePointerCapture(id)
			wake()
		}
		const onClick = (event: MouseEvent) => {
			// Keyboard activation has detail=0 and must remain available after a drag.
			if (suppressClick && event.detail > 0) {
				event.preventDefault()
				event.stopPropagation()
			}
		}
		const onDragStart = (event: DragEvent) => {
			event.preventDefault()
		}
		const resize = new ResizeObserver(wake)
		resize.observe(viewport)
		viewport.addEventListener('scroll', onScroll, { passive: true })
		viewport.addEventListener('wheel', onWheel, { passive: false })
		viewport.addEventListener('pointerdown', onDown)
		viewport.addEventListener('pointermove', onMove)
		viewport.addEventListener('pointerup', finish)
		viewport.addEventListener('pointercancel', finish)
		viewport.addEventListener('lostpointercapture', finish)
		viewport.addEventListener('click', onClick, true)
		viewport.addEventListener('auxclick', onClick, true)
		viewport.addEventListener('dragstart', onDragStart)
		motion.addEventListener('change', wake)
		wake()
		return () => {
			cancelAnimationFrame(frame)
			resize.disconnect()
			viewport.removeEventListener('scroll', onScroll)
			viewport.removeEventListener('wheel', onWheel)
			viewport.removeEventListener('pointerdown', onDown)
			viewport.removeEventListener('pointermove', onMove)
			viewport.removeEventListener('pointerup', finish)
			viewport.removeEventListener('pointercancel', finish)
			viewport.removeEventListener('lostpointercapture', finish)
			viewport.removeEventListener('click', onClick, true)
			viewport.removeEventListener('auxclick', onClick, true)
			viewport.removeEventListener('dragstart', onDragStart)
			motion.removeEventListener('change', wake)
		}
	}, [shares])

	const move = (direction: number) => {
		const viewport = viewportRef.current
		if (!viewport) return
		viewport.scrollBy({
			left: direction * viewport.clientWidth * 0.7,
			behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
		})
	}

	return (
		<section className={styles.reel} aria-label='网站收藏'>
			<div className={styles.toolbar}>
				<p id='share-reel-hint'>拖动浏览 · 点击访问网站</p>
				<div className={styles.controls}>
					<span ref={counterRef}>{`1 / ${shares.length}`}</span>
					<button ref={previousRef} type='button' aria-label='上一组收藏' onClick={() => move(-1)}>
						←
					</button>
					<button ref={nextRef} type='button' aria-label='下一组收藏' onClick={() => move(1)}>
						→
					</button>
				</div>
			</div>
			<div ref={viewportRef} className={styles.viewport} aria-describedby='share-reel-hint'>
				<div className={styles.track}>
					{shares.map(share => (
						<a key={share.url} className={styles.item} href={share.url} target='_blank' rel='noopener noreferrer' aria-label={`${share.name}，在新标签页访问`}>
							<div data-reel-panel className={styles.panel}>
								<img
									src={share.logo}
									alt=''
									draggable={false}
									loading='lazy'
									onError={event => {
										event.currentTarget.hidden = true
									}}
								/>
								<span className={styles.fallback} aria-hidden='true'>
									{share.name.slice(0, 1)}
								</span>
							</div>
							<h3>{share.name}</h3>
							<p className={styles.tags}>{share.tags.join(' · ')}</p>
							<p className={styles.description}>{share.description}</p>
						</a>
					))}
				</div>
			</div>
		</section>
	)
}
