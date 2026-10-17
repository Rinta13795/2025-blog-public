'use client'

import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import dayjs from 'dayjs'
import { cn } from '@/lib/utils'
import list from './list.json'
import { MomentTile } from './components/moment-tile'
import { Lightbox } from './components/lightbox'

export interface Moment {
	id: string
	date: string
	type: 'image' | 'video'
	src: string
	poster?: string
	width?: number
	height?: number
	caption?: string
	location?: string
	mood?: string
}

type Filter = 'all' | Moment['type']

const filters: { key: Filter; label: string }[] = [
	{ key: 'all', label: '全部' },
	{ key: 'image', label: '照片' },
	{ key: 'video', label: '视频' }
]

const ease = [0.22, 1, 0.36, 1] as const

export default function Page() {
	const [filter, setFilter] = useState<Filter>('all')
	const [openIndex, setOpenIndex] = useState<number | null>(null)

	const moments = useMemo(() => [...(list as Moment[])].sort((a, b) => b.date.localeCompare(a.date)), [])
	const visible = useMemo(() => (filter === 'all' ? moments : moments.filter(m => m.type === filter)), [moments, filter])

	const groups = useMemo(() => {
		const map = new Map<string, Moment[]>()
		for (const m of visible) {
			const key = dayjs(m.date).format('YYYY-MM')
			map.set(key, [...(map.get(key) ?? []), m])
		}
		return [...map.entries()]
	}, [visible])

	const photoCount = moments.filter(m => m.type === 'image').length
	const videoCount = moments.length - photoCount
	const since = moments.length ? dayjs(moments[moments.length - 1].date).format('YYYY.MM') : null

	return (
		<div className='mx-auto w-full max-w-[1200px] px-6 pt-32 pb-28 max-sm:px-4 max-sm:pt-28'>
			<header className='flex items-end justify-between gap-6 max-md:flex-col max-md:items-start'>
				<motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
					<p className='text-secondary text-xs font-medium tracking-[0.32em] uppercase'>Everyday · 日常</p>
					<h1 className='font-averia mt-3 text-5xl leading-tight max-sm:text-4xl'>
						Little things <span className='text-linear'>I love</span>
					</h1>
					<p className='text-secondary mt-3 max-w-md text-sm leading-relaxed'>喜欢的光、路上的风，和那些不值一提却让人开心的小事。</p>
					<div className='text-secondary mt-5 flex flex-wrap items-center gap-2 text-xs'>
						<span className='bg-card rounded-full border px-3 py-1.5 backdrop-blur-sm'>{photoCount} 张照片</span>
						<span className='bg-card rounded-full border px-3 py-1.5 backdrop-blur-sm'>{videoCount} 段视频</span>
						{since && <span className='font-averia px-1'>since {since}</span>}
					</div>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.1, ease }}
					className='bg-card relative flex rounded-full border p-1 backdrop-blur-sm'>
					{filters.map(f => (
						<button
							key={f.key}
							onClick={() => setFilter(f.key)}
							className={cn('relative rounded-full px-5 py-2 text-sm transition-colors', filter === f.key ? 'text-primary font-medium' : 'text-secondary hover:text-primary')}>
							{filter === f.key && (
								<motion.span
									layoutId='daily-filter'
									className='absolute inset-0 rounded-full bg-white shadow-[0_6px_16px_-8px_rgba(51,79,82,0.35)]'
									transition={{ type: 'spring', stiffness: 400, damping: 32 }}
								/>
							)}
							<span className='relative'>{f.label}</span>
						</button>
					))}
				</motion.div>
			</header>

			{groups.map(([month, items]) => (
				<section key={`${filter}-${month}`} className='mt-14 max-sm:mt-10'>
					<div className='mb-6 flex items-baseline gap-3 max-sm:mb-4'>
						<span className='font-averia text-4xl leading-none'>{dayjs(month).format('MM')}</span>
						<span className='text-secondary text-sm'>月 · {dayjs(month).format('YYYY')}</span>
						<span className='h-px flex-1 self-center bg-gradient-to-r from-white to-transparent' />
						<span className='text-secondary font-averia text-xs'>{items.length} moments</span>
					</div>

					<div className='columns-3 gap-5 max-lg:columns-2 max-sm:gap-3'>
						{items.map((m, i) => (
							<MomentTile key={m.id} moment={m} index={i} onOpen={() => setOpenIndex(visible.indexOf(m))} />
						))}
					</div>
				</section>
			))}

			{visible.length === 0 && (
				<div className='text-secondary mt-24 text-center text-sm'>这里还空着，去拍点喜欢的东西吧。</div>
			)}

			<Lightbox moments={visible} index={openIndex} onChange={setOpenIndex} />
		</div>
	)
}
