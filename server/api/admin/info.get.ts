export default defineEventHandler(async (event) => {
  const [line] = await mc(event, ['admin', 'info', 'srv'])
  const info = line?.info || line || {}
  const servers: any[] = info.servers || []

  const drives = servers.flatMap((s: any) => s.drives || [])
  const drivesOnline = drives.filter((d: any) => d.state === 'ok').length
  const totalSpace = drives.reduce((a: number, d: any) => a + (d.totalspace || 0), 0)
  const usedSpace = drives.reduce((a: number, d: any) => a + (d.usedspace || 0), 0)

  return {
    mode: info.mode || 'unknown',
    deploymentID: info.deploymentID || '',
    buckets: info.buckets?.count ?? null,
    objects: info.objects?.count ?? null,
    usage: info.usage?.size ?? usedSpace,
    totalSpace,
    drives: { online: drivesOnline, total: drives.length },
    servers: servers.map((s: any) => ({
      endpoint: s.endpoint,
      state: s.state,
      uptime: s.uptime,
      version: s.version,
      drives: (s.drives || []).map((d: any) => ({
        path: d.endpoint || d.path,
        state: d.state,
        totalspace: d.totalspace,
        usedspace: d.usedspace,
      })),
    })),
  }
})
