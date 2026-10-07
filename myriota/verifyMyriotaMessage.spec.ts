import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
	verifyMyriotaMessage,
	type MyriotaMessage,
} from './verifyMyriotaMessage.ts'

// Example from https://support.myriota.com/hc/en-us/articles/6482340814351-HTTP
const exampleMessage: MyriotaMessage = {
	EndpointRef: 'N_HlfTNgRsqe:uyXKvYTmTAO5',
	Timestamp: 1563521870,
	Data: '{"Packets": [{"Timestamp": 1563521870359, "TerminalId": "f74636ec549f9bde50cf765d2bcacbf9", "Value": "0101010101010101010101010101010101010101"}]}',
	Id: 'fe77e2c7-8e9c-40d0-8980-43720b9dab75',
	CertificateUrl:
		'https://security.myriota.com/data-13f7751f3c5df569a6c9c42a9ce73a8a.crt',
	Signature:
		'k2OIBppMRmBT520rUlIvMxNg+h9soJYBhQhOGSIWGdzkppdT1Po2GbFr7jbgi/NZapTG92VQkeHiaq4N9AIyP0mmUIv0x+liIbproMV04ML5Y1svhrtwFQoaJTVZqwuZObuqvFeXpqKGMfgHeet+B5EVJVKM/aqSy9lFpIP8ptX55jespbiLeQ6J2kmKyXZK72As8ryOW6D0ASa1kAFsFcSoSIcS0eOkyuP+MKEHApKfzN9J/qPOobP45OfC14j83GdEdA1Fo/wTUwyefwReHVJlPKnsEtjqXefZdmqSytF7S/Pd0ypMtC+R4PW52rtQa0Doq63I38oDSvQ0EbawYA==',
}

const certificate = await readFile(
	path.join(import.meta.dirname, 'data-13f7751f3c5df569a6c9c42a9ce73a8a.crt'),
	'utf-8',
)

void describe('verifyMyriotaMessage()', () => {
	const verify = verifyMyriotaMessage(async (url) => {
		assert.equal(url.toString(), exampleMessage.CertificateUrl)
		return certificate
	})

	void it('should verify a valid message', async () => {
		assert.deepEqual(await verify(exampleMessage), { verified: true })
	})

	void it('should reject a tampered message', async () => {
		const res = await verify({
			...exampleMessage,
			Data: exampleMessage.Data.replace('0101', '0202'),
		})
		assert.equal(res.verified, false)
	})

	void it('should reject certificates not hosted by Myriota', async () => {
		const res = await verify({
			...exampleMessage,
			CertificateUrl: 'https://example.com/data.crt',
		})
		assert.equal(res.verified, false)
	})

	void it('should reject messages generated outside of the certificate validity', async () => {
		const res = await verify({
			...exampleMessage,
			Timestamp: Math.floor(new Date('2025-01-01').getTime() / 1000),
		})
		assert.equal(res.verified, false)
	})
})
