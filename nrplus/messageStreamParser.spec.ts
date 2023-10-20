import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parser } from './messageStreamParser.js'

void describe('messageStreamParser', () => {
	void it('should parse sink messages', async () => {
		const lines = (await readFile('./nrplus/nrplus-logs.txt', 'utf-8')).split(
			'\n',
		)

		const onMessageCallback = mock.fn(() => undefined)
		const p = parser()
		p.onMessage(onMessageCallback)
		for (const line of lines) {
			p.addLine('nrplus-gw-jagu', line)
		}

		assert.deepEqual(onMessageCallback.mock.calls[0]?.arguments, [
			'nrplus-gw-jagu',
			{
				time: '358881336898',
				snr: '88',
				RSSI: '-60',
				len: '83',
				type: 'Data SDU',
				expectedRXRSSI: '-60',
				seqNbr: '366',
				networkId: '22',
				transmitterId: '40',
				receiverId: '38',
				sduLastSeenSeqNbr: '1',
				sduDataLength: '40',
				sduData: '{\\"data\\":\\"Yes, hello\\",\\"modem_temp\\":\\"33\\"}',
				ieType: 'none',
			},
		])

		assert.deepEqual(onMessageCallback.mock.calls[1]?.arguments, [
			'nrplus-gw-jagu',
			{
				time: '364412319378',
				snr: '96',
				RSSI: '-60',
				len: '83',
				type: 'Data SDU',
				expectedRXRSSI: '-60',
				seqNbr: '382',
				networkId: '22',
				transmitterId: '40',
				receiverId: '38',
				sduLastSeenSeqNbr: '1',
				sduDataLength: '40',
				sduData: '{\\"data\\":\\"Yes, hello\\",\\"modem_temp\\":\\"33\\"}',
				ieType: 'none',
			},
		])
	})
})
