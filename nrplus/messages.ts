/*
PCC: Physical Control Channel
PDC: Physical Data Channel
MCS: Modulation and Coding Scheme
SDU: Service Data Unit

PCC comes before each PDC.
PDC contains the actual MAC PDU/SDU. 
The content of the PDUs in here are just fMAC specific. 
*/

/**
 * PDC: Physical Data Channel
 *
 * Describes any messages received from any node within the network.
 * The RSSI here only applies to the last link.
 * We can use these messages to build an inventory of all of the nodes in the
 * network, and what messages they are sending.
 */
export type PDCInfo = {
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

export const PDCLines: Readonly<Array<RegExp>> = [
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

export const isPDCInfo = (
	message: Record<string, unknown>,
): message is PDCInfo => 'sduData' in message

/**
 * PCC: Physical Control Channel
 */
export type PCCInfo = {
	time: string // e.g. '365111832209'
	status: string // e.g. 'valid - PDC can be received'
	snr: string // e.g. '61'
	stfStartTime: string // e.g. '365111814178'
	networkId: string // e.g. '22'
	transmitterId: string // e.g. '39'
	receiverId: string // e.g. '38'
	MCS: string // e.g. '0'
	// This is the signal strength between this node and the relay, which is not necessarily the transmitterId
	txPowerDBm: string // e.g. '-12'
}

export const PCCLines: Readonly<Array<RegExp>> = [
	/^PCC received \(time (?<time>[0-9]+)\): status: "(?<status>[^"]+)", snr (?<snr>[0-9]+), stf_start_time (?<stfStartTime>[0-9]+)/,
	/^\s+phy header: short nw id (?<networkId>[0-9]+), transmitter id (?<transmitterId>[0-9]+)/,
	/^\s+receiver id: (?<receiverId>[0-9]+)/,
	/^\s+MCS (?<mcs>[0-9]+), TX pwr: (?<txPowerDBm>-[0-9]+) dBm/,
] as const

export const isPCCInfo = (
	message: Record<string, unknown>,
): message is PCCInfo => 'txPowerDBm' in message
