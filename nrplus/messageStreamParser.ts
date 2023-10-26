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
	time: string // e.g. '358881336898'
	snr: string // e.g. '88'
	RSSI: string // e.g. '-60'
	len: string // e.g. '83'
	type: string // e.g. 'Data SDU'
	expectedRXRSSI: string // e.g. '-60'
	seqNbr: string // e.g. '366'
	networkId: string // e.g. '22'
	transmitterId: string // e.g. '40'
	receiverId: string // e.g. '38'
	sduLastSeenSeqNbr: string // e.g. '1'
	sduDataLength: string // e.g. '40'
	sduData: string // e.g. '{"data":"Yes, hello","modem_temp":"33"}'
	ieType: string // e.g. 'none'
}

const PDCLines = [
	/^PDC received \(time (?<time>[0-9]+)\): snr (?<snr>[0-9]+), RSSI (?<RSSI>[-0-9]+), len (?<len>[0-9]+)/,
	/^Received data:/,
	/^\s+Type:\s+(?<type>.+)/,
	/^\s+Power control:/,
	/^\s+Expected RX RSSI level \(dBm\):\s+(?<expectedRXRSSI>[-0-9]+)/,
	/^\s+Seq nbr:\s+(?<seqNbr>[0-9]+)/,
	/^\s+Network ID:\s+(?<networkId>[0-9]+)/,
	/^\s+Transmitter long ID:\s+(?<transmitterId>[0-9]+)/,
	/^\s+Receiver long ID:\s+(?<receiverId>[0-9]+)/,
	/^\s+SDU last seen seq nbr:\s+(?<sduLastSeenSeqNbr>[0-9]+)/,
	/^\s+SDU data length:\s+(?<sduDataLength>[0-9]+)/,
	/^\s+SDU data:\s+(?<sduData>.+)/,
	/^\s+IE type:\s+(?<ieType>.+)/,
] as const

type PCCInfo = {
	time: string // e.g. '365111832209'
	status: string // e.g. 'valid - PDC can be received'
	snr: string // e.g. '61'
	stf_start_time: string // e.g. '365111814178'
	networkId: string // e.g. '22'
	transmitterId: string // e.g. '39'
	receiverId: string // e.g. '38'
	MCS: string // e.g. '0'
	txPowerDBm: string // e.g. '-12'
}

/*

PCC received (time 359572555405): status: \"valid - PDC can be received\", snr 83, stf_start_time 359572537298
  phy header: short nw id 22, transmitter id 39
  receiver id: 38
  MCS 0, TX pwr: -12 dBm

*/

const PCCLines = [
	/^PCC received \(time (?<time>[0-9]+)\): status: "(?<status>[^"]+)", snr (?<snr>[0-9]+), stf_start_time (?<stfStartTime>[0-9]+)/,
	/^\s+phy header: short nw id (?<networkId>[0-9]+), transmitter id (?<transmitterId>[0-9]+)/,
	/^\s+receiver id: (?<receiverId>[0-9]+)/,
	/^\s+MCS (?<mcs>[0-9]+), TX pwr: (?<txPowerDBm>-[0-9]+) dBm/,
] as const

type MessageListener = (deviceId: string, message: PDCInfo | PCCInfo) => void

const StreamParser = () => {
	let index = 0
	let lastResult = 0
	const lines: string[] = []

	const readLines = (
		regExps: Readonly<RegExp[]>,
	): Record<string, unknown> | null => {
		const result: RegExpExecArray['groups'][] = []
		const startIndex = index
		for (const regExp of regExps) {
			const match = regExp.exec(lines[index] ?? '')
			if (match === null) {
				index = startIndex
				return null
			}
			result.push(match.groups)
			index++
		}
		index--
		return result.reduce(
			(obj, groups) => ({ ...obj, ...groups }),
			{} as Record<string, unknown>,
		)
	}

	const parseLines = () => {
		let result: unknown | null = null
		while (index++ < lines.length - 1) {
			const pdcData = readLines(PDCLines)
			if (pdcData !== null) {
				lastResult = index
				result = pdcData
				continue
			}
			const pccData = readLines(PCCLines)
			if (pccData !== null) {
				lastResult = index
				result = pccData
				continue
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
