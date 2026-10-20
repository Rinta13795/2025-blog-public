'use client'

import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import { ImagePlus, Loader2 } from 'lucide-react'
import { DialogModal } from '@/components/dialog-modal'
import { cn } from '@/lib/utils'
import type { Moment } from '../page'
import { MAX_VIDEO_MB, prepareMedia, revokeMedia, type PreparedMedia } from '../services/prepare-media'

interface Props {
	// 不传就是新建
	moment?: Moment
	onClose: () => void
	onSubmit: (moment: Moment, media: PreparedMedia | null) => void
}

const MOODS = ['☀️', '🌿', '🌸', '🌊', '🍰', '🌙', '🥹', '✨']

const inputClass = 'w-full rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-sm transition-colors focus:border-brand/50'

export default function MomentDialog({ moment, onClose, onSubmit }: Props) {
	const [kind, setKind] = useState<'media' | 'note'>(moment?.type === 'note' ? 'note' : 'media')
	const [media, setMedia] = useState<PreparedMedia | null>(null)
	const [processing, setProcessing] = useState(false)
	const [title, setTitle] = useState(moment?.title ?? '')
	const [caption, setCaption] = useState(moment?.caption ?? '')
	const [date, setDate] = useState(moment?.date ?? dayjs().format('YYYY-MM-DD'))
	const [location, setLocation] = useState(moment?.location ?? '')
	const [mood, setMood] = useState(moment?.mood ?? '')
	const fileInputRef = useRef<HTMLInputElement>(null)

	const existingMedia = moment && moment.type !== 'note' ? moment : null
	const preview = media ? { type: media.type, src: media.previewUrl } : existingMedia ? { type: existingMedia.type, src: existingMedia.src! } : null

	const handleFile = async (file?: File) => {
		if (!file) return
		setProcessing(true)
		try {
			const next = await prepareMedia(file)
			if (media) revokeMedia(media)
			setMedia(next)
			// 新建时默认用文件的修改时间当日期，通常就是拍摄日
			if (!moment) setDate(dayjs(file.lastModified).format('YYYY-MM-DD'))
		} catch (error: any) {
			toast.error(error?.message || '读取文件失败')
		} finally {
			setProcessing(false)
		}
	}

	const handleClose = () => {
		if (media) revokeMedia(media)
		onClose()
	}

	const handleSubmit = () => {
		if (kind === 'media' && !preview) return toast.error('先选一张照片或一段视频')
		if (kind === 'note' && !caption.trim()) return toast.error('日记还没写内容')

		const base: Moment = {
			id: moment?.id ?? `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
			date,
			type: 'note',
			...(kind === 'note' && title.trim() && { title: title.trim() }),
			...(caption.trim() && { caption: caption.trim() }),
			...(location.trim() && { location: location.trim() }),
			...(mood.trim() && { mood: mood.trim() })
		}

		if (kind === 'note') return onSubmit(base, null)

		const next: Moment = media
			? { ...base, type: media.type, src: media.previewUrl, poster: media.posterUrl, width: media.width, height: media.height }
			: { ...base, type: existingMedia!.type, src: existingMedia!.src, poster: existingMedia!.poster, width: existingMedia!.width, height: existingMedia!.height }
		onSubmit(next, media)
	}

	return (
		<DialogModal open onClose={handleClose} className='card max-h-[92vh] w-[460px] overflow-y-auto max-sm:w-full max-sm:rounded-[28px] max-sm:p-5'>
			<div className='space-y-4'>
				<div className='flex items-center justify-between'>
					<h2 className='text-xl font-bold'>{moment ? '编辑这一刻' : '记录一刻'}</h2>
					{!moment && (
						<div className='flex rounded-full border bg-white/50 p-0.5 text-sm'>
							{(['media', 'note'] as const).map(k => (
								<button
									key={k}
									onClick={() => setKind(k)}
									className={cn('relative rounded-full px-3.5 py-1', kind === k ? 'text-primary font-medium' : 'text-secondary')}>
									{kind === k && <motion.span layoutId='moment-kind' className='absolute inset-0 rounded-full bg-white shadow-sm' />}
									<span className='relative'>{k === 'media' ? '照片 / 视频' : '日记'}</span>
								</button>
							))}
						</div>
					)}
				</div>

				{kind === 'media' && (
					<div>
						<input
							ref={fileInputRef}
							type='file'
							accept='image/*,video/*'
							className='hidden'
							onChange={e => {
								handleFile(e.target.files?.[0])
								e.currentTarget.value = ''
							}}
						/>
						<button
							type='button'
							onClick={() => fileInputRef.current?.click()}
							disabled={processing}
							className='group relative flex h-56 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-white/50 transition-colors hover:bg-white/70 max-sm:h-48'>
							{preview ? (
								<>
									{preview.type === 'video' ? (
										<video src={preview.src} muted loop autoPlay playsInline className='h-full w-full object-cover' />
									) : (
										<img src={preview.src} alt='' className='h-full w-full object-cover' />
									)}
									<span className='absolute right-3 bottom-3 rounded-full bg-black/40 px-3 py-1 text-xs text-white backdrop-blur-md'>更换</span>
								</>
							) : (
								<div className='text-secondary text-center'>
									<ImagePlus className='mx-auto mb-2 size-8 opacity-60' />
									<p className='text-sm'>选一张照片或一段视频</p>
									<p className='mt-1 text-xs opacity-70'>照片会自动压缩 · 视频不超过 {MAX_VIDEO_MB}MB</p>
								</div>
							)}
							{processing && (
								<div className='absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm'>
									<Loader2 className='text-brand size-6 animate-spin' />
								</div>
							)}
						</button>
					</div>
				)}

				{kind === 'note' && <input value={title} onChange={e => setTitle(e.target.value)} placeholder='标题（可选）' className={inputClass} />}

				<textarea
					value={caption}
					onChange={e => setCaption(e.target.value)}
					placeholder={kind === 'note' ? '今天发生了什么…' : '一句话说说这一刻（可选）'}
					rows={kind === 'note' ? 8 : 2}
					className={cn(inputClass, 'resize-none leading-relaxed')}
				/>

				<div className='grid grid-cols-2 gap-3'>
					<label className='text-secondary text-xs'>
						日期
						<input type='date' value={date} onChange={e => e.target.value && setDate(e.target.value)} className={cn(inputClass, 'mt-1')} />
					</label>
					<label className='text-secondary text-xs'>
						地点
						<input value={location} onChange={e => setLocation(e.target.value)} placeholder='可选' className={cn(inputClass, 'mt-1')} />
					</label>
				</div>

				<div>
					<div className='text-secondary mb-1.5 text-xs'>心情</div>
					<div className='flex flex-wrap items-center gap-1.5'>
						{MOODS.map(m => (
							<button
								key={m}
								type='button'
								onClick={() => setMood(mood === m ? '' : m)}
								className={cn('flex size-9 items-center justify-center rounded-full border text-base transition-all', mood === m ? 'border-brand/60 scale-110 bg-white shadow-sm' : 'border-transparent bg-white/50 hover:bg-white')}>
								{m}
							</button>
						))}
						<input
							value={MOODS.includes(mood) ? '' : mood}
							onChange={e => setMood(e.target.value)}
							placeholder='其他'
							maxLength={4}
							className='h-9 w-16 rounded-full border border-gray-200 bg-white/60 px-3 text-center text-sm'
						/>
					</div>
				</div>

				<div className='flex gap-3 pt-2'>
					<button type='button' onClick={handleClose} className='flex-1 rounded-xl border bg-white/60 px-4 py-2 text-sm transition-colors hover:bg-white'>
						取消
					</button>
					<button type='button' onClick={handleSubmit} disabled={processing} className='brand-btn flex-1 justify-center'>
						{moment ? '保存修改' : '放进日常'}
					</button>
				</div>
			</div>
		</DialogModal>
	)
}
