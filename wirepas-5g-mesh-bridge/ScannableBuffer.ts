export class ScannableBuffer {
	public readonly buffer: Buffer
	private index = 0

	constructor(buffer: Buffer) {
		this.buffer = buffer
	}

	getChar(): number | undefined {
		return this.buffer[this.index]
	}

	getCharNext(): number {
		const next = this.buffer[this.index++]
		if (next === undefined) throw new Error(`Out of bounds!`)
		return next
	}

	next(): void {
		this.index++
	}
}
