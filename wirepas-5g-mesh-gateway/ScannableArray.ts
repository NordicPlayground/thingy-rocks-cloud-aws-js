export class ScannableArray {
	public readonly array: RelativeIndexable<number>
	private index = 0

	constructor(array: RelativeIndexable<number>) {
		this.array = array
	}

	getChar(): number | undefined {
		return this.array.at(this.index)
	}

	getCharNext(): number {
		const next = this.array.at(this.index++)
		if (next === undefined) throw new Error(`Out of bounds!`)
		return next
	}

	next(): void {
		this.index++
	}
}
