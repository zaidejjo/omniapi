interface EnvOptions {
  workspace?: string
  name?: string
}

export async function envCommand(action: string, key: string | undefined, value: string | undefined, options: EnvOptions): Promise<void> {
  const { EnvironmentManager, getDb } = await import('@omniapi/core')
  const mgr = new EnvironmentManager()
  const workspaceId = options.workspace ?? 'default'

  switch (action) {
    case 'list': {
      const envs = mgr.list(workspaceId)
      console.table(envs.map(e => ({ name: e.name, variables: Object.keys(e.variables).length, active: e.isActive })))
      break
    }
    case 'set': {
      if (!key || !value) {
        console.error('Usage: om env set <key> <value>')
        process.exit(1)
      }
      const envName = options.name ?? 'Default'
      let env = mgr.list(workspaceId).find(e => e.name === envName)
      if (!env) {
        env = mgr.create(envName, workspaceId)
      }
      env.variables[key] = value
      mgr.updateVariables(env.id, env.variables)
      console.log(`Set ${key}=${value}`)
      break
    }
    case 'get': {
      if (!key) {
        console.error('Usage: om env get <key>')
        process.exit(1)
      }
      const active = mgr.getActive(workspaceId)
      if (active && active.variables[key]) {
        console.log(active.variables[key])
      } else {
        process.exit(1)
      }
      break
    }
    case 'delete': {
      if (!key) {
        console.error('Usage: om env delete <key>')
        process.exit(1)
      }
      const envName = options.name ?? 'Default'
      const env = mgr.list(workspaceId).find(e => e.name === envName)
      if (env) {
        delete env.variables[key]
        mgr.updateVariables(env.id, env.variables)
        console.log(`Deleted ${key}`)
      }
      break
    }
    default:
      console.error(`Unknown action: ${action}`)
      process.exit(1)
  }
}
