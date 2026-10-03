import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

// Exercise the renderer itself using an instrumented Canvas/DOM surface.
// Counts describe CPU work, not real browser frame rate.
const source = await readFile(new URL('../src/app/share/components/ribbon-canvas.ts', import.meta.url), 'utf8')
const motionUrl = new URL('../src/app/share/components/reel-motion.ts', import.meta.url).href
const compiled = ts.transpileModule(source.replace("'./reel-motion'", JSON.stringify(motionUrl)), {
	compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const { createRibbonCanvas } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('steady animation bounds drawing work and avoids repeated layout/style writes', t => {
	let layoutReads = 0
	let visibilityWrites = 0
	let drawCalls = 0
	let bitmapPaints = 0
	let canvasesCreated = 0
	const loadHandlers = []
	let liveContext
	const originals = { document: globalThis.document, window: globalThis.window, getComputedStyle: globalThis.getComputedStyle }
	globalThis.window = { devicePixelRatio: 2 }
	globalThis.getComputedStyle = () => ({ backgroundColor: '#eef8fc', borderColor: '#ccc', color: '#555', fontFamily: 'sans-serif' })
	globalThis.document = {
		createElement() {
			canvasesCreated++
			const ctx = {
				scale() {},
				setTransform() {},
				beginPath() {},
				roundRect() {
					if (ctx !== liveContext) bitmapPaints++
				},
				fill() {},
				stroke() {},
				fillText() {},
				clearRect() {},
				drawImage() {
					if (ctx === liveContext) drawCalls++
				}
			}
			if (!liveContext) liveContext = ctx
			return { style: {}, setAttribute() {}, getContext: () => ctx, remove() {} }
		}
	}
	const panels = Array.from({ length: 26 }, (_, index) => {
		const image = {
			complete: true,
			naturalWidth: 118,
			naturalHeight: 118,
			hidden: false,
			addEventListener(event, handler) {
				if (event === 'load') loadHandlers[index] = handler
			},
			removeEventListener() {}
		}
		return {
			style: {
				set visibility(value) {
					visibilityWrites++
				}
			},
			get offsetWidth() {
				layoutReads++
				return 280
			},
			get offsetHeight() {
				layoutReads++
				return 180
			},
			get offsetTop() {
				layoutReads++
				return 48
			},
			parentElement: {
				get offsetLeft() {
					layoutReads++
					return 20 + index * 300
				}
			},
			querySelector: selector => (selector === 'img' ? image : { textContent: 'A' })
		}
	})
	const viewport = { clientWidth: 1280, clientHeight: 400, parentElement: { append() {} } }
	let renderer
	try {
		renderer = createRibbonCanvas(viewport, panels, () => {})
		layoutReads = 0
		renderer.draw(0, 1)
		assert.ok(drawCalls < 170, `got ${drawCalls} draw calls, expected fewer than 170`)
		assert.equal(visibilityWrites, 26)
		t.diagnostic(`1280px frame: ${drawCalls} image draws`)
		const initialCalls = drawCalls
		for (let i = 1; i <= 120; i++) renderer.draw(i * 3, 0.8)
		assert.equal(layoutReads, 0)
		assert.equal(visibilityWrites, 26, 'visibility must only change at motion transitions')
		assert.ok((drawCalls - initialCalls) / 120 < 170)
		const initialPaints = bitmapPaints
		const initialCanvases = canvasesCreated
		loadHandlers[5]()
		assert.equal(bitmapPaints - initialPaints, 1, 'one loaded logo repaints exactly one bitmap')
		assert.equal(canvasesCreated, initialCanvases, 'loading a logo reuses its bitmap')
		assert.equal(layoutReads, 0, 'logo loading must not remeasure the reel')
		renderer.draw(360, 0)
		assert.equal(visibilityWrites, 52)
		const restingCalls = drawCalls
		renderer.draw(360, 0)
		assert.equal(drawCalls, restingCalls)
		assert.equal(visibilityWrites, 52)
	} finally {
		renderer?.dispose()
		Object.assign(globalThis, originals)
	}
})
