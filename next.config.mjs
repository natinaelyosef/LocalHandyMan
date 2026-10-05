let userConfig = undefined
try {
  userConfig = await import('./v0-user-next.config')
} catch (e) {
  // ignore error
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    dirs: ['app', 'components', 'lib', 'context', 'hooks', 'scripts'],
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    // NOTE: parallel-build experiments crash production builds in this
    // environment (webpack-runtime `e[o] is not a function` on random
    // pages), so they stay off until the toolchain is fixed. Prerendering
    // runs single-file to avoid the same worker race.
    staticGenerationMaxConcurrency: 1,
  },
}

mergeConfig(nextConfig, userConfig)

function mergeConfig(nextConfig, userConfig) {
  if (!userConfig) {
    return
  }

  for (const key in userConfig) {
    if (
      typeof nextConfig[key] === 'object' &&
      !Array.isArray(nextConfig[key])
    ) {
      nextConfig[key] = {
        ...nextConfig[key],
        ...userConfig[key],
      }
    } else {
      nextConfig[key] = userConfig[key]
    }
  }
}

export default nextConfig
