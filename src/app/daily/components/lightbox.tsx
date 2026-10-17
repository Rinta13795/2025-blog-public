'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import dayjs from 'dayjs'
import { ChevronLeft, ChevronRight, MapPin, X } from 'lucide-react'
import type { Moment } from '../page'

interface Props {
	moments: Moment[]
	index: number | null
	onChange: (index: number | null) => void
}

export function Lightbox({ moments, index, onChange }: Props) {
	const moment = index !== null ? moments[index] : undefined
	const total = moments.length

	const go = (step: number) => {
		if (index === null) return
		onChange((index + step + total) % total)
	}

	useEffect(() => {
		if (index === null) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onChange(null)
			if (e.key === 'ArrowRight') go(1)
			if (e.key === 'ArrowLeft') go(-1)
		}
		const overflow = document.documentElement.style.overflow
		document.documentElement.style.overflow = 'hidden'
		window.addEventListener('keydown', onKey)
		return () => {
			document.documentElement.style.overflow = overflow
			window.removeEventListener('keydown', onKey)
		}
	}, [index, total])

	return (
		<AnimatePresence>
			{moment && (
				<motion.div
					key='lightbox'
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.25 }}
					onClick={() => onChange(null)}
					className='fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#1d2b2d]/75 px-4 backdrop-blur-xl'>
					<div className='absolute top-5 right-5 left-6 flex items-center justify-between text-white/70'>
						<span className='font-averia text-sm tracking-wider'>
							{String(index! + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
						</span>
						<button onClick={() => onChange(null)} aria-label='关闭' className='rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20 hover:text-white'>
							<X className='size-5' />
						</button>
					</div>

					<AnimatePresence mode='wait' initial={false}>
						<motion.div
							key={moment.id}
							initial={{ opacity: 0, scale: 0.96, y: 8 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.98 }}
							transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
							drag={total > 1 ? 'x' : false}
							dragConstraints={{ left: 0, right: 0 }}
							dragElastic={0.35}
							onDragEnd={(_, info) => {
								if (info.offset.x < -80) go(1)
								else if (info.offset.x > 80) go(-1)
							}}
							onClick={e => e.stopPropagation()}
							className='flex max-w-full flex-col items-center'>
							{moment.type === 'video' ? (
								<video
									src={moment.src}
									poster={moment.poster}
									controls
									autoPlay
									playsInline
									className='max-h-[74vh] max-w-[min(92vw,1100px)] rounded-[24px] bg-black/20 shadow-2xl'
								/>
							) : (
								<img
									src={moment.src}
									alt={moment.caption ?? ''}
									draggable={false}
									className='max-h-[74vh] max-w-[min(92vw,1100px)] rounded-[24px] object-contain shadow-2xl select-none'
								/>
							)}

							<div className='mt-5 max-w-xl text-center'>
								{moment.caption && (
									<p className='text-[15px] leading-relaxed text-white/90'>
										{moment.mood && <span className='mr-1.5'>{moment.mood}</span>}
										{moment.caption}
									</p>
								)}
								<div className='mt-2 flex items-center justify-center gap-3 text-xs text-white/50'>
									<span className='font-averia'>{dayjs(moment.date).format('YYYY.MM.DD')}</span>
									{moment.location && (
										<span className='flex items-center gap-1'>
											<MapPin className='size-3' />
											{moment.location}
										</span>
									)}
								</div>
							</div>
						</motion.div>
					</AnimatePresence>

					{total > 1 && (
						<>
							<button
								onClick={e => (e.stopPropagation(), go(-1))}
								aria-label='上一张'
								className='absolute top-1/2 left-5 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white/70 transition-colors hover:bg-white/20 hover:text-white max-sm:hidden'>
								<ChevronLeft className='size-5' />
							</button>
							<button
								onClick={e => (e.stopPropagation(), go(1))}
								aria-label='下一张'
								className='absolute top-1/2 right-5 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white/70 transition-colors hover:bg-white/20 hover:text-white max-sm:hidden'>
								<ChevronRight className='size-5' />
							</button>
						</>
					)}
				</motion.div>
			)}
		</AnimatePresence>
	)
}
