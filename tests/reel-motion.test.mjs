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
test('adjacent columns share a continuous curve, without per-card phase resets', () => {
	const width = 1280
	for (let x = 0; x < width; x++) assert.ok(Math.abs(ribbonY(x + 1, width, 280, 1) - ribbonY(x, width, 280, 1)) < 0.12)
	assert.ok(ribbonY(400, width, 280, 0) === 0)
})
