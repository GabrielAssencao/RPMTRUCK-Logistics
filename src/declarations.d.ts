// Permite importar arquivos .glb e .gltf em TypeScript
declare module '*.glb' {
  const src: string
  export default src
}

declare module '*.gltf' {
  const src: string
  export default src
}
