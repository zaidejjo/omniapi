interface ImportOptions {
  workspace?: string
}

export async function importCommand(path: string, options: ImportOptions): Promise<void> {
  const { CollectionManager } = await import('@omniapi/core')
  const manager = new CollectionManager()
  const file = Bun.file(path)
  const json = await file.text()

  // Use default workspace if none provided
  const workspaceId = options.workspace ?? 'default'
  const collection = await manager.importFromJson(json)

  console.log(`Imported collection: ${collection.name} (${collection.id})`)
}
