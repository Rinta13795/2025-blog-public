/** Time-based easing: identical response at 30, 60 and 120 Hz. */
export function approach(current: number, target: number, elapsed: number, duration: number) {
	return current + (target - current) * (1 - Math.exp(-elapsed / duration))
}

/** One screen-space curve shared by every column of every card. */
export function ribbonY(x: number, viewportWidth: number, cardWidth: number, strength: number) {
	const wavelength = Math.max(viewportWidth * 1.8, cardWidth * 6)
	return Math.sin(((x - viewportWidth / 2) * Math.PI * 2) / wavelength) * strength * 40
}
