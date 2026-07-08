const SIZE_RANGES: [string, string][] = [
  ['LESS_THAN_1024_B', '< 1 KB'],
  ['BETWEEN_1024B_AND_1_MB', '1 KB – 1 MB'],
  ['BETWEEN_1_MB_AND_10_MB', '1 – 10 MB'],
  ['BETWEEN_10_MB_AND_64_MB', '10 – 64 MB'],
  ['BETWEEN_64_MB_AND_128_MB', '64 – 128 MB'],
  ['BETWEEN_128_MB_AND_512_MB', '128 – 512 MB'],
  ['GREATER_THAN_512_MB', '> 512 MB'],
]

export default defineEventHandler(async (event) => {
  const text = await mcRaw(event, ['admin', 'prometheus', 'metrics', 'srv', 'cluster'])

  const dist = parseProm(text, 'minio_cluster_objects_size_distribution', 'range')
  const received = parseProm(text, 'minio_s3_traffic_received_bytes')
  const sent = parseProm(text, 'minio_s3_traffic_sent_bytes')

  // tergantung versi, metric scanner bisa muncul di output cluster atau node
  let scans = parseProm(text, 'minio_node_scanner_bucket_scans_finished')._ || 0
  if (!scans) {
    try {
      const nodeText = await mcRaw(event, ['admin', 'prometheus', 'metrics', 'srv', 'node'])
      scans = parseProm(nodeText, 'minio_node_scanner_bucket_scans_finished')._ || 0
    } catch {}
  }

  return {
    sizeDistribution: SIZE_RANGES.map(([key, label]) => ({ label, count: dist[key] || 0 })),
    traffic: {
      get: sent._ || 0, // dikirim server = dibaca client (GET)
      put: received._ || 0, // diterima server = upload client (PUT)
    },
    scansFinished: scans,
  }
})
