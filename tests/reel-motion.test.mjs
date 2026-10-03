import { test } from 'node:test'
import assert from 'node:assert/strict'
import { approach, ribbonY } from '../src/app/share/components/reel-motion.ts'

test('easing covers the same distance regardless of display refresh rate', () => {
	const results = [30, 60, 120].map(fps => {
		let value = 0
		for (let i = 0; i < fps; i++) value = approach(value, 1000, 1000 / fps, 110)
		return value
	})
	assert.ok(Math.abs(results[0] - results[2]) < 1e-9)
	assert.ok(results[0] > 999 && results[0] < 1000)
})
test('reversing input never overshoots the new target', () => {
	let value = 700
	for (let i = 0; i < 120; i++) {
		value = approach(value, 100, 1000 / 120, 110)
		assert.ok(value >= 100 && value < 700)
	}
})
test('every viewport contains a crest and trough throughout scrolling', () => {
	for (const width of [320, 390, 768, 1280, 1920]) {
		for (let position = 0; position < width * 4; position += width / 17) {
			const values = Array.from({ length: 101 }, (_, i) => ribbonY((i / 100) * width, width, 1, position))
			const amplitude = Math.min(40, width * 0.07)
			assert.ok(Math.min(...values) < -amplitude * 0.99)
			assert.ok(Math.max(...values) > amplitude * 0.99)
		}
	}
})
test('the wave phase travels continuously with scroll distance', () => {
	const width = 1280
	const initial = ribbonY(200, width, 1, 300)
	assert.ok(Math.abs(initial - ribbonY(200, width, 1, 600)) > 10)
	assert.ok(Math.abs(ribbonY(200, width, 1, 600) - ribbonY(380, width, 1, 300)) < 1e-9)
	assert.ok(Math.abs(ribbonY(200, width, 1, 300.1) - initial) < 0.02)
})
test('adjacent columns remain continuous and the resting wave is flat', () => {
	for (const width of [320, 390, 1280]) {
		for (let x = 0; x < width; x++) assert.ok(Math.abs(ribbonY(x + 1, width, 1, 500) - ribbonY(x, width, 1, 500)) < 0.45)
		assert.ok(ribbonY(200, width, 0, 500) === 0)
	}
})
test('wider sheared strips stay within a tenth of a pixel of the wave', () => {
	for (const width of [320, 390, 768, 1280]) {
		for (const position of [0, 300, 1000]) {
			for (let x = 0; x < width; x += 8) {
				const start = ribbonY(x, width, 1, position)
				const end = ribbonY(x + 8, width, 1, position)
				for (const fraction of [0.25, 0.5, 0.75]) {
					const interpolated = start + (end - start) * fraction
					assert.ok(Math.abs(interpolated - ribbonY(x + 8 * fraction, width, 1, position)) < 0.1)
				}
			}
		}
	}
})
