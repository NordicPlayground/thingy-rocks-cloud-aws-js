export const ContainerRepositoryId = {
	UDPIngest: 'udp-ingest',
} as const
export type ContainerRepositoryId =
	(typeof ContainerRepositoryId)[keyof typeof ContainerRepositoryId]
