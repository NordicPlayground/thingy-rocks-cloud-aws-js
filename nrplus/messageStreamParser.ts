type MessageListener = (
	deviceId: string,
	message: Record<string, unknown>,
) => void

const parseMessages = (
	lines: string[],
	messageDef: Readonly<Array<RegExp>>,
): Record<string, unknown> | null => {
	const result: RegExpExecArray['groups'][] = []

	for (const line of lines) {
		const lineDef = messageDef[result.length]
		if (lineDef === undefined) {
			// No more lines to match
			break
		}
		const match = lineDef.exec(line)
		if (match !== null) {
			result.push(match.groups)
		}
	}

	// Nothing found
	if (result.length === 0) return null

	// Not all lines matched
	if (result.length !== messageDef.length) return null

	// All lines matched
	return result.reduce(
		(obj, groups) => ({ ...obj, ...groups }),
		{} as Record<string, unknown>,
	)
}

const StreamParser = (messageDefinitions: Array<Readonly<Array<RegExp>>>) => {
	let lines: string[] = []

	return {
		add: (data: string) => {
			lines.push(data)
			for (const def of messageDefinitions) {
				const res = parseMessages([...lines], def)
				if (res !== null) {
					lines = []
					return res
				}
			}
			return null
		},
	}
}

export const parser = (
	messageDefinitions: Array<Readonly<Array<RegExp>>>,
): {
	addLine: (device: string, line: string) => void
	onMessage: (fn: MessageListener) => void
} => {
	const parser: Record<string, ReturnType<typeof StreamParser>> = {}
	const listeners: MessageListener[] = []
	return {
		addLine: (device, line) => {
			if (parser[device] === undefined) {
				parser[device] = StreamParser(messageDefinitions)
			}
			const maybeResult = parser[device]?.add(line) ?? null
			if (maybeResult !== null) {
				listeners.map((fn) => fn(device, maybeResult))
			}
		},
		onMessage: (fn) => {
			listeners.push(fn)
		},
	}
}
