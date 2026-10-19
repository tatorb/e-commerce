// Si falta el depósito de archivos, los pasos para crearlo en Vercel.
export function BlobSetup() {
  return (
    <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
      <p>Para subir archivos falta conectar el depósito de archivos de Vercel. Se hace una sola vez y sirve para todos los productos.</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>En Vercel, entrá al proyecto y abrí la pestaña Storage.</li>
        <li>Tocá Create y elegí Blob.</li>
        <li>Ponele un nombre, por ejemplo e-commerce-files, y en Access elegí Private.</li>
        <li>Tildá Add a read-write token env var to this connection y tocá Create.</li>
        <li>Conectalo a Production y Preview, y volvé a publicar la app desde Deployments, con Redeploy.</li>
      </ol>
      <p className="text-muted-foreground">Mientras tanto, los links y el texto se guardan igual.</p>
    </div>
  );
}
