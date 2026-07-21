interface ExportOptions {
  output?: string
}

export async function exportCommand(collectionId: string, options: ExportOptions): Promise<void> {
  const { CollectionManager } = await import('@omniapi/core')
  const manager = new CollectionManager()
  const json = await manager.exportToJson(collectionId)

  if (options.output) {
    await Bun.write(options.output, json)
    console.log(`Exported to ${options.output}`)
  } else {
    console.log(json)
  }
}
