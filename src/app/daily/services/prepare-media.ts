'use client'

export const MAX_VIDEO_MB = 15
const MAX_IMAGE_EDGE = 2000
const MAX_POSTER_EDGE = 1280

export type PreparedMedia = {
	type: 'image' | 'video'
	file: File
	poster?: File
	width: number
	height: number
	previewUrl: string
	posterUrl?: string
}

const EXT_BY_TYPE: Record<string, string> = {
	'image/webp': '.webp',
	'image/jpeg': '.jpg',
	'image/png': '.png',
	'video/mp4': '.mp4',
	'video/quicktime': '.mov',
	'video/webm': '.webm'
}

export function extOf(file: File) {
	return EXT_BY_TYPE[file.type] ?? (file.name.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() || '')
}

function scaleToFit(width: number, height: number, maxEdge: number) {
	const scale = Math.min(1, maxEdge / Math.max(width, height))
	return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

// Safari 的 canvas 不支持导出 webp，会悄悄退回 png，这时改用 jpeg
async function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
	const toBlob = (type: string, quality: number) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality))
	let blob = await toBlob('image/webp', 0.82)
	if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.85)
	if (!blob) throw new Error('图片导出失败')
	return new File([blob], `${name}${EXT_BY_TYPE[blob.type]}`, { type: blob.type })
}

function drawToCanvas(source: CanvasImageSource, width: number, height: number) {
	const canvas = document.createElement('canvas')
	canvas.width = width
	canvas.height = height
	canvas.getContext('2d')!.drawImage(source, 0, 0, width, height)
	return canvas
}

function loadImage(url: string) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image()
		img.onload = () => resolve(img)
		img.onerror = () => reject(new Error('浏览器无法读取这张图片（HEIC 请先转成 JPG）'))
		img.src = url
	})
}

async function prepareImage(file: File): Promise<PreparedMedia> {
	const sourceUrl = URL.createObjectURL(file)
	try {
		const img = await loadImage(sourceUrl)
		const size = scaleToFit(img.naturalWidth, img.naturalHeight, MAX_IMAGE_EDGE)
		const compressed = await canvasToFile(drawToCanvas(img, size.width, size.height), 'image')
		// 压缩后反而更大（比如本来就是小 webp/jpg）就用原图
		const keepOriginal = compressed.size >= file.size && ['image/webp', 'image/jpeg', 'image/png'].includes(file.type)
		const out = keepOriginal ? file : compressed
		const { width, height } = keepOriginal ? { width: img.naturalWidth, height: img.naturalHeight } : size
		return { type: 'image', file: out, width, height, previewUrl: URL.createObjectURL(out) }
	} finally {
		URL.revokeObjectURL(sourceUrl)
	}
}

async function prepareVideo(file: File): Promise<PreparedMedia> {
	if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
		throw new Error(`视频超过 ${MAX_VIDEO_MB}MB，请先剪短，或在电脑上用 pnpm daily 压缩后再传`)
	}

	const previewUrl = URL.createObjectURL(file)
	const video = document.createElement('video')
	video.muted = true
	video.playsInline = true
	video.preload = 'auto'
	video.src = previewUrl

	await new Promise<void>((resolve, reject) => {
		video.onloadeddata = () => resolve()
		video.onerror = () => reject(new Error('浏览器无法播放这个视频格式，建议用 mp4'))
	})
	await new Promise<void>(resolve => {
		video.onseeked = () => resolve()
		video.currentTime = Math.min(0.3, video.duration / 2 || 0)
	})

	const { videoWidth, videoHeight } = video
	const size = scaleToFit(videoWidth, videoHeight, MAX_POSTER_EDGE)
	const poster = await canvasToFile(drawToCanvas(video, size.width, size.height), 'poster')

	return {
		type: 'video',
		file,
		poster,
		width: videoWidth,
		height: videoHeight,
		previewUrl,
		posterUrl: URL.createObjectURL(poster)
	}
}

export function prepareMedia(file: File) {
	if (file.type.startsWith('video/')) return prepareVideo(file)
	if (file.type.startsWith('image/')) return prepareImage(file)
	throw new Error('请选择图片或视频文件')
}

export function revokeMedia(media: PreparedMedia) {
	URL.revokeObjectURL(media.previewUrl)
	if (media.posterUrl) URL.revokeObjectURL(media.posterUrl)
}
