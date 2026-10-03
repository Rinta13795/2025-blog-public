'use client'

import { useEffect, useRef } from 'react'
import type { Share } from './share-card'
import styles from './share-reel.module.css'
import { approach } from './reel-motion'
import { createRibbonCanvas } from './ribbon-canvas'

/** Original implementation inspired by Reel Flux's velocity-reactive ribbon.
 * Keep links in the DOM: titles stay readable and keyboard navigation stays native.
 */
export default function ShareReel({ shares }: { shares: Share[] }) {
	const viewportRef = useRef<HTMLDivElement>(null)
	const previousRef = useRef<HTMLButtonElement>(null)
	const nextRef = useRef<HTMLButtonElement>(null)
	const counterRef = useRef<HTMLSpanElement>(null)
	const moveRef = useRef<(direction: number) => void>(() => {})

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
		let destination = viewport.scrollLeft
		let writtenScroll = viewport.scrollLeft
		let ribbon: ReturnType<typeof createRibbonCanvas> | undefined
		let maximum = 0
		let viewportWidth = 0
		let centers: number[] = []
		let displayedIndex = -1
		let suppressClick = false
		let drag: { id: number; x: number; y: number; scroll: number; lastX: number; time: number; speed: number; moved: boolean } | null = null

		const measure = () => {
			viewportWidth = viewport.clientWidth
			maximum = Math.max(0, viewport.scrollWidth - viewportWidth)
			centers = links.map(link => link.offsetLeft + link.offsetWidth / 2)
		}
		measure()
		const updateControls = (position: number) => {
			const previousDisabled = position < 2
			const nextDisabled = maximum - position < 2
			if (previousRef.current && previousRef.current.disabled !== previousDisabled) previousRef.current.disabled = previousDisabled
			if (nextRef.current && nextRef.current.disabled !== nextDisabled) nextRef.current.disabled = nextDisabled
			const center = position + viewportWidth / 2
			let nearest = 0
			let distance = Infinity
			centers.forEach((itemCenter, index) => {
				const difference = Math.abs(itemCenter - center)
				if (difference < distance) {
					nearest = index
					distance = difference
				}
			})
			if (counterRef.current && displayedIndex !== nearest) {
				counterRef.current.textContent = `${nearest + 1} / ${shares.length}`
				displayedIndex = nearest
			}
		}

		const animate = (time: number) => {
			const dt = Math.min(64, lastTime ? time - lastTime : 16.67)
			lastTime = time
			destination = Math.max(0, Math.min(maximum, destination))
			const current = viewport.scrollLeft
			const next = motion.matches ? destination : approach(current, destination, dt, drag?.moved ? 32 : 110)
			viewport.scrollLeft = Math.abs(next - destination) < 0.5 ? destination : next
			writtenScroll = viewport.scrollLeft
			const position = viewport.scrollLeft
			const velocity = (position - lastScroll) / Math.max(dt, 1)
			lastScroll = position
			const target = motion.matches ? 0 : Math.min(1, Math.abs(velocity) / 2.4)
			wave = motion.matches ? 0 : approach(wave, target, dt, 160)
			ribbon?.draw(position, wave)
			updateControls(position)
			if (Math.abs(wave) > 0.002 || Math.abs(velocity) > 0.005 || Math.abs(destination - position) > 0.5) {
				frame = requestAnimationFrame(animate)
			} else {
				ribbon?.draw(position, 0)
				frame = 0
				lastTime = 0
			}
		}
		const wake = () => {
			if (!frame) frame = requestAnimationFrame(animate)
		}
		const onScroll = () => {
			// Touch, scrollbar and keyboard focus may scroll natively.
			if (Math.abs(viewport.scrollLeft - writtenScroll) > 1) destination = viewport.scrollLeft
			wake()
		}
		const onWheel = (event: WheelEvent) => {
			if (event.ctrlKey || event.shiftKey) return
			const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportWidth : 1
			const delta = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * multiplier
			if (maximum <= 0 || (delta < 0 && viewport.scrollLeft <= 0) || (delta > 0 && viewport.scrollLeft >= maximum - 1)) return
			event.preventDefault()
			destination = Math.max(0, Math.min(maximum, destination + delta))
			wake()
		}
		const onDown = (event: PointerEvent) => {
			suppressClick = false
			destination = viewport.scrollLeft
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
			destination = drag.scroll - dx
			wake()
		}
		const finish = (event: PointerEvent) => {
			if (!drag || drag.id !== event.pointerId) return
			if (event.type === 'pointerup' && drag.moved && event.timeStamp - drag.time < 100 && !motion.matches) destination += drag.speed * 220
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
		ribbon = createRibbonCanvas(viewport, panels, wake)
		moveRef.current = direction => {
			destination += direction * viewportWidth * 0.7
			wake()
		}
		const resize = new ResizeObserver(() => {
			measure()
			ribbon?.resize()
			wake()
		})
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
			ribbon?.dispose()
			moveRef.current = () => {}
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

	const move = (direction: number) => moveRef.current(direction)

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
			<div className={styles.stage}>
				<div ref={viewportRef} className={styles.viewport} aria-describedby='share-reel-hint'>
					<div className={styles.track}>
						{shares.map(share => (
							<a
								key={share.url}
								className={styles.item}
								href={share.url}
								target='_blank'
								rel='noopener noreferrer'
								aria-label={`${share.name}，在新标签页访问`}>
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
			</div>
		</section>
	)
}
