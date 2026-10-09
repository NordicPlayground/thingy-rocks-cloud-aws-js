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

	void it('should verify a message signed after the certificate expired', async () => {
		// Received from the Myriota Device Manager on 2026-10-07
		assert.deepEqual(
			await verify({
				Timestamp: 1791374832,
				Id: 'ecc0cda6-ab15-44da-a248-ba8398ee738a',
				Data: '{"Packets": [{"Timestamp": 1791374831463, "TerminalId": "89883380001010376490", "Value": "DECAFBADDECAFBADDECAFBADDECAFBAD"}]}',
				EndpointRef: 'gRufUoeATku_:ZOBvKex_R8qj',
				Signature:
					'uQtgZR52Hk8JdeX8B/eexcjRMm1x46D6EnqOMTEv3CroRTmifxG4wHaRQ/FId447ScPFtRzT3DWDvi6mwLruMSgIo+XG2LsW7jPAkkc+NXCjXUG8Jks0L9dBe43vhMuqvd8/nDLn9q0UrEKWUmKHZZUO5v7qxi3MF9Hd8AiG3vMmUxnENzHUAPVp9maM6FtVzD0a+GrVswKjW6SWBxKcPpV89l8hnQUAnUzDER3nIJzDUga4JnmmEDpvCX8/skhhtMOzh7FIWJd/coaJSzKisrDZeTeR56CYX24y6jWZfQtdZ0iHqqOpmNiRT6Z6P8Q1QCehMBTu6dFEduIZwvcm5w==',
				CertificateUrl: exampleMessage.CertificateUrl,
			}),
			{ verified: true },
		)
	})
})
