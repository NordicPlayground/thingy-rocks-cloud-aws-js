import { Type, type Static } from '@sinclair/typebox'
import { verify, X509Certificate } from 'node:crypto'

/**
 * HTTP POST body sent by the Myriota Device Manager
 *
 * @see https://support.myriota.com/hc/en-us/articles/6482340814351-HTTP
 */
export const MyriotaMessage = Type.Object({
	EndpointRef: Type.String({ minLength: 1 }),
	Timestamp: Type.Integer({
		description: 'Unix Epoch time at which the HTTP POST request was generated',
	}),
	Id: Type.String({ minLength: 1 }),
	Data: Type.String({ minLength: 1, description: 'JSON serialised data' }),
	Signature: Type.String({ minLength: 1 }),
	CertificateUrl: Type.String({ minLength: 1 }),
})

export type MyriotaMessage = Static<typeof MyriotaMessage>

const CERTIFICATE_HOST = 'security.myriota.com'
const CERTIFICATE_ORGANIZATION = 'Myriota Pty Ltd'

const parseSubject = (subject: string): Record<string, string> =>
	Object.fromEntries(
		subject
			.split('\n')
			.map((line): [string, string] => {
				const i = line.indexOf('=')
				return [line.slice(0, i), line.slice(i + 1)]
			})
			.filter(([k]) => k !== ''),
	)

/**
 * Verifies that a message originated from Myriota.
 *
 * The signature (PKCS#1 v1.5, SHA-256) covers EndpointRef, Timestamp, Id and
 * Data joined by newlines. The public key is taken from the certificate at
 * CertificateUrl, which must be hosted on security.myriota.com and be issued
 * to Myriota Pty Ltd.
 */
export const verifyMyriotaMessage =
	(fetchCertificate: (url: URL) => Promise<string>) =>
	async (
		message: MyriotaMessage,
	): Promise<{ verified: true } | { verified: false; error: string }> => {
		let certificateUrl: URL
		try {
			certificateUrl = new URL(message.CertificateUrl)
		} catch {
			return { verified: false, error: 'Invalid CertificateUrl' }
		}
		if (
			certificateUrl.protocol !== 'https:' ||
			certificateUrl.host !== CERTIFICATE_HOST
		)
			return {
				verified: false,
				error: `CertificateUrl must be hosted on https://${CERTIFICATE_HOST}`,
			}

		let cert: X509Certificate
		try {
			cert = new X509Certificate(await fetchCertificate(certificateUrl))
		} catch (err) {
			return {
				verified: false,
				error: `Failed to load certificate: ${(err as Error).message}`,
			}
		}

		const subject = parseSubject(cert.subject)
		if (
			subject.CN !== CERTIFICATE_HOST ||
			subject.O !== CERTIFICATE_ORGANIZATION
		)
			return {
				verified: false,
				error: `Unexpected certificate subject: ${JSON.stringify(cert.subject)}`,
			}

		// Keys are rotated, so check the certificate was valid when the request was generated
		const requestTime = new Date(message.Timestamp * 1000)
		if (requestTime < cert.validFromDate || requestTime > cert.validToDate)
			return {
				verified: false,
				error: `Certificate was not valid at ${requestTime.toISOString()}`,
			}

		const signedData = [
			message.EndpointRef,
			message.Timestamp.toString(),
			message.Id,
			message.Data,
		].join('\n')

		if (
			!verify(
				'sha256',
				Buffer.from(signedData, 'utf-8'),
				cert.publicKey,
				Buffer.from(message.Signature, 'base64'),
			)
		)
			return { verified: false, error: 'Invalid signature' }

		return { verified: true }
	}

/**
 * Fetches certificates and caches them for the lifetime of the Lambda instance.
 */
export const fetchCertificateCached = (): ((url: URL) => Promise<string>) => {
	const cache = new Map<string, Promise<string>>()
	return async (url) => {
		const key = url.toString()
		let pem = cache.get(key)
		if (pem === undefined) {
			pem = fetch(url).then(async (res) => {
				if (!res.ok) throw new Error(`Fetching ${key} failed: ${res.status}`)
				return res.text()
			})
			cache.set(key, pem)
			// Don't cache failures
			pem.catch(() => cache.delete(key))
		}
		return pem
	}
}
