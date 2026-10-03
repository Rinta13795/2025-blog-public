/** Time-based easing: identical response at 30, 60 and 120 Hz. */
export function approach(current: number, target: number, elapsed: number, duration: number) {
	return current + (target - current) * (1 - Math.exp(-elapsed / duration))
}

/** A full shared wave in the viewport; scroll distance advances its phase.
 * Amplitude stays non-negative so reversing input moves the wave backwards
 * instead of flipping every crest into a trough. */
export function ribbonY(x: number, viewportWidth: number, strength: number, position: number) {
	const wavelength = Math.max(1, viewportWidth)
	const phase = ((x + position * 0.6) / wavelength - 0.25) * Math.PI * 2
	const amplitude = Math.min(40, wavelength * 0.07) * strength
	return Math.sin(phase) * amplitude
}
