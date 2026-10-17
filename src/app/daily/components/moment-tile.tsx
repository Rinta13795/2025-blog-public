'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import dayjs from 'dayjs'
import { MapPin, Pencil, Play, Trash2 } from 'lucide-react'
import type { Moment } from '../page'

interface Props {
	moment: Moment
	index: number
	isEditMode?: boolean
	onOpen: () => void
	onEdit?: () => void
	onDelete?: () => void
}

export function formatDuration(seconds: number) {
	const s = Math.round(seconds)
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function Meta({ moment }: { moment: Moment }) {
	return (
		<div className='text-secondary flex items-center gap-2 text-xs max-sm:text-[11px]'>
			<span className='font-averia'>{dayjs(moment.date).format('MM.DD')}</span>
			{moment.location && (
				<span className='flex items-center gap-0.5'>
					<MapPin className='size-3' />
					{moment.location}
				</span>
			)}
		</div>
	)
}

function EditActions({ onEdit, onDelete }: Pick<Props, 'onEdit' | 'onDelete'>) {
	const stop = (fn?: () => void) => (e: React.MouseEvent) => {
		e.stopPropagation()
		fn?.()
	}
	return (
		<div className='absolute top-3 right-3 z-10 flex gap-1.5'>
			<span role='button' aria-label='编辑' onClick={stop(onEdit)} className='flex size-8 items-center justify-center rounded-full bg-white/80 text-gray-600 shadow-sm backdrop-blur-md hover:text-gray-900'>
				<Pencil className='size-3.5' />
			</span>
			<span role='button' aria-label='删除' onClick={stop(onDelete)} className='flex size-8 items-center justify-center rounded-full bg-white/80 text-red-400 shadow-sm backdrop-blur-md hover:text-red-600'>
				<Trash2 className='size-3.5' />
			</span>
		</div>
	)
}

export function MomentTile({ moment, index, isEditMode, onOpen, onEdit, onDelete }: Props) {
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
	}, [moment.src])

	const frame =
		'relative block w-full overflow-hidden rounded-[28px] border-[3px] border-white/80 shadow-[0_24px_40px_-28px_rgba(51,79,82,0.45)] transition-[box-shadow,transform] duration-500 ease-out group-hover:-translate-y-1 group-hover:shadow-[0_32px_48px_-28px_rgba(51,79,82,0.6)] max-sm:rounded-[20px] max-sm:border-2'
	const onClick = isEditMode ? onEdit : onOpen

	return (
		<motion.figure
			initial={{ opacity: 0, y: 28 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: '-40px' }}
			transition={{ duration: 0.6, delay: (index % 3) * 0.07, ease: [0.22, 1, 0.36, 1] }}
			className='group mb-5 break-inside-avoid max-sm:mb-3'>
			{moment.type === 'note' ? (
				<button onClick={onClick} className={`${frame} cursor-pointer bg-white/65 p-6 text-left backdrop-blur-sm max-sm:p-4`}>
					{isEditMode && <EditActions onEdit={onEdit} onDelete={onDelete} />}
					<div className='text-brand/70 font-averia flex items-center gap-2 text-xs tracking-[0.2em] uppercase'>
						<span>Diary</span>
						{moment.mood && !isEditMode && <span className='text-base tracking-normal'>{moment.mood}</span>}
					</div>
					{moment.title && <h3 className='text-primary mt-3 text-lg leading-snug font-medium max-sm:text-base'>{moment.title}</h3>}
					{moment.caption && (
						<p className='text-primary/85 mt-3 line-clamp-[9] text-sm leading-7 whitespace-pre-line max-sm:text-xs max-sm:leading-6'>{moment.caption}</p>
					)}
					<div className='mt-4 border-t border-dashed border-gray-300/60 pt-3'>
						<Meta moment={moment} />
					</div>
				</button>
			) : (
				<>
					<button
						onClick={onClick}
						aria-label={moment.caption ?? '查看'}
						className={`${frame} bg-white/40 ${isEditMode ? 'cursor-pointer' : 'cursor-zoom-in'}`}
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
						{isEditMode ? (
							<EditActions onEdit={onEdit} onDelete={onDelete} />
						) : (
							moment.mood && (
								<span className='absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-white/60 text-base backdrop-blur-md max-sm:size-7 max-sm:text-sm'>
									{moment.mood}
								</span>
							)
						)}
					</button>

					<figcaption className='px-2 pt-3 max-sm:px-1 max-sm:pt-2'>
						{moment.caption && <p className='text-primary/90 mb-1.5 text-sm leading-relaxed max-sm:text-xs'>{moment.caption}</p>}
						<Meta moment={moment} />
					</figcaption>
				</>
			)}
		</motion.figure>
	)
}
