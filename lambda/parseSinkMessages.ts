const buffer: string[] = []

export const handler = async ({
	timestamp,
	message,
}: {
	message: string // base64 encoded payload "VEVTVDQ=",
	timestamp: string // e.g. "2023-10-19T15:19:35.5Z"
}): Promise<void> => {
	const decoded = Buffer.from(message, 'base64').toString('utf-8')
	console.log(
		JSON.stringify({
			timestamp,
			message: decoded,
		}),
	)
	buffer.push(decoded)
}
