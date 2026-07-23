export const shouldEnablePlaybackTestRoute = (development: boolean, explicitValue?: string) =>
  development || explicitValue === 'true'
