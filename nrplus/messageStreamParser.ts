/*
PCC: Physical Control Channel
PDC: Physical Data Channel
MCS: Modulation and Coding Scheme
SDU: Service Data Unit

PCC comes before each PDC.
PDC contains the actual MAC PDU/SDU. 
The content of the PDUs in here are just fMAC specific. 
*/

type PDCInfo = {
	time: string //e.g. '358881336898'
	snr: string //e.g. '88'
	RSSI: string //e.g. '-60'
	len: string //e.g. '83'
	type: string //e.g. 'Data SDU'
	expectedRXRSSI: string //e.g. '-60'
	seqNbr: string //e.g. '366'
	networkId: string //e.g. '22'
	transmitterId: string //e.g. '40'
	receiverId: string //e.g. '38'
	sduLastSeenSeqNbr: string //e.g. '1'
	sduDataLength: string //e.g. '40'
	sduData: string //e.g. '{\\"data\\":\\"Yes, hello\\",\\"modem_temp\\":\\"33\\"}'
	ieType: string //e.g. 'none'
}

type MessageListener = (deviceId: string, message: PDCInfo) => void

const StreamParser = () => {
	let index = 0
	let lastResult = 0
	const lines: string[] = []

	const readLines = (regExps: RegExp[]): Record<string, unknown> | null => {
		const result: RegExpExecArray['groups'][] = []
		for (const regExp of regExps) {
			const match = regExp.exec(lines[index] ?? '')
			if (match === null) {
				//console.warn(`Not matched`, lines[index], index, regExp)
				return null
			}
			result.push(match.groups)
			index++
		}
		return result.reduce(
			(obj, groups) => ({ ...obj, ...groups }),
			{} as Record<string, unknown>,
		)
	}

	const parseLines = () => {
		let result: unknown | null = null
		while (index++ < lines.length - 1) {
			const pdcData = readLines([
				/^PDC received \(time (?<time>[0-9]+)\): snr (?<snr>[0-9]+), RSSI (?<RSSI>[-0-9]+), len (?<len>[0-9]+)/,
				/^Received data:/,
				/^ +Type: +(?<type>.+)/,
				/^ +Power control:/,
				/^ +Expected RX RSSI level \(dBm\): +(?<expectedRXRSSI>[-0-9]+)/,
				/^ +Seq nbr: +(?<seqNbr>[0-9]+)/,
				/^ +Network ID: +(?<networkId>[0-9]+)/,
				/^ +Transmitter long ID: +(?<transmitterId>[0-9]+)/,
				/^ +Receiver long ID: +(?<receiverId>[0-9]+)/,
				/^ +SDU last seen seq nbr: +(?<sduLastSeenSeqNbr>[0-9]+)/,
				/^ +SDU data length: +(?<sduDataLength>[0-9]+)/,
				/^ +SDU data: +(?<sduData>.+)/,
				/^ +IE type: +(?<ieType>.+)/,
			])
			if (pdcData !== null) {
				lastResult = index
				result = pdcData
			}
		}
		index = lastResult
		return result
	}

	return {
		add: (data: string) => {
			lines.push(data)
			return parseLines()
		},
	}
}

export const parser = (): {
	addLine: (device: string, line: string) => void
	onMessage: (fn: MessageListener) => void
} => {
	const parser: Record<string, ReturnType<typeof StreamParser>> = {}
	const listeners: MessageListener[] = []
	return {
		addLine: (device, line) => {
			if (parser[device] === undefined) {
				parser[device] = StreamParser()
			}
			const maybeResult = parser[device]?.add(line)
			if (maybeResult !== null) {
				listeners.map((fn) => fn(device, maybeResult as PDCInfo))
			}
		},
		onMessage: (fn) => {
			listeners.push(fn)
		},
	}
}
