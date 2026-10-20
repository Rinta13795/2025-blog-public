'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/hooks/use-auth'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import initialList from './list.json'
import { MomentTile } from './components/moment-tile'
import { Lightbox } from './components/lightbox'
import MomentDialog from './components/moment-dialog'
import { pushDaily } from './services/push-daily'
import { revokeMedia, type PreparedMedia } from './services/prepare-media'

export interface Moment {
	id: string
	date: string
	type: 'image' | 'video' | 'note'
	src?: string
	poster?: string
	width?: number
	height?: number
	title?: string
	caption?: string
	location?: string
	mood?: string
}

type Filter = 'all' | Moment['type']

const filters: { key: Filter; label: string }[] = [
	{ key: 'all', label: '全部' },
	{ key: 'image', label: '照片' },
	{ key: 'video', label: '视频' },
	{ key: 'note', label: '日记' }
]

const ease = [0.22, 1, 0.36, 1] as const

const sortMoments = (list: Moment[]) => [...list].sort((a, b) => b.date.localeCompare(a.date))

export default function Page() {
	const [moments, setMoments] = useState<Moment[]>(() => sortMoments(initialList as Moment[]))
	const [originalMoments, setOriginalMoments] = useState<Moment[]>(moments)
	const [pending, setPending] = useState<Map<string, PreparedMedia>>(new Map())
	const [filter, setFilter] = useState<Filter>('all')
	const [openIndex, setOpenIndex] = useState<number | null>(null)
	const [isEditMode, setIsEditMode] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [dialog, setDialog] = useState<{ moment?: Moment } | null>(null)
	// 刚发布的文件要等重新部署后才有，在那之前继续用本地预览显示
	const [localUrls, setLocalUrls] = useState<Record<string, string>>({})
	const keyInputRef = useRef<HTMLInputElement>(null)

	const { isAuth, setPrivateKey } = useAuthStore()
	const { siteContent } = useConfigStore()
	const hideEditButton = siteContent.hideEditButton ?? false

	const displayed = useMemo(() => {
		const resolve = (url?: string) => (url && localUrls[url]) || url
		return moments.map(m => (localUrls[m.src ?? ''] ? { ...m, src: resolve(m.src), poster: resolve(m.poster) } : m))
	}, [moments, localUrls])
	const visible = useMemo(() => (filter === 'all' ? displayed : displayed.filter(m => m.type === filter)), [displayed, filter])

	const groups = useMemo(() => {
		const map = new Map<string, Moment[]>()
		for (const m of visible) {
			const key = dayjs(m.date).format('YYYY-MM')
			map.set(key, [...(map.get(key) ?? []), m])
		}
		return [...map.entries()]
	}, [visible])

	const count = (type: Moment['type']) => moments.filter(m => m.type === type).length
	const since = moments.length ? dayjs(moments[moments.length - 1].date).format('YYYY.MM') : null

	const dropPending = (id: string) =>
		setPending(prev => {
			const media = prev.get(id)
			if (!media) return prev
			revokeMedia(media)
			const next = new Map(prev)
			next.delete(id)
			return next
		})

	const handleDialogSubmit = (moment: Moment, media: PreparedMedia | null) => {
		if (media) {
			dropPending(moment.id)
			setPending(prev => new Map(prev).set(moment.id, media))
		} else if (moment.type === 'note') {
			dropPending(moment.id)
		}
		setMoments(prev => sortMoments([...prev.filter(m => m.id !== moment.id), moment]))
		setDialog(null)
	}

	const handleDelete = (moment: Moment) => {
		if (!confirm('确定删除这一条吗？')) return
		dropPending(moment.id)
		setMoments(prev => prev.filter(m => m.id !== moment.id))
	}

	const handleSave = async () => {
		setIsSaving(true)
		try {
			const saved = await pushDaily({ moments, pending })
			const nextLocal = { ...localUrls }
			for (const m of saved) {
				const media = pending.get(m.id)
				if (!media) continue
				nextLocal[m.src!] = media.previewUrl
				if (m.poster && media.posterUrl) nextLocal[m.poster] = media.posterUrl
			}
			setLocalUrls(nextLocal)
			setPending(new Map())
			setMoments(saved)
			setOriginalMoments(saved)
			setIsEditMode(false)
		} catch (error: any) {
			console.error('Failed to save daily:', error)
			toast.error(`保存失败: ${error?.message || '未知错误'}`)
		} finally {
			setIsSaving(false)
		}
	}

	const handleChoosePrivateKey = async (file: File) => {
		try {
			setPrivateKey(await file.text())
			await handleSave()
		} catch (error) {
			console.error('Failed to read private key:', error)
			toast.error('读取密钥文件失败')
		}
	}

	const handleCancel = () => {
		pending.forEach(revokeMedia)
		setPending(new Map())
		setMoments(originalMoments)
		setIsEditMode(false)
	}

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!isEditMode && (e.ctrlKey || e.metaKey) && e.key === ',') {
				e.preventDefault()
				setIsEditMode(true)
			}
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [isEditMode])

	const pill = 'rounded-xl border bg-white/60 px-5 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white/80'

	return (
		<div className='mx-auto w-full max-w-[1200px] px-6 pt-32 pb-28 max-sm:px-4 max-sm:pt-28'>
			<input
				ref={keyInputRef}
				type='file'
				accept='.pem'
				className='hidden'
				onChange={async e => {
					const f = e.target.files?.[0]
					if (f) await handleChoosePrivateKey(f)
					if (e.currentTarget) e.currentTarget.value = ''
				}}
			/>

			<header className='flex items-end justify-between gap-6 max-md:flex-col max-md:items-start'>
				<motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
					<p className='text-secondary text-xs font-medium tracking-[0.32em] uppercase'>Everyday · 日常</p>
					<h1 className='font-averia mt-3 text-5xl leading-tight max-sm:text-4xl'>
						Little things <span className='text-linear'>I love</span>
					</h1>
					<p className='text-secondary mt-3 max-w-md text-sm leading-relaxed'>喜欢的光、路上的风，和那些不值一提却让人开心的小事。</p>
					<div className='text-secondary mt-5 flex flex-wrap items-center gap-2 text-xs'>
						<span className='bg-card rounded-full border px-3 py-1.5 backdrop-blur-sm'>{count('image')} 张照片</span>
						<span className='bg-card rounded-full border px-3 py-1.5 backdrop-blur-sm'>{count('video')} 段视频</span>
						{count('note') > 0 && <span className='bg-card rounded-full border px-3 py-1.5 backdrop-blur-sm'>{count('note')} 篇日记</span>}
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
							className={cn(
								'relative rounded-full px-5 py-2 text-sm transition-colors max-sm:px-4',
								filter === f.key ? 'text-primary font-medium' : 'text-secondary hover:text-primary'
							)}>
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

			{isEditMode && (
				<motion.button
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					onClick={() => setDialog({})}
					className='text-secondary hover:text-primary mt-10 flex w-full items-center justify-center gap-2 rounded-[28px] border-2 border-dashed border-white/80 bg-white/30 py-6 text-sm backdrop-blur-sm transition-colors hover:bg-white/50'>
					<Plus className='size-4' />
					记录新的一刻（照片 / 视频 / 日记）
				</motion.button>
			)}

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
							<MomentTile
								key={m.id}
								moment={m}
								index={i}
								isEditMode={isEditMode}
								onOpen={() => setOpenIndex(visible.indexOf(m))}
								onEdit={() => setDialog({ moment: moments.find(raw => raw.id === m.id) })}
								onDelete={() => handleDelete(m)}
							/>
						))}
					</div>
				</section>
			))}

			{visible.length === 0 && <div className='text-secondary mt-24 text-center text-sm'>这里还空着，去拍点喜欢的东西吧。</div>}

			<Lightbox moments={visible} index={openIndex} onChange={setOpenIndex} />

			{dialog && <MomentDialog moment={dialog.moment} onClose={() => setDialog(null)} onSubmit={handleDialogSubmit} />}

			<motion.div
				initial={{ opacity: 0, scale: 0.6 }}
				animate={{ opacity: 1, scale: 1 }}
				className={cn(
					'absolute top-4 right-6 flex gap-3',
					// 手机上放到底部，方便拍完直接传
					'max-sm:fixed max-sm:top-auto max-sm:right-auto max-sm:bottom-6 max-sm:left-4 max-sm:z-40 max-sm:gap-1.5 max-sm:rounded-2xl max-sm:border max-sm:bg-white/75 max-sm:p-1.5 max-sm:shadow-[0_12px_32px_-12px_rgba(51,79,82,0.35)] max-sm:backdrop-blur-xl'
				)}>
				{isEditMode ? (
					<>
						<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleCancel} disabled={isSaving} className={pill}>
							取消
						</motion.button>
						<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setDialog({})} className={pill}>
							新增
						</motion.button>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={() => (isAuth ? handleSave() : keyInputRef.current?.click())}
							disabled={isSaving}
							className='brand-btn px-6'>
							{isSaving ? '保存中...' : isAuth ? `保存${pending.size ? `（${pending.size}）` : ''}` : '导入密钥'}
						</motion.button>
					</>
				) : (
					!hideEditButton && (
						<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setIsEditMode(true)} className={pill}>
							编辑
						</motion.button>
					)
				)}
			</motion.div>
		</div>
	)
}
