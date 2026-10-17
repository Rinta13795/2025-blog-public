'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import dayjs from 'dayjs'
import { MapPin, Play } from 'lucide-react'
import type { Moment } from '../page'

interface Props {
	moment: Moment
	index: number
	onOpen: () => void
}

export function formatDuration(seconds: number) {
	const s = Math.round(seconds)
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function MomentTile({ moment, index, onOpen }: Props) {
	const videoRef = useRef<HTMLVideoElement>(null)
	const [duration, setDuration] = useState<number | null>(null)
	const isVideo = moment.type === 'video'
	const ratio = moment.width && moment.height ? moment.width / moment.height : undefined

	// 视频进入视口时静音循环播放，像 Live Photo 一样；离开时暂停省电
	useEffect(() => {
		const video = videoRef.current
		if (!video) return
		// SSR 下元数据可能在水合前就加载完了，onLoadedMetadata 会错过
		if (video.readyState >= 1) setDuration(video.duration)
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) video.play().catch(() => {})
				else video.pause()
			},
			{ threshold: 0.5 }
		)
		observer.observe(video)
		return () => observer.disconnect()
	}, [])

	return (
		<motion.figure
			initial={{ opacity: 0, y: 28 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: '-40px' }}
			transition={{ duration: 0.6, delay: (index % 3) * 0.07, ease: [0.22, 1, 0.36, 1] }}
			className='group mb-5 break-inside-avoid max-sm:mb-3'>
			<button
				onClick={onOpen}
				aria-label={moment.caption ?? '查看'}
				className='relative block w-full cursor-zoom-in overflow-hidden rounded-[28px] border-[3px] border-white/80 bg-white/40 shadow-[0_24px_40px_-28px_rgba(51,79,82,0.45)] transition-[box-shadow,transform] duration-500 ease-out group-hover:-translate-y-1 group-hover:shadow-[0_32px_48px_-28px_rgba(51,79,82,0.6)] max-sm:rounded-[20px] max-sm:border-2'
				style={{ aspectRatio: ratio }}>
				{isVideo ? (
					<video
						ref={videoRef}
						src={moment.src}
						poster={moment.poster}
						muted
						loop
						playsInline
						preload='metadata'
						onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
						className='h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]'
					/>
				) : (
					<img
						src={moment.src}
						alt={moment.caption ?? ''}
						loading='lazy'
						decoding='async'
						className='h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]'
					/>
				)}

				{isVideo && (
					<span className='absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md'>
						<Play className='size-3 fill-current' />
						{duration ? formatDuration(duration) : 'Live'}
					</span>
				)}
				{moment.mood && (
					<span className='absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-white/60 text-base backdrop-blur-md max-sm:size-7 max-sm:text-sm'>
						{moment.mood}
					</span>
				)}
			</button>

			<figcaption className='px-2 pt-3 max-sm:px-1 max-sm:pt-2'>
				{moment.caption && <p className='text-primary/90 text-sm leading-relaxed max-sm:text-xs'>{moment.caption}</p>}
				<div className='text-secondary mt-1.5 flex items-center gap-2 text-xs max-sm:text-[11px]'>
					<span className='font-averia'>{dayjs(moment.date).format('MM.DD')}</span>
					{moment.location && (
						<span className='flex items-center gap-0.5'>
							<MapPin className='size-3' />
							{moment.location}
						</span>
					)}
				</div>
			</figcaption>
		</motion.figure>
	)
}
