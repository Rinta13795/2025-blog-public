#!/usr/bin/env node
// 往「生活日常」添加一张照片或一段视频：压缩 → 放进 public/daily → 写入 src/app/daily/list.json
//
// 用法：
//   pnpm daily <文件> ["一句话描述"] [--location 地点] [--mood 🌼] [--date 2026-10-17]
//
// 依赖（macOS）：照片用 sips + cwebp，视频用 ffmpeg / ffprobe（brew install ffmpeg webp）

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..')
const OUT_DIR = path.join(ROOT, 'public', 'daily')
const LIST = path.join(ROOT, 'src', 'app', 'daily', 'list.json')

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp']
const VIDEO_EXT = ['.mp4', '.mov', '.m4v', '.webm']

const args = process.argv.slice(2)
const flags = {}
const positional = []
for (let i = 0; i < args.length; i++) {
	if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[++i]
	else positional.push(args[i])
}
const [input, caption] = positional

if (!input || !existsSync(input)) {
	console.error('用法: pnpm daily <文件> ["描述"] [--location 地点] [--mood 🌼] [--date YYYY-MM-DD]')
	process.exit(1)
}

const run = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { encoding: 'utf8' }).trim()
const has = cmd => {
	try {
		run('which', [cmd])
		return true
	} catch {
		return false
	}
}

// 拍摄时间：优先读 Spotlight 的内容创建时间（照片/视频的 EXIF），否则用今天
function captureDate() {
	if (flags.date) return flags.date
	try {
		const raw = run('mdls', ['-raw', '-name', 'kMDItemContentCreationDate', input])
		const d = new Date(raw)
		if (!isNaN(d)) return d.toISOString().slice(0, 10)
	} catch {}
	return new Date().toISOString().slice(0, 10)
}

const ext = path.extname(input).toLowerCase()
const hash = createHash('sha256').update(readFileSync(input)).digest('hex').slice(0, 16)
const tmp = path.join(tmpdir(), `daily-${hash}`)
mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(tmp, { recursive: true })

let entry
try {
	if (IMAGE_EXT.includes(ext)) {
		// 转 JPEG，长边超过 2000px 才缩小，再压成 webp
		const jpg = path.join(tmp, 'img.jpg')
		const size = file => ['pixelWidth', 'pixelHeight'].map(key => Number(run('sips', ['-g', key, file]).split(':').pop()))
		const resize = Math.max(...size(input)) > 2000 ? ['-Z', '2000'] : []
		run('sips', ['-s', 'format', 'jpeg', ...resize, input, '--out', jpg])
		const [width, height] = size(jpg)

		let filename = `${hash}.jpg`
		if (has('cwebp')) {
			filename = `${hash}.webp`
			run('cwebp', ['-quiet', '-q', '82', jpg, '-o', path.join(OUT_DIR, filename)])
		} else {
			copyFileSync(jpg, path.join(OUT_DIR, filename))
		}
		entry = { type: 'image', src: `/daily/${filename}`, width, height }
	} else if (VIDEO_EXT.includes(ext)) {
		if (!has('ffmpeg')) throw new Error('需要 ffmpeg：brew install ffmpeg')
		// 长边不超过 1280，H.264 + AAC，faststart 让网页边下边播
		const filename = `${hash}.mp4`
		const out = path.join(OUT_DIR, filename)
		run('ffmpeg', [
			'-loglevel', 'error', '-y', '-i', input,
			'-vf', "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))',format=yuv420p",
			'-c:v', 'libx264', '-crf', '26', '-preset', 'slow',
			'-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out
		])
		const [width, height] = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', out])
			.split(',')
			.map(Number)

		const png = path.join(tmp, 'poster.png')
		run('ffmpeg', ['-loglevel', 'error', '-y', '-ss', '0.3', '-i', out, '-frames:v', '1', png])
		let poster = `${hash}.jpg`
		if (has('cwebp')) {
			poster = `${hash}.webp`
			run('cwebp', ['-quiet', '-q', '80', png, '-o', path.join(OUT_DIR, poster)])
		} else {
			run('sips', ['-s', 'format', 'jpeg', png, '--out', path.join(OUT_DIR, poster)])
		}

		const mb = statSync(out).size / 1024 / 1024
		if (mb > 15) console.warn(`⚠️  视频压缩后仍有 ${mb.toFixed(1)}MB，建议剪短一点再传（仓库会越来越大）`)
		entry = { type: 'video', src: `/daily/${filename}`, poster: `/daily/${poster}`, width, height }
	} else {
		throw new Error(`不支持的格式 ${ext}`)
	}
} finally {
	rmSync(tmp, { recursive: true, force: true })
}

const list = JSON.parse(readFileSync(LIST, 'utf8'))
const item = {
	id: `${Date.now()}-${hash.slice(0, 6)}`,
	date: captureDate(),
	...entry,
	...(caption && { caption }),
	...(flags.location && { location: flags.location }),
	...(flags.mood && { mood: flags.mood })
}
list.unshift(item)
writeFileSync(LIST, JSON.stringify(list, null, '\t') + '\n')

console.log(`✓ 已添加 ${item.type === 'video' ? '视频' : '照片'} ${item.src}（${item.date}）`)
