import { ribbonY } from './reel-motion'

/** Warp the actual surfaces column by column, rather than moving rigid cards.
 * HTML links/titles underneath remain the interaction and accessibility layer.
 */
export function createRibbonCanvas(viewport: HTMLElement, panels: HTMLElement[], wake: () => void) {
	const canvas = document.createElement('canvas')
	canvas.setAttribute('aria-hidden', 'true')
	Object.assign(canvas.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '1' })
	const context = canvas.getContext('2d')
	if (!context) return { draw: () => {}, resize: () => {}, dispose: () => {} }
	viewport.parentElement!.append(canvas)
	const images = panels.map(panel => panel.querySelector('img')!)
	let surfaces: { panel: HTMLElement; bitmap: HTMLCanvasElement; x: number; y: number; width: number; height: number }[] = []
	let ratio = 1
	let width = 0
	let height = 0

	const rebuild = () => {
		ratio = Math.min(window.devicePixelRatio || 1, 2)
		width = viewport.clientWidth
		height = viewport.clientHeight
		canvas.width = Math.round(width * ratio)
		canvas.height = Math.round(height * ratio)
		canvas.style.width = `${width}px`
		canvas.style.height = `${height}px`
		context.setTransform(ratio, 0, 0, ratio, 0, 0)
		surfaces = panels.map((panel, index) => {
			const w = panel.offsetWidth
			const h = panel.offsetHeight
			const bitmap = document.createElement('canvas')
			bitmap.width = Math.round(w * ratio)
			bitmap.height = Math.round(h * ratio)
			const paint = bitmap.getContext('2d')!
			paint.scale(ratio, ratio)
			const style = getComputedStyle(panel)
			paint.fillStyle = style.backgroundColor
			paint.strokeStyle = style.borderColor
			paint.lineWidth = 1
			paint.beginPath()
			paint.roundRect(0.5, 0.5, w - 1, h - 1, 5)
			paint.fill()
			paint.stroke()
			const image = images[index]
			if (image.complete && image.naturalWidth > 0 && !image.hidden) {
				const scale = Math.min(118 / image.naturalWidth, 118 / image.naturalHeight)
				const iw = image.naturalWidth * scale
				const ih = image.naturalHeight * scale
				paint.drawImage(image, (w - iw) / 2, (h - ih) / 2, iw, ih)
			} else {
				paint.fillStyle = getComputedStyle(panel.querySelector('span')!).color
				paint.font = `700 38px ${style.fontFamily}`
				paint.textAlign = 'center'
				paint.textBaseline = 'middle'
				paint.fillText(panel.querySelector('span')!.textContent || '', w / 2, h / 2)
			}
			return { panel, bitmap, x: panel.parentElement!.offsetLeft, y: panel.offsetTop, width: w, height: h }
		})
		wake()
	}
	const loaded = () => {
		rebuild()
	}
	images.forEach(image => {
		image.addEventListener('load', loaded)
		image.addEventListener('error', loaded)
	})
	rebuild()
	return {
		resize: rebuild,
		draw(position: number, strength: number) {
			context.clearRect(0, 0, width, height)
			// At rest, reduced motion, or with unsupported canvas, retain native HTML.
			const moving = Math.abs(strength) > 0.006
			surfaces.forEach(surface => {
				surface.panel.style.visibility = moving ? 'hidden' : ''
				const x = surface.x - position
				if (!moving || x + surface.width < 0 || x > width) return
				const step = 2
				for (let column = Math.max(0, Math.floor(-x / step) * step); column < surface.width && x + column < width; column += step) {
					const slice = Math.min(step, surface.width - column)
					const y = ribbonY(x + column + slice / 2, width, strength, position)
					context.drawImage(surface.bitmap, column * ratio, 0, slice * ratio, surface.bitmap.height, x + column, surface.y + y, slice, surface.height)
				}
			})
		},
		dispose() {
			images.forEach(image => {
				image.removeEventListener('load', loaded)
				image.removeEventListener('error', loaded)
			})
			panels.forEach(panel => {
				panel.style.visibility = ''
			})
			canvas.remove()
			surfaces = []
		}
	}
}
