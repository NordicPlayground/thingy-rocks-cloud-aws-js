export class ScannableArray {
	public readonly array: RelativeIndexable<number>
	private index = 0

	constructor(array: RelativeIndexable<number>) {
		this.array = array
	}

	/**
	 * Returns the current character and advances the pointer.
	 */
	getChar(): number {
		const current = this.peek()
		this.next()
		return current
	}

	/**
	 * Returns the current character without advancing the pointer.
	 */
	peek(): number {
		const current = this.array.at(this.index)
		if (current === undefined) throw new Error(`Out of bounds!`)
		return current
	}

	/**
	 * Advance the counter
	 */
	next(): void {
		this.index++
	}

	hasNext(): boolean {
		return this.array.at(this.index + 1) !== undefined
	}
}
